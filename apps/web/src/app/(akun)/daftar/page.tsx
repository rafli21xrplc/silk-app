'use client';

import Link from 'next/link';
import { Mail, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ACCOUNT_TYPES, type AccountType } from '@silk/shared';
import { AccountTypePicker } from '@/components/auth/account-type-picker';
import { AuthAlert, AuthFooter, AuthHeading, AuthInput, PasswordInput, SubmitButton } from '@/components/auth/auth-ui';
import { useCaptcha } from '@/components/turnstile';
import { authApi, errorMessage } from '@/lib/client-api';
import { t } from '@/messages/id';

export default function RegisterPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>('pasien');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useCaptcha();
  // Tautan "Daftar sebagai …" (halaman mitra, footer) memilihkan jenis akun lewat ?jenis=.
  useEffect(() => {
    const jenis = new URLSearchParams(window.location.search).get('jenis');
    if (jenis && (ACCOUNT_TYPES as readonly string[]).includes(jenis)) setAccountType(jenis as AccountType);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!captcha.ready) {
      setError(t.auth.captchaRequired);
      return;
    }
    const email = String(form.get('email'));
    setBusy(true);
    setError(null);
    try {
      // Role ditetapkan server dari accountType; kode OTP dikirim otomatis setelah daftar.
      await authApi(
        '/sign-up/email',
        { name: String(form.get('name')), email, password: String(form.get('password')), accountType },
        { headers: captcha.headers },
      );
      router.push(`/verifikasi-email?email=${encodeURIComponent(email)}&dikirim=1`);
    } catch (err) {
      setError(errorMessage(err));
      captcha.reset();
      setBusy(false);
    }
  }

  return (
    <>
      <title>{`${t.auth.registerTitle} | ${t.site.name}`}</title>
      <meta name="robots" content="noindex" />
      <AuthHeading title={t.auth.registerTitle} subtitle={t.auth.registerSubtitle} />
      <form onSubmit={onSubmit} className="grid gap-5">
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        <AccountTypePicker value={accountType} onChange={setAccountType} />
        <AuthInput label={t.auth.name} icon={UserRound} name="name" autoComplete="name" placeholder={t.auth.namePlaceholder} required minLength={2} maxLength={100} />
        <AuthInput label={t.auth.email} icon={Mail} name="email" type="email" autoComplete="email" placeholder={t.auth.emailPlaceholder} required />
        <PasswordInput label={t.auth.password} name="password" autoComplete="new-password" minLength={12} maxLength={128} required hint={t.auth.passwordHelp} />
        <label className="flex items-start gap-2.5 text-[0.95rem] text-ink-soft">
          <input type="checkbox" name="consent" required />
          <span>
            {t.auth.consent} <Link href="/privasi">{t.footer.privacy}</Link>
          </span>
        </label>
        {captcha.widget}
        <SubmitButton busy={busy}>{t.auth.register}</SubmitButton>
      </form>
      <AuthFooter>
        {t.auth.haveAccount}{' '}
        <Link href="/masuk" className="font-semibold">
          {t.auth.login}
        </Link>
      </AuthFooter>
    </>
  );
}
