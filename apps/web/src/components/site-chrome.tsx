'use client';

import { usePathname } from 'next/navigation';
import { isAccountPath } from '@/lib/account-paths';

/** Bungkus navbar/footer situs: tidak dirender di halaman akun (masuk, daftar, sandi). */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return isAccountPath(usePathname()) ? null : <>{children}</>;
}
