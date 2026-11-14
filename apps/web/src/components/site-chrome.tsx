'use client';

import { usePathname } from 'next/navigation';
import { isAccountPath, isAppAreaPath } from '@/lib/account-paths';

/** Bungkus navbar/footer situs: tidak dirender di halaman akun (masuk, daftar, sandi) dan area admin/portal. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return isAccountPath(pathname) || isAppAreaPath(pathname) ? null : <>{children}</>;
}
