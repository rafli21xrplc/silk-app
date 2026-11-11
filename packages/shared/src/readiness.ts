import type { EntityStatus, FacilityType } from './constants';

/**
 * Kesiapan profil terhadap USP "Tahu biayanya, kenal dokternya, sebelum datang" (lanjutan evaluasi USP).
 * Dihitung dari fakta yang sama dengan yang dilihat pasien di halaman publik: tarif dari VIEW
 * `published_tariffs`, media yang disetujui, dan video yang persetujuannya masih aktif.
 * Hanya panduan untuk mitra; tidak pernah memengaruhi urutan atau tampilan publik.
 */

/** Tiga pilar = tiga bagian kalimat USP. */
export const READINESS_PILLARS = ['biaya', 'kenal', 'kunjungan'] as const;
export type ReadinessPillar = (typeof READINESS_PILLARS)[number];

export const READINESS_ITEMS = [
  'biaya_konsultasi',
  'tarif',
  'foto',
  'video',
  'dokter_terdaftar',
  'jadwal',
  'lokasi',
  'kontak',
  'deskripsi',
] as const;
export type ReadinessItem = (typeof READINESS_ITEMS)[number];

/** Jumlah tarif berangka minimum agar faskes dianggap "biayanya jelas". */
export const READINESS_MIN_TARIFFS = 3;

export type MediaReadiness = 'publik' | 'menunggu' | 'tidak_ada';
/** `tanpa_persetujuan`: video disetujui tetapi persetujuannya tidak aktif, jadi tidak tampil publik. */
export type VideoReadiness = MediaReadiness | 'tanpa_persetujuan';
/** `tanya`: biaya hanya "hubungi faskes", tanpa angka. */
export type ConsultationReadiness = 'angka' | 'tanya' | 'tidak_ada';

export interface ReadinessFacts {
  type: FacilityType;
  status: EntityStatus;
  photo: MediaReadiness;
  video: VideoReadiness;
  consultation: ConsultationReadiness;
  /** Tarif terbit berangka (bukan "tanya"), semua kategori. */
  pricedTariffs: number;
  /** Dokter terbit yang tertaut ke profil ini. */
  practitioners: number;
  hasSchedule: boolean;
  hasLocation: boolean;
  hasContact: boolean;
  hasDescription: boolean;
}

export interface ReadinessCheck {
  item: ReadinessItem;
  pillar: ReadinessPillar;
  done: boolean;
  /** Keadaan rinci untuk petunjuk (mis. video menunggu moderasi). */
  state: string;
  /** Disarankan, bukan syarat pilar. */
  optional: boolean;
}

export interface Readiness {
  /** Profil sudah terbit; selain itu pasien belum melihat apa pun. */
  published: boolean;
  checks: ReadinessCheck[];
  done: number;
  total: number;
  /** Pilar terpenuhi bila semua butir wajibnya selesai. */
  pillars: Record<ReadinessPillar, boolean>;
}

const WITH_DOCTORS: readonly FacilityType[] = ['rumah_sakit', 'klinik', 'puskesmas'];

export function profileReadiness(f: ReadinessFacts): Readiness {
  const doctor = f.type === 'praktik_dokter';
  const checks: ReadinessCheck[] = [];
  const add = (item: ReadinessItem, pillar: ReadinessPillar, done: boolean, state: string, optional = false) =>
    checks.push({ item, pillar, done, state, optional });

  if (doctor) add('biaya_konsultasi', 'biaya', f.consultation === 'angka', f.consultation);
  else add('tarif', 'biaya', f.pricedTariffs >= READINESS_MIN_TARIFFS, String(f.pricedTariffs));

  add('foto', 'kenal', f.photo === 'publik', f.photo);
  // Video perkenalan adalah pembeda utama untuk dokter; untuk tempat lain hanya disarankan.
  add('video', 'kenal', f.video === 'publik', f.video, !doctor);
  if (WITH_DOCTORS.includes(f.type)) add('dokter_terdaftar', 'kenal', f.practitioners > 0, String(f.practitioners), true);

  add('jadwal', 'kunjungan', f.hasSchedule, f.hasSchedule ? 'ada' : 'tidak_ada');
  add('lokasi', 'kunjungan', f.hasLocation, f.hasLocation ? 'ada' : 'tidak_ada');
  add('kontak', 'kunjungan', f.hasContact, f.hasContact ? 'ada' : 'tidak_ada');
  add('deskripsi', 'kunjungan', f.hasDescription, f.hasDescription ? 'ada' : 'tidak_ada', true);

  const pillars = Object.fromEntries(
    READINESS_PILLARS.map((p) => [p, checks.filter((c) => c.pillar === p && !c.optional).every((c) => c.done)]),
  ) as Record<ReadinessPillar, boolean>;
  return {
    published: f.status === 'terbit',
    checks,
    done: checks.filter((c) => c.done).length,
    total: checks.length,
    pillars,
  };
}
