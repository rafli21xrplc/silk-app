/** Inisial dari nama tanpa gelar ("dr. Contoh Rahma, Sp.A" → "CR"). */
export function doctorInitials(name: string): string {
  const words = name
    .split(',')[0]!
    .split(/\s+/)
    .filter((w) => w && !/^(dr|drg|prof|ns|apt)\.?$/i.test(w));
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
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
    articles: p.articles ?? [],
  } as T & Required<Pick<T, keyof DoctorDetailLike>>;
}
