/** Halaman akun tampil polos tanpa navbar dan footer situs. */
export const ACCOUNT_PATHS = ['/masuk', '/daftar', '/verifikasi-email', '/lupa-sandi', '/atur-ulang-sandi'] as const;

export function isAccountPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return ACCOUNT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
