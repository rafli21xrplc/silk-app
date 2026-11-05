import { isPartnerRole, isStaffRole, type UserRole } from '@silk/shared';

/** Area halaman yang dibatasi per role (tampilan saja; penegakan tetap di API). */
export type AreaRequirement = 'signed-in' | 'faskes' | 'partner' | 'staff';

/** Halaman awal setelah masuk, per role. Staf tanpa TOTP diarahkan ke pengaturan MFA. */
export function homePathFor(user: { role: UserRole; twoFactorEnabled: boolean }): string {
  if (isStaffRole(user.role)) return user.twoFactorEnabled ? '/admin' : '/admin/mfa';
  if (user.role === 'faskes') return '/portal';
  if (isPartnerRole(user.role)) return '/portal/mitra';
  return '/akun';
}

export function roleAllowed(requirement: AreaRequirement, role: UserRole): boolean {
  switch (requirement) {
    case 'signed-in':
      return true;
    case 'faskes':
      return role === 'faskes';
    case 'partner':
      return isPartnerRole(role);
    case 'staff':
      return isStaffRole(role);
  }
}
