import { and, desc, eq, sql } from 'drizzle-orm';
import { partners, paymentEvents, paymentOrders, subscriptions, user, type DbOrTx } from '@silk/db';
import type { PaymentStatus } from '@silk/shared';

/** Kolom pesanan yang dipakai service (tanpa created_by dan provider). */
const orderColumns = {
  id: paymentOrders.id,
  partnerId: paymentOrders.partnerId,
  merchantOrderId: paymentOrders.merchantOrderId,
  plan: paymentOrders.plan,
  months: paymentOrders.months,
  amount: paymentOrders.amount,
  status: paymentOrders.status,
  providerMode: paymentOrders.providerMode,
  providerReference: paymentOrders.providerReference,
  paymentUrl: paymentOrders.paymentUrl,
  expiresAt: paymentOrders.expiresAt,
  paidAt: paymentOrders.paidAt,
  lastCheckedAt: paymentOrders.lastCheckedAt,
  createdAt: paymentOrders.createdAt,
};
export type OrderRow = {
  id: string;
  partnerId: string | null;
  merchantOrderId: string;
  plan: string;
  months: number;
  amount: number;
  status: PaymentStatus;
  providerMode: string;
  providerReference: string | null;
  paymentUrl: string | null;
  expiresAt: Date;
  paidAt: Date | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
};

