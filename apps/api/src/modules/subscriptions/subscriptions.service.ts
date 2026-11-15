import {
  activeUntilOf,
  PAYMENT_EXPIRY_MINUTES,
  SUBSCRIPTION_MONTHS,
  subscriptionPrice,
  trialEndOf,
  type PaymentOrder,
  type SubscriptionOrderInput,
  type SubscriptionOverview,
} from '@silk/shared';
import type { DbOrTx } from '@silk/db';
import type { ActorContext } from '../../lib/context';
import { db } from '../../lib/db';
import { callbackSchema, checkStatus, createInvoice, duitkuConfig, newMerchantOrderId, simulatorCallback, verifyCallback } from '../../lib/duitku';
import { env } from '../../lib/env';
import { AppError, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { recordAudit } from '../m15-admin/audit.repo';
import * as repo from './subscriptions.repo';
import type { OrderRow } from './subscriptions.repo';

/**
 * Fase 11: langganan mitra dengan pembayaran Duitku POP.
 *
 * Status pesanan hanya berubah karena (1) callback bertanda tangan sah, atau (2) cek status ke Duitku.
 * URL kembali dari halaman bayar tidak pernah dipercaya. Aktivasi idempoten: callback yang dikirim ulang,
 * cek status, dan job rekonsiliasi boleh berjalan bersamaan tanpa menggandakan masa langganan.
 *
 * Aturan mutlak 1: tidak ada fungsi di sini yang menyentuh data pencarian atau urutan hasil.
 */

const toApi = (o: OrderRow): PaymentOrder => ({
  id: o.id,
  merchantOrderId: o.merchantOrderId,
  plan: o.plan,
  months: o.months,
  amount: o.amount,
  status: o.status,
  paymentUrl: o.status === 'pending' ? o.paymentUrl : null,
  expiresAt: o.expiresAt.toISOString(),
  paidAt: o.paidAt?.toISOString() ?? null,
  createdAt: o.createdAt.toISOString(),
});

async function myPartner(ctx: ActorContext) {
  const partner = await repo.findPartnerForUser(db(), ctx.actorId!);
  if (!partner) throw notFound('PARTNER_NOT_FOUND', 'Data mitra');
  return partner;
}

export async function overview(ctx: ActorContext): Promise<SubscriptionOverview> {
  const partner = await myPartner(ctx);
  const [periods, orders] = await Promise.all([repo.listPeriods(db(), partner.id), repo.listOrders(db(), partner.id)]);
  const trialEnd = trialEndOf(partner.verifiedAt);
  const until = activeUntilOf(new Date(), trialEnd, periods);
  return {
    activeUntil: until?.toISOString() ?? null,
    trialEndsAt: trialEnd?.toISOString() ?? null,
    partnerType: partner.partnerType,
    periods: periods.map((p) => ({ plan: p.plan, startsAt: p.startsAt.toISOString(), endsAt: p.endsAt.toISOString() })),
    orders: orders.map(toApi),
    plans: [{ id: 'tahunan', months: SUBSCRIPTION_MONTHS, price: subscriptionPrice(partner.partnerType) }],
    providerMode: duitkuConfig().mode,
  };
}

/** Buat pesanan dan tagihan Duitku. Klik ganda mengembalikan tagihan yang masih terbuka untuk paket yang sama. */
export async function createOrder(ctx: ActorContext, input: SubscriptionOrderInput): Promise<PaymentOrder> {
  const partner = await myPartner(ctx);
  if (partner.status !== 'verified') throw new AppError('PARTNER_NOT_VERIFIED', 'Langganan hanya untuk mitra yang sudah diverifikasi');
  const open = await repo.findOpenOrder(db(), partner.id, input.plan);
  if (open) return toApi(open);

  // Harga dari jenis mitra di server; nominal dari klien tidak pernah dipakai.
  const plan = { months: SUBSCRIPTION_MONTHS, price: subscriptionPrice(partner.partnerType) };
  const cfg = duitkuConfig();
  const e = env();
  const order = await db().transaction(async (tx) => {
    const row = await repo.insertOrder(tx, {
      partnerId: partner.id,
      createdBy: ctx.actorId!,
      merchantOrderId: newMerchantOrderId(),
      plan: input.plan,
      months: plan.months,
      amount: plan.price,
      providerMode: cfg.mode,
      expiresAt: new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60_000),
    });
    await audit(tx, ctx.actorId, 'payment.created', row, null, row, ctx);
    return row;
  });

  try {
    const invoice = await createInvoice({
      merchantOrderId: order.merchantOrderId,
      amount: order.amount,
      productDetails: `Langganan SILK Mitra (${plan.months} bulan)`,
      email: partner.email,
      customerName: partner.businessName,
      callbackUrl: new URL('/v1/payments/duitku/callback', e.API_ORIGIN).toString(),
      returnUrl: new URL(`/portal/langganan/${order.id}`, e.WEB_ORIGIN).toString(),
      expiryMinutes: PAYMENT_EXPIRY_MINUTES,
    });
    return toApi(await repo.setInvoice(db(), order.id, invoice.reference, invoice.paymentUrl));
  } catch (err) {
    // Tagihan gagal dibuat: tutup pesanan agar tidak menggantung sebagai `pending`.
    await repo.markClosed(db(), order.id, 'failed');
    throw err;
  }
}

