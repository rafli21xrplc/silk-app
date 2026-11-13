import { formatPrice, formatRupiah, type PriceValue } from '@silk/shared';
import { t } from '../messages/id';

const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
const shortDateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });

/** Tanggal di zona Asia/Jakarta. `YYYY-MM-DD` dianggap tanggal kalender, bukan tengah malam UTC. */
function toDate(value: string | Date): Date {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+07:00`) : new Date(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '–';
  const d = toDate(value);
  return Number.isNaN(d.getTime()) ? '–' : dateFmt.format(d);
}

export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return '–';
  const d = toDate(value);
  return Number.isNaN(d.getTime()) ? '–' : shortDateFmt.format(d);
}

/** Durasi video "m:ss" (45 → "0:45"). */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Teks harga sesuai jenisnya; "tanya" tidak pernah tampil sebagai angka. */
export const priceText = (price: PriceValue) => formatPrice(price, { ask: t.price.ask, from: t.price.from });

/** Rentang: satu angka bila min = max; null bila belum ada harga. Tanda pisah sama dengan `formatPrice`. */
export function priceRangeText(min: number | null, max: number | null): string | null {
  if (min === null) return null;
  const hi = max ?? min;
  return hi === min ? formatRupiah(min) : `${formatRupiah(min)}–${formatRupiah(hi)}`;
}

const compactNum = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

/**
 * Rentang ringkas untuk daftar ringkasan (beranda, katalog): "Rp15–45 rb", "Rp1,2–3,5 jt".
 * Di profil faskes dan daftar banding harga tetap ditulis penuh.
 */
export function priceRangeShort(min: number | null, max: number | null): string | null {
  if (min === null) return null;
  const hi = Math.max(max ?? min, min);
  if (min < 1000) return priceRangeText(min, hi);
  const short = (n: number): [string, string] => (n >= 1_000_000 ? [compactNum.format(n / 1_000_000), 'jt'] : [compactNum.format(n / 1000), 'rb']);
  const [a, ua] = short(min);
  const [b, ub] = short(hi);
  if (a === b && ua === ub) return `Rp${a} ${ua}`;
  return ua === ub ? `Rp${a}–${b} ${ub}` : `Rp${a} ${ua}–${b} ${ub}`;
}

/** Jam "08:00" → "08.00" (gaya penulisan waktu Indonesia). */
export const formatTime = (hhmm: string) => hhmm.slice(0, 5).replace(':', '.');
