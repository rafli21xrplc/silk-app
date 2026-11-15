import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { PaymentProviderMode } from '@silk/shared';
import { env, isProduction } from './env';
import { AppError } from './errors';
import { logger } from './logger';

/**
 * Adaptor Duitku POP (https://docs.duitku.com/pop/en/).
 *
 * - `sandbox`/`production`: dipilih lewat DUITKU_ENV, butuh DUITKU_MERCHANT_CODE dan DUITKU_API_KEY.
 * - `simulator`: kunci kosong di dev/uji. Halaman bayar tiruan di API (`/v1/dev/duitku/pay`) mengirim callback
 *   bertanda tangan dengan kunci simulator, jadi alur lengkap bisa dicoba tanpa akun Duitku. Ditolak di produksi.
 *
 * Semua tanda tangan HMAC-SHA256 dengan API key (metode MD5 lama sudah tidak dipakai Duitku).
 */

const HOSTS = {
  sandbox: { pop: 'https://api-sandbox.duitku.com', webapi: 'https://sandbox.duitku.com' },
  production: { pop: 'https://api-prod.duitku.com', webapi: 'https://passport.duitku.com' },
} as const;

/** Kredensial simulator; hanya bermakna di dev/uji dan tidak pernah dikirim ke Duitku. */
export const SIMULATOR_MERCHANT_CODE = 'DSIM0001';
export const SIMULATOR_API_KEY = 'silk-duitku-simulator-dev-only';

const TIMEOUT_MS = 10_000;

interface Config {
  mode: PaymentProviderMode;
  merchantCode: string;
  apiKey: string;
}

export function duitkuConfig(): Config {
  const e = env();
  if (e.DUITKU_MERCHANT_CODE && e.DUITKU_API_KEY) {
    return { mode: e.DUITKU_ENV, merchantCode: e.DUITKU_MERCHANT_CODE, apiKey: e.DUITKU_API_KEY };
  }
  // env() sudah menolak produksi tanpa kunci saat langganan aktif; ini pagar kedua.
  if (isProduction()) throw new AppError('PAYMENT_PROVIDER_ERROR', 'Pembayaran belum dikonfigurasi');
  return { mode: 'simulator', merchantCode: SIMULATOR_MERCHANT_CODE, apiKey: SIMULATOR_API_KEY };
}

export const hmacHex = (data: string, key: string) => createHmac('sha256', key).update(data, 'utf8').digest('hex');