/**
 * Status satu pesanan milik mitra. Bila masih `pending`, tanya Duitku paling sering sekali per menit
 * (halaman kembali portal memanggil ini beberapa kali sambil menunggu callback).
 */
export async function getOrder(ctx: ActorContext, id: string): Promise<PaymentOrder> {
  const partner = await myPartner(ctx);
  let order = await repo.findOrderForPartner(db(), id, partner.id);
  if (!order) throw notFound('PAYMENT_NOT_FOUND', 'Pesanan');
  const stale = !order.lastCheckedAt || Date.now() - order.lastCheckedAt.getTime() > 60_000;
  if (order.status === 'pending' && order.providerMode !== 'simulator' && stale && Date.now() - order.createdAt.getTime() > 30_000) {
    order = (await reconcileOne(order)) ?? order;
  }
  return toApi(order);
}

/* ---------- Callback Duitku ---------- */

export type CallbackOutcome = 'paid' | 'failed' | 'duplicate' | 'ignored';

/**
 * Proses callback Duitku. Tanda tangan, kode merchant, dan nominal wajib cocok; selain itu ditolak (400)
 * dan tetap dicatat di payment_events. Callback untuk pesanan yang sudah final dijawab 200 tanpa perubahan.
 */
export async function handleCallback(raw: Record<string, unknown>, ip: string | null): Promise<{ outcome: CallbackOutcome }> {
  const parsed = callbackSchema.safeParse(raw);
  const merchantOrderId = typeof raw.merchantOrderId === 'string' ? raw.merchantOrderId.slice(0, 50) : null;
  if (!parsed.success) {
    await repo.insertEvent(db(), { orderId: null, merchantOrderId, kind: 'callback', signatureValid: null, outcome: 'malformed', payload: raw, ip });
    throw new AppError('VALIDATION_FAILED', 'Callback tidak lengkap');
  }
  const cb = parsed.data;
  const signatureValid = verifyCallback(cb);
  // Tanda tangan tidak disimpan: tidak berguna untuk audit dan tidak perlu disebar.
  const { signature: _sig, ...payload } = cb;
  if (!signatureValid) {
    await repo.insertEvent(db(), { orderId: null, merchantOrderId: cb.merchantOrderId, kind: 'callback', signatureValid, outcome: 'rejected_signature', payload, ip });
    logger.warn({ merchantOrderId: cb.merchantOrderId, ip }, 'callback duitku: tanda tangan tidak sah');
    throw new AppError('VALIDATION_FAILED', 'Tanda tangan tidak sah');
  }

  // Penolakan dikembalikan sebagai nilai (bukan dilempar) agar catatan event-nya ikut ter-commit.
  const result = await db().transaction(async (tx): Promise<{ outcome: CallbackOutcome | 'rejected' }> => {
    const order = await repo.lockOrder(tx, { merchantOrderId: cb.merchantOrderId });
    const event = (outcome: string) =>
      repo.insertEvent(tx, { orderId: order?.id ?? null, merchantOrderId: cb.merchantOrderId, kind: 'callback', signatureValid, outcome, payload, ip });

    if (!order) {
      await event('unknown_order');
      return { outcome: 'ignored' };
    }
    if (Math.round(Number(cb.amount)) !== order.amount) {
      await event('rejected_amount');
      logger.error({ orderId: order.id, expected: order.amount, got: cb.amount }, 'callback duitku: nominal tidak cocok');
      return { outcome: 'rejected' };
    }
    if (cb.resultCode === '00') {
      const outcome = await applyPaid(tx, order, cb.reference ?? null, 'callback');
      await event(outcome);
      return { outcome };
    }
    // Gagal dari penyedia: tutup pesanan yang masih pending. Pesanan lunas tidak pernah mundur.
    const closed = await repo.markClosed(tx, order.id, 'failed');
    if (closed) await audit(tx, null, 'payment.failed', order, order, closed);
    await event(closed ? 'failed' : 'duplicate');
    return { outcome: closed ? 'failed' : 'duplicate' };
  });
  if (result.outcome === 'rejected') throw new AppError('VALIDATION_FAILED', 'Nominal tidak cocok');
  return { outcome: result.outcome };
}

