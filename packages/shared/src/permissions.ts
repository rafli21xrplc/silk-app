import { ARTICLE_AUTHOR_ROLES, PARTNER_ROLES, USER_ROLES, type UserRole } from './constants';

/**
 * Matriks role × permission (Fase 1, docs/enablement/01-rencana-fase-1.md bagian 5). Satu-satunya sumber;
 * API menegakkannya lewat `requirePermission()`, web memakainya untuk menampilkan menu.
 * `anonim` = pengunjung tanpa sesi.
 */
export type Actor = UserRole | 'anonim';

const ALL: readonly Actor[] = ['anonim', ...USER_ROLES];
const SIGNED_IN: readonly Actor[] = USER_ROLES;
const NON_STAFF_SIGNED_IN: readonly Actor[] = ['pasien', ...PARTNER_ROLES];

export const PERMISSIONS = {
  /** Endpoint publik (faskes, layanan, perbandingan, riwayat tarif). */
  'public.read': ALL,
  /** Lapor data salah (M14, Turnstile). */
  'report.create': ALL,
  /** `/v1/me`, ubah nama/telepon, ubah sandi, keluar. */
  'account.self': SIGNED_IN,
  /** Data usaha dan izin mitra milik sendiri (`/v1/partners/me`). */
  'partner.self': PARTNER_ROLES,
  /** Portal profil layanan (M6, Fase 2) untuk semua mitra; akses per profil dicek lewat `memberships`. */
  'portal.facility': PARTNER_ROLES,
  /** Menulis artikel edukasi (F-05, Fase 4); hanya mitra terverifikasi, dicek di service. */
  'portal.articles': ARTICLE_AUTHOR_ROLES,
  /** Klaim profil faskes yang sudah ada (M7). */
  'portal.claims': ['faskes'],
  /** Seluruh `/v1/admin/*` (wajib TOTP). */
  'admin.access': ['moderator', 'admin'],
  /** Antrean dan keputusan verifikasi mitra (wajib TOTP). */
  'admin.partners': ['moderator', 'admin'],
  /** Ubah role, blokir akun (endpoint admin Better Auth, wajib TOTP). */
  'admin.users': ['admin'],
  /** Terbitkan JWT (`/v1/auth/token`). Staf hanya lewat sesi cookie + TOTP. */
  'auth.token': NON_STAFF_SIGNED_IN,
} as const satisfies Record<string, readonly Actor[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Actor[]).includes(actor ?? 'anonim');
}
