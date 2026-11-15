/** Halaman akun tampil polos tanpa navbar dan footer situs. */
export const ACCOUNT_PATHS = ['/masuk', '/daftar', '/verifikasi-email', '/lupa-sandi', '/atur-ulang-sandi'] as const;

export function isAccountPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return ACCOUNT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Area aplikasi (admin, portal mitra, akun) memakai kerangka sendiri: sidebar + topbar, tanpa navbar/footer situs. */
export const APP_AREA_PATHS = ['/admin', '/portal', '/akun'] as const;

export function isAppAreaPath(pathname: string | null): boolean {
  if (!pathname) return false;
  // Aktivasi MFA tampil sebelum kerangka admin bisa dibuka; tetap dengan navbar situs.
  if (pathname === '/admin/mfa') return false;
  return APP_AREA_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