/** Bandingkan dua tanda tangan hex tanpa membocorkan waktu; huruf besar/kecil diabaikan. */
export function signatureEquals(a: string, b: string): boolean {
  const x = Buffer.from(a.trim().toLowerCase());
  const y = Buffer.from(b.trim().toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Tanda tangan header createInvoice: HMAC_SHA256(merchantCode + timestamp, apiKey). */
export const invoiceSignature = (merchantCode: string, timestamp: string, apiKey: string) => hmacHex(merchantCode + timestamp, apiKey);
/** Tanda tangan callback: HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey). */
export const callbackSignature = (merchantCode: string, amount: string, merchantOrderId: string, apiKey: string) =>
  hmacHex(merchantCode + amount + merchantOrderId, apiKey);
/** Tanda tangan cek status: HMAC_SHA256(merchantCode + merchantOrderId, apiKey). */
export const statusSignature = (merchantCode: string, merchantOrderId: string, apiKey: string) => hmacHex(merchantCode + merchantOrderId, apiKey);

/** ID pesanan unik yang tidak bisa ditebak, maksimal 50 karakter (batas Duitku). */
export function newMerchantOrderId(now = new Date()): string {
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `SILK-${day}-${randomBytes(8).toString('hex').toUpperCase()}`;
}

/* ---------- Buat tagihan (POP createInvoice) ---------- */

export interface InvoiceInput {
  merchantOrderId: string;
  amount: number;
  productDetails: string;
  email: string;
  customerName: string;
  callbackUrl: string;
  returnUrl: string;
  expiryMinutes: number;
}

const invoiceResponse = z.object({
  reference: z.string().min(1),
  paymentUrl: z.url(),
  statusCode: z.string(),
  statusMessage: z.string().optional(),
});

export async function createInvoice(input: InvoiceInput): Promise<{ reference: string; paymentUrl: string }> {
  const cfg = duitkuConfig();
  if (cfg.mode === 'simulator') {
    const reference = `SIM${randomBytes(8).toString('hex').toUpperCase()}`;
    const url = new URL('/v1/dev/duitku/pay', env().API_ORIGIN);
    url.searchParams.set('order', input.merchantOrderId);
    url.searchParams.set('reference', reference);
    return { reference, paymentUrl: url.toString() };
  }
  const timestamp = String(Date.now());
  const body = {
    paymentAmount: input.amount,
    merchantOrderId: input.merchantOrderId,
    productDetails: input.productDetails,
    email: input.email,
    // Duitku membatasi customerVaName 20 karakter.
    customerVaName: input.customerName.slice(0, 20),
    itemDetails: [{ name: input.productDetails.slice(0, 50), price: input.amount, quantity: 1 }],
    callbackUrl: input.callbackUrl,
    returnUrl: input.returnUrl,
    expiryPeriod: input.expiryMinutes,
  };
  let res: Response;
  try {
    res = await fetch(`${HOSTS[cfg.mode].pop}/api/merchant/createInvoice`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-duitku-merchantcode': cfg.merchantCode,
        'x-duitku-timestamp': timestamp,
        'x-duitku-signature': invoiceSignature(cfg.merchantCode, timestamp, cfg.apiKey),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err, mode: cfg.mode }, 'duitku createInvoice tidak terjangkau');
    throw new AppError('PAYMENT_PROVIDER_ERROR', 'Layanan pembayaran tidak terjangkau. Coba lagi sebentar lagi.');
  }
  const text = await res.text();
  let parsed: z.ZodSafeParseResult<z.infer<typeof invoiceResponse>> | null = null;
  try {
    parsed = invoiceResponse.safeParse(JSON.parse(text));
  } catch {
    parsed = null;
  }
  if (!res.ok || !parsed?.success || parsed.data.statusCode !== '00') {
    // Isi respons dicatat (tanpa kunci) agar kesalahan konfigurasi sandbox mudah dilacak.
    logger.error({ status: res.status, body: text.slice(0, 500), mode: cfg.mode }, 'duitku createInvoice ditolak');
    throw new AppError('PAYMENT_PROVIDER_ERROR', 'Layanan pembayaran menolak permintaan. Coba lagi atau hubungi tim SILK.');
  }
  return { reference: parsed.data.reference, paymentUrl: parsed.data.paymentUrl };
}

/* ---------- Cek status transaksi ---------- */

export type ProviderStatus = 'paid' | 'pending' | 'failed';

const statusResponse = z.object({
  merchantOrderId: z.string(),
  reference: z.string().nullish(),
  amount: z.union([z.string(), z.number()]),
  statusCode: z.string(),
});

/**
 * Tanya status ke Duitku. `null` = tidak bisa dipastikan (simulator, jaringan, atau respons aneh); pemanggil
 * membiarkan pesanan apa adanya. Duitku memblokir sementara pemanggilan berlebihan: panggil hemat.
 */
export async function checkStatus(merchantOrderId: string): Promise<{ status: ProviderStatus; amount: number; reference: string | null } | null> {
  const cfg = duitkuConfig();
  if (cfg.mode === 'simulator') return null;
  try {
    const res = await fetch(`${HOSTS[cfg.mode].webapi}/webapi/api/merchant/transactionStatus`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        merchantCode: cfg.merchantCode,
        merchantOrderId,
        signature: statusSignature(cfg.merchantCode, merchantOrderId, cfg.apiKey),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const parsed = statusResponse.safeParse(await res.json());
    if (!res.ok || !parsed.success || parsed.data.merchantOrderId !== merchantOrderId) {
      logger.warn({ status: res.status, merchantOrderId }, 'duitku transactionStatus tidak dapat dibaca');
      return null;
    }
    // 00 = sukses, 01 = diproses, 02 = gagal/kedaluwarsa.
    const status: ProviderStatus = parsed.data.statusCode === '00' ? 'paid' : parsed.data.statusCode === '02' ? 'failed' : 'pending';
    return { status, amount: Math.round(Number(parsed.data.amount)), reference: parsed.data.reference ?? null };
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err, merchantOrderId }, 'duitku transactionStatus gagal');
    return null;
  }
}

/* ---------- Callback ---------- */

/** Field callback yang dipakai; field lain disimpan apa adanya di payment_events. */
export const callbackSchema = z.looseObject({
  merchantCode: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  merchantOrderId: z.string().min(1).max(50),
  resultCode: z.string(),
  reference: z.string().optional(),
  signature: z.string().min(1),
});
export type DuitkuCallback = z.infer<typeof callbackSchema>;

/** Callback sah bila kode merchant cocok dan tanda tangan benar. */
export function verifyCallback(cb: Pick<DuitkuCallback, 'merchantCode' | 'amount' | 'merchantOrderId' | 'signature'>): boolean {
  const cfg = duitkuConfig();
  if (cb.merchantCode !== cfg.merchantCode) return false;
  return signatureEquals(cb.signature, callbackSignature(cfg.merchantCode, cb.amount, cb.merchantOrderId, cfg.apiKey));
}

/** Simulator: buat body callback bertanda tangan seperti yang dikirim Duitku. */
export function simulatorCallback(order: { merchantOrderId: string; amount: number; reference: string }, success: boolean): DuitkuCallback {
  const cfg = duitkuConfig();
  if (cfg.mode !== 'simulator') throw new AppError('NOT_FOUND', 'Tidak ditemukan');
  const amount = String(order.amount);
  return {
    merchantCode: cfg.merchantCode,
    amount,
    merchantOrderId: order.merchantOrderId,
    resultCode: success ? '00' : '01',
    reference: order.reference,
    paymentCode: 'SIM',
    signature: callbackSignature(cfg.merchantCode, amount, order.merchantOrderId, cfg.apiKey),
  };
}