/** Tandai lunas dan tambah masa langganan dalam transaksi yang sama. Idempoten. */
async function applyPaid(tx: DbOrTx, order: OrderRow, reference: string | null, source: 'callback' | 'status_check'): Promise<'paid' | 'duplicate'> {
  if (order.status === 'paid') return 'duplicate';
  const paid = await repo.markPaid(tx, order.id, reference);
  await audit(tx, null, 'payment.paid', order, order, { ...paid, source });
  if (order.partnerId) {
    // Periode berbayar menyambung setelah masa gratis 6 bulan, bukan memotongnya.
    const notBefore = trialEndOf(await repo.partnerVerifiedAt(tx, order.partnerId));
    const period = await repo.addPeriod(tx, { partnerId: order.partnerId, orderId: order.id, plan: order.plan, months: order.months, notBefore });
    if (period) {
      await recordAudit(tx, {
        actorId: null,
        action: 'subscription.activated',
        entity: 'partner',
        entityId: order.partnerId,
        before: null,
        after: { plan: order.plan, startsAt: period.starts_at, endsAt: period.ends_at, paymentOrderId: order.id },
        ip: null,
        requestId: null,
      });
    }
  }
  return 'paid';
}

/* ---------- Rekonsiliasi (cek status) ---------- */

/** Cek satu pesanan ke Duitku lalu terapkan hasilnya. Mengembalikan pesanan terbaru, atau null bila tidak berubah. */
async function reconcileOne(order: OrderRow): Promise<OrderRow | null> {
  const remote = await checkStatus(order.merchantOrderId);
  return db().transaction(async (tx) => {
    const locked = await repo.lockOrder(tx, { id: order.id });
    if (!locked || locked.status !== 'pending') return locked;
    await repo.touchChecked(tx, locked.id);
    const event = (outcome: string) =>
      repo.insertEvent(tx, {
        orderId: locked.id,
        merchantOrderId: locked.merchantOrderId,
        kind: 'status_check',
        signatureValid: null,
        outcome,
        payload: remote ?? { unavailable: true },
        ip: null,
      });
    if (remote?.status === 'paid') {
      if (remote.amount !== locked.amount) {
        await event('rejected_amount');
        logger.error({ orderId: locked.id, expected: locked.amount, got: remote.amount }, 'cek status duitku: nominal tidak cocok');
        return null;
      }
      await event(await applyPaid(tx, locked, remote.reference, 'status_check'));
      return repo.lockOrder(tx, { id: locked.id });
    }
    if (remote?.status === 'failed') {
      const closed = await repo.markClosed(tx, locked.id, 'failed');
      if (closed) await audit(tx, null, 'payment.failed', locked, locked, closed);
      await event('failed');
      return closed;
    }
    // Masih diproses atau tidak bisa dipastikan: kedaluwarsakan bila sudah lewat batas + jeda 1 jam.
    const graceMs = remote ? 60 * 60_000 : 24 * 60 * 60_000;
    if (Date.now() > locked.expiresAt.getTime() + graceMs) {
      const closed = await repo.markClosed(tx, locked.id, 'expired');
      if (closed) await audit(tx, null, 'payment.expired', locked, locked, closed);
      await event('expired');
      return closed;
    }
    await event(remote ? 'pending' : 'unavailable');
    return null;
  });
}

