import type { PortableBlock } from './sanity';

/** Kecepatan baca rata-rata (kata per menit) untuk estimasi waktu baca. */
const WORDS_PER_MINUTE = 200;

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

const blockText = (b: PortableBlock) => (b.children ?? []).map((c) => c.text ?? '').join('');

/** Slug judul untuk anchor: huruf kecil, tanpa aksen, tanda baca jadi "-". */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'bagian'
  );
}

export interface TocItem {
  id: string;
  text: string;
}

/**
 * Id anchor untuk setiap subjudul h2 (kunci = indeks blok). Dipakai bersama oleh daftar isi dan
 * renderer isi agar selalu cocok; judul kembar diberi akhiran -2, -3.
 */
export function headingIds(blocks: PortableBlock[]): Map<number, TocItem> {
  const seen = new Map<string, number>();
  const out = new Map<number, TocItem>();
  blocks.forEach((b, i) => {
    if (b._type !== 'block' || b.style !== 'h2' || b.listItem) return;
    const text = blockText(b).trim();
    if (!text) return;
    const base = slugify(text);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.set(i, { id: n === 1 ? base : `${base}-${n}`, text });
  });
  return out;
}

export const tocOf = (blocks: PortableBlock[]): TocItem[] => [...headingIds(blocks).values()];

/** Pilih indeks tema sampul secara deterministik dari slug (warna sama setiap kali dirender). */
export function themeIndex(slug: string, count: number): number {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % count;
}
