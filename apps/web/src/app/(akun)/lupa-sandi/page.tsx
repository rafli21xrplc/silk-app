'use client';

import { Mail } from 'lucide-react';
import { useState } from 'react';
import { AuthAlert, AuthFooter, AuthHeading, AuthInput, BackToLogin, SubmitButton } from '@/components/auth/auth-ui';
import { authApi } from '@/lib/client-api';
import { SITE_URL } from '@/lib/config';
import { t } from '@/messages/id';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await authApi('/request-password-reset', { email: String(form.get('email')), redirectTo: `${SITE_URL}/atur-ulang-sandi` });
    } catch {
      // Jawaban selalu sama agar tidak membocorkan email terdaftar.
    }
    setBusy(false);
    setSent(true);
  }
  return (
    <>
      <title>{`${t.auth.forgotTitle} | ${t.site.name}`}</title>
      <meta name="robots" content="noindex" />
      <AuthHeading title={t.auth.forgotTitle} subtitle={t.auth.forgotSubtitle} />
      {sent ? (
        <AuthAlert tone="ok">{t.auth.resetSent}</AuthAlert>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-5">
          <AuthInput label={t.auth.email} icon={Mail} name="email" type="email" autoComplete="email" placeholder={t.auth.emailPlaceholder} required />
          <SubmitButton busy={busy}>{t.auth.sendLink}</SubmitButton>
        </form>
      )}
      <AuthFooter>
        <BackToLogin />
      </AuthFooter>
    </>
  );
}
