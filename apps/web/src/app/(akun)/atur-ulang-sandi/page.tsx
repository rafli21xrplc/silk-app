import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthFooter, AuthHeading, BackToLogin } from '@/components/auth/auth-ui';
import { t } from '@/messages/id';
import { ResetForm } from './reset-form';

export const metadata: Metadata = { title: t.auth.resetTitle, robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeading title={t.auth.resetTitle} subtitle={t.auth.resetSubtitle} />
      <Suspense>
        <ResetForm />
      </Suspense>
      <AuthFooter>
        <BackToLogin />
      </AuthFooter>
    </>
  );
}
