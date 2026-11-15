import express, { Router, type Request } from 'express';
import { z } from 'zod';
import { paymentOrderSchema, subscriptionOrderInputSchema, subscriptionOverviewSchema, uuidSchema } from '@silk/shared';
import { actorFrom } from '../../lib/context';
import { env } from '../../lib/env';
import { defineRoute } from '../../lib/route';
import { requireFlag } from '../../middleware/auth';
import { pgRateLimit } from '../../middleware/rate-limit';
import * as service from './subscriptions.service';

const tags = ['Langganan'];
const flag = requireFlag('subscriptions_enabled');

/** Dipasang di router /v1/partners (sudah melewati loadSession, partner.self, CSRF). Flag OFF = 404. */
export function partnerSubscriptionRoutes(router: Router): void {
  defineRoute(router, '/partners', {
    method: 'get',
    path: '/me/subscription',
    summary: 'Masa langganan, riwayat pesanan, dan daftar paket (flag subscriptions_enabled)',
    tags,
    security: 'session',
    response: subscriptionOverviewSchema,
    middleware: [flag],
    handler: async (_i, req) => ({ data: await service.overview(actorFrom(req)) }),
  });
  defineRoute(router, '/partners', {
    method: 'post',
    path: '/me/subscription/orders',
    summary: 'Buat pesanan langganan dan tagihan Duitku; nominal dari server. Mengembalikan paymentUrl',
    tags,
    security: 'session',
    body: subscriptionOrderInputSchema,
    response: paymentOrderSchema,
    middleware: [
      flag,
      pgRateLimit({ name: 'payment-order', limit: 10, windowSec: 3600, key: (req: Request) => req.auth?.user.id ?? null }),
    ],
    handler: async (i, req) => ({ data: await service.createOrder(actorFrom(req), i.body) }),
  });
  defineRoute(router, '/partners', {
    method: 'get',
    path: '/me/subscription/orders/:id',
    summary: 'Status satu pesanan (dicocokkan ke Duitku bila masih pending)',
    tags,
    security: 'session',
    params: z.object({ id: uuidSchema }),
    response: paymentOrderSchema,
    middleware: [flag],
    handler: async (i, req) => ({ data: await service.getOrder(actorFrom(req), i.params.id) }),
  });
}

/**
 * Router /v1/payments: callback server-ke-server dari Duitku (x-www-form-urlencoded). Tanpa sesi dan tanpa CSRF;
 * keasliannya dijamin tanda tangan HMAC. Dipasang sebelum parser JSON.
 */
export function paymentWebhookRoutes(router: Router): void {
  defineRoute(router, '/payments', {
    method: 'post',
    path: '/duitku/callback',
    summary: 'Callback pembayaran Duitku (tanda tangan HMAC-SHA256 wajib, idempoten)',
    tags: ['Webhook'],
    security: 'signature',
    successStatus: 200,
    middleware: [flag, express.urlencoded({ extended: false, limit: '64kb' }), express.json({ limit: '64kb' })],
    handler: async (_i, req) => ({ data: await service.handleCallback((req.body ?? {}) as Record<string, unknown>, req.ip ?? null) }),
  });
}

/* ---------- Simulator (dev/uji, tanpa kunci Duitku) ---------- */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;
const simQuery = z.object({ order: z.string().min(1).max(50), reference: z.string().min(1).max(64) });

/**
 * Halaman bayar tiruan pengganti Duitku saat DUITKU_* kosong. Hanya dipasang di luar produksi, dan service
 * menolaknya bila kunci Duitku terisi. Tombol "Bayar" mengirim callback bertanda tangan lewat jalur yang sama
 * dengan callback Duitku asli.
 */
export function devDuitkuSimulator(): Router {
  const r = Router();
  r.use(flag);
  r.get('/pay', async (req, res) => {
    const q = simQuery.parse(req.query);
    const o = await service.simulatorPage(q.order, q.reference);
    const done = o.status !== 'pending';
    // Form mengalihkan ke portal web (origin lain): form-action harus mengizinkannya.
    res.set('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${new URL(env().WEB_ORIGIN).origin}; frame-ancestors 'none'`);
    res.set('Cache-Control', 'no-store').type('html').send(`<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Simulator pembayaran</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:40px auto;padding:0 16px;color:#13201e}
.box{border:1px solid #cfdcd9;border-radius:16px;padding:20px}.tag{display:inline-block;background:#fdf1d6;color:#7a4b00;border-radius:999px;padding:2px 10px;font-size:13px}
dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px}dt{color:#5b6b68}button{width:100%;height:48px;border-radius:999px;border:0;font-size:16px;font-weight:600;margin-top:10px;cursor:pointer}
.ok{background:#0f766e;color:#fff}.no{background:#fff;border:1px solid #cfdcd9;color:#13201e}</style></head>
<body><div class="box"><span class="tag">Simulator, bukan Duitku. Tidak ada uang sungguhan.</span>
<h1 style="font-size:22px">Pembayaran langganan SILK</h1>
<dl><dt>Pesanan</dt><dd>${esc(o.merchantOrderId)}</dd><dt>Paket</dt><dd>${esc(o.plan)}</dd><dt>Total</dt><dd><b>${rupiah(o.amount)}</b></dd><dt>Status</dt><dd>${esc(o.status)}</dd></dl>
${
  done
    ? '<p>Pesanan ini sudah diproses.</p>'
    : `<form method="post" action="/v1/dev/duitku/pay"><input type="hidden" name="order" value="${esc(o.merchantOrderId)}"><input type="hidden" name="reference" value="${esc(q.reference)}">
<button class="ok" name="result" value="success">Bayar (berhasil)</button><button class="no" name="result" value="failed">Batalkan (gagal)</button></form>`
}
</div></body></html>`);
  });
  r.post('/pay', express.urlencoded({ extended: false, limit: '4kb' }), async (req, res) => {
    const body = simQuery.extend({ result: z.enum(['success', 'failed']) }).parse(req.body);
    res.redirect(303, await service.simulatorPay(body.order, body.reference, body.result === 'success'));
  });
  return r;
}