/**
 * Job (dipanggil dari cron process-queue): cocokkan pesanan pending dengan Duitku, maksimal `limit` per putaran.
 * Simulator tidak punya status jarak jauh, jadi pesanannya hanya dikedaluwarsakan setelah lewat batas.
 */
export async function reconcilePayments(limit = 10) {
  const summary = { checked: 0, paid: 0, failed: 0, expired: 0 };
  for (const order of await repo.duePendingOrders(db(), limit)) {
    summary.checked++;
    if (order.providerMode === 'simulator') {
      if (Date.now() <= order.expiresAt.getTime()) continue;
      const closed = await db().transaction(async (tx) => {
        const c = await repo.markClosed(tx, order.id, 'expired');
        if (c) await audit(tx, null, 'payment.expired', order, order, c);
        return c;
      });
      if (closed) summary.expired++;
      continue;
    }
    const after = await reconcileOne(order);
    if (after?.status === 'paid') summary.paid++;
    else if (after?.status === 'failed') summary.failed++;
    else if (after?.status === 'expired') summary.expired++;
  }
  return summary;
}

/* ---------- Simulator (dev/uji tanpa kunci Duitku) ---------- */

async function simulatorOrder(merchantOrderId: string, reference: string): Promise<OrderRow> {
  if (duitkuConfig().mode !== 'simulator') throw new AppError('NOT_FOUND', 'Tidak ditemukan');
  const order = await repo.findOrderByMerchantId(db(), merchantOrderId);
  if (!order || order.providerMode !== 'simulator' || order.providerReference !== reference) throw notFound('PAYMENT_NOT_FOUND', 'Pesanan');
  return order;
}

export async function simulatorPage(merchantOrderId: string, reference: string) {
  const o = await simulatorOrder(merchantOrderId, reference);
  return { merchantOrderId: o.merchantOrderId, reference, amount: o.amount, plan: o.plan, status: o.status };
}

/** Kirim callback bertanda tangan seperti Duitku, lalu kembalikan URL kembali ke portal. */
export async function simulatorPay(merchantOrderId: string, reference: string, success: boolean): Promise<string> {
  const order = await simulatorOrder(merchantOrderId, reference);
  await handleCallback(simulatorCallback({ merchantOrderId, amount: order.amount, reference }, success), '127.0.0.1');
  const url = new URL(`/portal/langganan/${order.id}`, env().WEB_ORIGIN);
  url.searchParams.set('merchantOrderId', merchantOrderId);
  url.searchParams.set('reference', reference);
  url.searchParams.set('resultCode', success ? '00' : '02');
  return url.toString();
}

/* ---------- Audit ---------- */

function audit(tx: DbOrTx, actorId: string | null, action: string, order: OrderRow, before: unknown, after: unknown, ctx?: ActorContext) {
  return recordAudit(tx, {
    actorId,
    action,
    entity: 'payment_order',
    entityId: order.id,
    before,
    after,
    ip: ctx?.ip ?? null,
    requestId: ctx?.requestId ?? null,
  });
}