/** Mitra milik pengguna beserta nama dan email akun (untuk data pelanggan di tagihan). */
export async function findPartnerForUser(db: DbOrTx, userId: string) {
  const [row] = await db
    .select({ id: partners.id, status: partners.status, businessName: partners.businessName, email: user.email, name: user.name })
    .from(partners)
    .innerJoin(user, eq(user.id, partners.userId))
    .where(eq(partners.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function listOrders(db: DbOrTx, partnerId: string, limit = 10): Promise<OrderRow[]> {
  return db.select(orderColumns).from(paymentOrders).where(eq(paymentOrders.partnerId, partnerId)).orderBy(desc(paymentOrders.createdAt)).limit(limit);
}

export async function findOrderForPartner(db: DbOrTx, id: string, partnerId: string): Promise<OrderRow | null> {
  const [row] = await db
    .select(orderColumns)
    .from(paymentOrders)
    .where(and(eq(paymentOrders.id, id), eq(paymentOrders.partnerId, partnerId)))
    .limit(1);
  return row ?? null;
}

export async function findOrderByMerchantId(db: DbOrTx, merchantOrderId: string): Promise<OrderRow | null> {
  const [row] = await db.select(orderColumns).from(paymentOrders).where(eq(paymentOrders.merchantOrderId, merchantOrderId)).limit(1);
  return row ?? null;
}

/** Tagihan yang masih bisa dibayar untuk paket yang sama (klik ganda tidak membuat tagihan baru). */
export async function findOpenOrder(db: DbOrTx, partnerId: string, plan: string): Promise<OrderRow | null> {
  const [row] = await db
    .select(orderColumns)
    .from(paymentOrders)
    .where(
      and(
        eq(paymentOrders.partnerId, partnerId),
        eq(paymentOrders.plan, plan),
        eq(paymentOrders.status, 'pending'),
        sql`${paymentOrders.paymentUrl} IS NOT NULL`,
        sql`${paymentOrders.expiresAt} > now() + interval '5 minutes'`,
      ),
    )
    .orderBy(desc(paymentOrders.createdAt))
    .limit(1);
  return row ?? null;
}

export async function insertOrder(
  db: DbOrTx,
  v: { partnerId: string; createdBy: string; merchantOrderId: string; plan: string; months: number; amount: number; providerMode: string; expiresAt: Date },
): Promise<OrderRow> {
  const [row] = await db.insert(paymentOrders).values(v).returning(orderColumns);
  return row!;
}

export async function setInvoice(db: DbOrTx, id: string, reference: string, paymentUrl: string): Promise<OrderRow> {
  const [row] = await db
    .update(paymentOrders)
    .set({ providerReference: reference, paymentUrl, updatedAt: sql`now()` })
    .where(eq(paymentOrders.id, id))
    .returning(orderColumns);
  return row!;
}

/** Kunci pesanan selama transaksi agar callback ganda dan cek status tidak memproses dua kali. */
export async function lockOrder(db: DbOrTx, by: { id: string } | { merchantOrderId: string }): Promise<OrderRow | null> {
  const where = 'id' in by ? eq(paymentOrders.id, by.id) : eq(paymentOrders.merchantOrderId, by.merchantOrderId);
  const [row] = await db.select(orderColumns).from(paymentOrders).where(where).for('update').limit(1);
  return row ?? null;
}

export async function markPaid(db: DbOrTx, id: string, reference: string | null): Promise<OrderRow> {
  const [row] = await db
    .update(paymentOrders)
    .set({
      status: 'paid',
      paidAt: sql`now()`,
      paymentUrl: null,
      providerReference: sql`coalesce(${reference}, ${paymentOrders.providerReference})`,
      updatedAt: sql`now()`,
    })
    .where(eq(paymentOrders.id, id))
    .returning(orderColumns);
  return row!;
}

/** Ubah status selain `paid`; hanya dari `pending` (pesanan lunas tidak pernah mundur). */
export async function markClosed(db: DbOrTx, id: string, status: 'failed' | 'expired'): Promise<OrderRow | null> {
  const [row] = await db
    .update(paymentOrders)
    .set({ status, paymentUrl: null, updatedAt: sql`now()` })
    .where(and(eq(paymentOrders.id, id), eq(paymentOrders.status, 'pending')))
    .returning(orderColumns);
  return row ?? null;
}

export async function touchChecked(db: DbOrTx, id: string): Promise<void> {
  await db.update(paymentOrders).set({ lastCheckedAt: sql`now()` }).where(eq(paymentOrders.id, id));
}

export async function insertEvent(
  db: DbOrTx,
  e: { orderId: string | null; merchantOrderId: string | null; kind: 'callback' | 'status_check'; signatureValid: boolean | null; outcome: string; payload: unknown; ip: string | null },
): Promise<void> {
  await db.insert(paymentEvents).values({ ...e, payload: e.payload ?? {} });
}

/**
 * Tambah satu masa langganan untuk pesanan lunas. Dimulai dari akhir masa terakhir (atau sekarang bila sudah
 * habis). `ON CONFLICT` pada payment_order_id membuat aktivasi idempoten.
 */
export async function addPeriod(db: DbOrTx, v: { partnerId: string; orderId: string; plan: string; months: number }) {
  const result = await db.execute<{ id: string; starts_at: string; ends_at: string }>(sql`
    INSERT INTO subscriptions (partner_id, payment_order_id, plan, starts_at, ends_at)
    SELECT ${v.partnerId}, ${v.orderId}, ${v.plan}, s.start, s.start + make_interval(months => ${v.months})
    FROM (
      SELECT greatest(now(), coalesce(max(ends_at), now())) AS start FROM subscriptions WHERE partner_id = ${v.partnerId}
    ) s
    ON CONFLICT (payment_order_id) DO NOTHING
    RETURNING id, starts_at, ends_at
  `);
  return result.rows[0] ?? null;
}

export async function listPeriods(db: DbOrTx, partnerId: string) {
  return db
    .select({ plan: subscriptions.plan, startsAt: subscriptions.startsAt, endsAt: subscriptions.endsAt })
    .from(subscriptions)
    .where(eq(subscriptions.partnerId, partnerId))
    .orderBy(desc(subscriptions.startsAt))
    .limit(12);
}

/** Akhir masa aktif (masa bersambung tanpa celah), atau null bila tidak aktif sekarang. */
export async function activeUntil(db: DbOrTx, partnerId: string): Promise<Date | null> {
  const result = await db.execute<{ until: Date | string | null }>(sql`
    SELECT max(ends_at) AS until FROM subscriptions
    WHERE partner_id = ${partnerId}
    HAVING bool_or(starts_at <= now() AND ends_at > now())
  `);
  const until = result.rows[0]?.until;
  return until ? new Date(until) : null;
}

/**
 * Pesanan `pending` yang perlu dicek ke penyedia: berumur lebih dari 10 menit dan belum dicek 30 menit terakhir.
 * Dibatasi agar tidak memicu pemblokiran Duitku untuk pemanggilan berlebihan.
 */
export async function duePendingOrders(db: DbOrTx, limit: number): Promise<OrderRow[]> {
  return db
    .select(orderColumns)
    .from(paymentOrders)
    .where(
      and(
        eq(paymentOrders.status, 'pending'),
        sql`${paymentOrders.createdAt} < now() - interval '10 minutes'`,
        sql`(${paymentOrders.lastCheckedAt} IS NULL OR ${paymentOrders.lastCheckedAt} < now() - interval '30 minutes')`,
      ),
    )
    .orderBy(paymentOrders.createdAt)
    .limit(limit);
}
