/** Kata yang bukan bagian nama inti: gelar depan dan penanda data contoh ("Contoh"). */
const NOT_NAME = /^(dr|drg|prof|ns|apt|bd|contoh)\.?$/i;

/** Inisial dari nama inti, tanpa gelar dan penanda contoh ("dr. Contoh Rahma Putri, Sp.A" → "RP"). */
export function doctorInitials(name: string): string {
  const words = name
    .split(',')[0]!
    .split(/\s+/)
    .filter((w) => w && !NOT_NAME.test(w) && /\p{L}/u.test(w));
  const core = words.length > 0 ? words : name.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  return core
    .slice(0, 2)
    .map((w) => w.match(/\p{L}/u)![0]!.toUpperCase())
    .join('');
}

/** Pasangan warna lembut dari token tema (latar + tinta, kontras AA). */
export const AVATAR_TONES = [
  'bg-mint text-mint-ink',
  'bg-sky text-sky-ink',
  'bg-peach text-peach-ink',
  'bg-lilac text-lilac-ink',
  'bg-lemon text-lemon-ink',
  'bg-primary-50 text-primary-700',
] as const;

/** Warna avatar yang stabil per nama, agar daftar dokter tanpa foto tidak tampak seragam. */
export function avatarTone(name: string): (typeof AVATAR_TONES)[number] {
  // FNV-1a: sebaran lebih rata untuk nama yang berawalan sama ("dr. Contoh …").
  let h = 0x811c9dc5;
  for (const ch of name.normalize('NFC')) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}

type DoctorDetailLike = {
  strVerifiedAt: string | null;
  verification?: { str: boolean; partner: boolean };
  photo?: unknown;
  about?: string | null;
  contact?: unknown;
  video?: unknown;
  practices?: unknown[];
  tariffs?: unknown[];
  consultation?: unknown;
  articles?: unknown[];
};

/**
 * Respons detail dokter dari data cache lama (sebelum Fase 4b) hanya punya nama, spesialisasi, STR, dan
 * daftar faskes. Isi field baru dengan nilai kosong agar halaman tidak error sampai cache diperbarui.
 */
export function withDoctorDefaults<T extends DoctorDetailLike>(p: T): T & Required<Pick<T, keyof DoctorDetailLike>> {
  return {
    ...p,
    verification: p.verification ?? { str: p.strVerifiedAt !== null, partner: false },
    photo: p.photo ?? null,
    about: p.about ?? null,
    contact: p.contact ?? null,
    video: p.video ?? null,
    practices: p.practices ?? [],
    tariffs: p.tariffs ?? [],
    consultation: p.consultation ?? null,
    articles: p.articles ?? [],
  } as T & Required<Pick<T, keyof DoctorDetailLike>>;
}
