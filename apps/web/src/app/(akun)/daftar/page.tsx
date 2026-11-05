'use client';

import Link from 'next/link';
import { Mail, UserRound } from 'lucide-react';
import { useState } from 'react';
import { AuthAlert, AuthFooter, AuthHeading, AuthInput, BackToLogin, PasswordInput, SubmitButton } from '@/components/auth/auth-ui';
import { authApi, errorMessage } from '@/lib/client-api';
import { SITE_URL } from '@/lib/config';
import { t } from '@/messages/id';

export default function RegisterPage() {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await authApi('/sign-up/email', {
        name: String(form.get('name')),
        email: String(form.get('email')),
        password: String(form.get('password')),
        callbackURL: `${SITE_URL}/masuk?terverifikasi=1`,
      });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <title>{`${t.auth.registerTitle} | ${t.site.name}`}</title>
      <meta name="robots" content="noindex" />
      <AuthHeading title={t.auth.registerTitle} subtitle={t.auth.registerSubtitle} />
      {done ? (
        <>
          <AuthAlert tone="ok">{t.auth.checkEmail}</AuthAlert>
          <AuthFooter>
            <BackToLogin />
          </AuthFooter>
        </>
      ) : (
        <>
          <form onSubmit={onSubmit} className="grid gap-5">
            {error && <AuthAlert tone="error">{error}</AuthAlert>}
            <AuthInput label={t.auth.name} icon={UserRound} name="name" autoComplete="name" placeholder={t.auth.namePlaceholder} required maxLength={100} />
            <AuthInput label={t.auth.email} icon={Mail} name="email" type="email" autoComplete="email" placeholder={t.auth.emailPlaceholder} required />
            <PasswordInput label={t.auth.password} name="password" autoComplete="new-password" minLength={12} required hint={t.auth.passwordHelp} />
            <label className="flex items-start gap-2.5 text-[0.95rem] text-ink-soft">
              <input type="checkbox" name="consent" required />
              <span>
                {t.auth.consent} <Link href="/privasi">{t.footer.privacy}</Link>
              </span>
            </label>
            <SubmitButton busy={busy}>{t.auth.register}</SubmitButton>
          </form>
          <AuthFooter>
            {t.auth.haveAccount}{' '}
            <Link href="/masuk" className="font-semibold">
              {t.auth.login}
            </Link>
          </AuthFooter>
        </>
      )}
    </>
  );
}
