import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthHeading } from '@/components/auth/auth-ui';
import { t } from '@/messages/id';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: t.auth.loginTitle, robots: { index: false } };

export default function LoginPage() {
  return (
    // Judul ada di dalam form (berganti saat langkah verifikasi); fallback menjaga judul tetap ada di HTML awal.
    <Suspense fallback={<AuthHeading title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle} />}>
      <LoginForm />
    </Suspense>
  );
}
