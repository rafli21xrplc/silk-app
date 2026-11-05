import { z } from 'zod';
import { checkPriceFields } from '../price';
import { priceTypeSchema, slugSchema } from './common';

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

/** Angka rupiah dari CSV: terima "350000", "350.000", "Rp350.000". */
const csvRupiah = z.preprocess((v) => {
  const n = emptyToNull(v);
  if (n === null || n === undefined) return null;
  if (typeof n !== 'string') return n;
  const digits = n.replace(/^rp\s*/i, '').replace(/[.\s]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : n;
}, z.number({ message: 'Harus angka rupiah bulat' }).int().nonnegative().max(1_000_000_000_000).nullable());

/**
 * Satu baris CSV impor (M5, M6). Kolom:
 * facility_name, city, service_slug, price_type, price_min, price_max, effective_from, source_title, source_url
 */
export const csvRowSchema = z
  .object({
    facility_name: z.string().trim().min(2, 'Nama faskes wajib').max(200),
    city: z.string().trim().min(2, 'Kota wajib').max(100),
    service_slug: slugSchema,
    price_type: priceTypeSchema,
    price_min: csvRupiah,
    price_max: csvRupiah,
    effective_from: z.iso.date({ message: 'Format tanggal YYYY-MM-DD' }),
    source_title: z.string().trim().min(2, 'Judul sumber wajib').max(300),
    source_url: z.preprocess(emptyToNull, z.url().max(500).nullable()),
  })
  .superRefine((v, ctx) => {
    // Impor CSV tidak membawa komponen paket; tipe paket diperlakukan sebagai harga tetap paket.
    for (const issue of checkPriceFields({
      priceType: v.price_type,
      priceMin: v.price_min,
      priceMax: v.price_max,
      hasPackage: true,
    })) {
      const path = issue.path === 'priceMin' ? 'price_min' : issue.path === 'priceMax' ? 'price_max' : 'price_type';
      ctx.addIssue({ code: 'custom', path: [path], message: issue.message });
    }
  });
export type CsvRow = z.infer<typeof csvRowSchema>;

export interface ImportRowError {
  field: string;
  code: string;
  message: string;
}
