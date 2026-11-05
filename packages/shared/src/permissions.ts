import { PARTNER_ROLES, USER_ROLES, type UserRole } from './constants';

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
  /** Portal faskes M6 dan klaim M7 (ditambah cek `memberships`). */
  'portal.facility': ['faskes'],
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
