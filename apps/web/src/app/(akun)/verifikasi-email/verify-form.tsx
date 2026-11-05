'use client';

import { Mail, RotateCw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AuthAlert, AuthFooter, AuthHeading, AuthInput, BackToLogin, SubmitButton } from '@/components/auth/auth-ui';
import { OtpInput } from '@/components/auth/otp-input';
import { useCaptcha } from '@/components/turnstile';
import { authApi, ClientApiError, errorMessage } from '@/lib/client-api';
import { t } from '@/messages/id';

const OTP_LENGTH = 6;

export function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const fromQuery = params.get('email') ?? '';
  const [email, setEmail] = useState(fromQuery);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(params.get('dikirim') ? t.auth.checkEmail : null);
  const [error, setError] = useState<string | null>(null);
  const captcha = useCaptcha();

  async function onVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (otp.length !== OTP_LENGTH) return;
    setBusy(true);
    setError(null);
    try {
      await authApi('/email-otp/verify-email', { email, otp });
      router.replace('/masuk?terverifikasi=1');
    } catch (err) {
      // Pesan seragam: tidak membedakan kode salah, kedaluwarsa, atau terlalu banyak percobaan.
      setError(err instanceof ClientApiError && err.status < 500 ? t.auth.otpInvalid : errorMessage(err));
      setOtp('');
      setBusy(false);
    }
  }

  async function onResend() {
    if (!email) return;
    if (!captcha.ready) {
      setError(t.auth.captchaRequired);
      return;
    }
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await authApi('/email-otp/send-verification-otp', { email, type: 'email-verification' }, { headers: captcha.headers });
      setNotice(t.auth.otpResent);
      setOtp('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending(false);
      captcha.reset();
    }
  }

  return (
    <>
      <AuthHeading title={t.auth.otpTitle} subtitle={fromQuery ? t.auth.otpSubtitle(fromQuery) : t.auth.otpSubtitleNoEmail} />
      <form onSubmit={onVerify} className="grid gap-5">
        {notice && <AuthAlert tone="ok">{notice}</AuthAlert>}
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        {!fromQuery && (
          <AuthInput
            label={t.auth.email}
            icon={Mail}
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t.auth.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        )}
        <OtpInput value={otp} onChange={setOtp} length={OTP_LENGTH} disabled={busy} />
        <SubmitButton busy={busy}>{t.auth.verify}</SubmitButton>
      </form>
      <div className="mt-5 grid justify-items-center gap-3">
        {captcha.widget}
        <button
          type="button"
          onClick={() => void onResend()}
          disabled={resending || !email}
          className="inline-flex items-center gap-1.5 font-semibold text-primary-700 hover:text-primary-800 hover:underline disabled:opacity-60"
        >
          <RotateCw className={resending ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
          {t.auth.otpResend}
        </button>
      </div>
      <AuthFooter>
        <BackToLogin />
      </AuthFooter>
    </>
  );
}
