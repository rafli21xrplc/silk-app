import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthHeading } from '@/components/auth/auth-ui';
import { t } from '@/messages/id';
import { VerifyEmailForm } from './verify-form';

export const metadata: Metadata = { title: t.auth.otpTitle, robots: { index: false } };

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthHeading title={t.auth.otpTitle} subtitle={t.auth.otpSubtitleNoEmail} />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
