'use client';

import Link from 'next/link';
import { KeyRound, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AuthAlert, AuthFooter, AuthHeading, AuthInput, PasswordInput, SubmitButton } from '@/components/auth/auth-ui';
import { useCaptcha } from '@/components/turnstile';
import { authApi, ClientApiError, errorMessage } from '@/lib/client-api';
import { clearQueryCache, queryCache } from '@/lib/query-cache';
import { homePathFor } from '@/lib/role-home';
import type { Me } from '@/lib/types';
import { safeReturnPath } from '@/lib/use-me';
import { t } from '@/messages/id';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<'password' | 'totp'>('password');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useCaptcha();

  async function afterLogin() {
    // Sesi baru: buang cache akun sebelumnya, lalu isi /me agar halaman tujuan langsung tampil.
    clearQueryCache();
    const { data } = await queryCache.fetchQuery<Me>('/me');
    router.replace(safeReturnPath(params.get('kembali'), homePathFor(data.user)));
  }

  async function onPassword(e: React.FormEvent<HTMLFormElement>) {
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
      const res = await authApi<{ twoFactorRedirect?: boolean }>(
        '/sign-in/email',
        { email, password: String(form.get('password')) },
        { headers: captcha.headers },
      );
      if (res.twoFactorRedirect) setStep('totp');
      else await afterLogin();
    } catch (err) {
      // Email belum diverifikasi: API sudah mengirim OTP baru, lanjutkan ke halaman verifikasi.
      if (err instanceof ClientApiError && err.body.code === 'EMAIL_NOT_VERIFIED') {
        router.push(`/verifikasi-email?email=${encodeURIComponent(email)}&dikirim=1`);
        return;
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      captcha.reset();
    }
  }

  async function onTotp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await authApi('/two-factor/verify-totp', { code: String(form.get('code')).replace(/\s/g, '') });
      await afterLogin();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function backToPassword() {
    setError(null);
    setStep('password');
  }

  if (step === 'totp') {
    return (
      <>
        <AuthHeading step={t.auth.step(2, 2)} title={t.auth.totpTitle} subtitle={t.auth.totpSubtitle} />
        <form onSubmit={onTotp} className="grid gap-5">
          {error && <AuthAlert tone="error">{error}</AuthAlert>}
          <AuthInput
            label={t.auth.totpCode}
            icon={KeyRound}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            placeholder="000000"
            required
            autoFocus
            inputClassName="font-mono text-xl tracking-[0.4em] placeholder:tracking-[0.4em]"
          />
          <SubmitButton busy={busy}>{t.auth.verify}</SubmitButton>
        </form>
        <AuthFooter>
          <button type="button" onClick={backToPassword} className="font-semibold text-primary-700 hover:text-primary-800 hover:underline">
            {t.auth.usePassword}
          </button>
        </AuthFooter>
      </>
    );
  }

  return (
    <>
      <AuthHeading title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle} />
      <form onSubmit={onPassword} className="grid gap-5">
        {params.get('terverifikasi') && <AuthAlert tone="ok">{t.auth.verified}</AuthAlert>}
        {params.get('sandi') === 'baru' && <AuthAlert tone="ok">{t.auth.resetDone}</AuthAlert>}
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        <AuthInput label={t.auth.email} icon={Mail} name="email" type="email" autoComplete="email" placeholder={t.auth.emailPlaceholder} required />
        <PasswordInput
          label={t.auth.password}
          name="password"
          autoComplete="current-password"
          required
          aside={
            <Link href="/lupa-sandi" className="text-sm font-semibold no-underline hover:underline">
              {t.auth.forgot}
            </Link>
          }
        />
        {captcha.widget}
        <SubmitButton busy={busy}>{t.auth.login}</SubmitButton>
      </form>
      <AuthFooter>
        {t.auth.noAccount}{' '}
        <Link href="/daftar" className="font-semibold">
          {t.auth.register}
        </Link>
      </AuthFooter>
    </>
  );
}
