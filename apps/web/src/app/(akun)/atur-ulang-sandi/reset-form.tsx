'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AuthAlert, PasswordInput, SubmitButton } from '@/components/auth/auth-ui';
import { authApi, errorMessage } from '@/lib/client-api';
import { t } from '@/messages/id';

export function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token');
  const [error, setError] = useState<string | null>(params.get('error') ? t.auth.resetInvalid : null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await authApi('/reset-password', { token, newPassword: String(form.get('password')) });
      router.replace('/masuk?sandi=baru');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!token) return <AuthAlert tone="error">{error ?? t.auth.resetInvalid}</AuthAlert>;
  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      <PasswordInput label={t.auth.newPassword} name="password" autoComplete="new-password" minLength={12} required hint={t.auth.passwordHelp} />
      <SubmitButton busy={busy}>{t.auth.save}</SubmitButton>
    </form>
  );
}
