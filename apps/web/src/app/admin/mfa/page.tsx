'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { useState } from 'react';
import { FormError, Loading } from '@/components/app-shell';
import { authApi, errorMessage } from '@/lib/client-api';
import { useMe } from '@/lib/use-me';
import { t } from '@/messages/id';

/** Aktivasi TOTP wajib untuk admin dan moderator (bagian 8). */
export default function MfaSetupPage() {
  const { me, error } = useMe({ require: 'staff' });
  const [setup, setSetup] = useState<{ qr: string; secret: string; backupCodes: string[] } | null>(
    null,
  );
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!me) return <Loading error={error} />;

  async function generate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const res = await authApi<{ totpURI: string; backupCodes: string[] }>('/two-factor/enable', {
        password: String(new FormData(e.currentTarget).get('password')),
      });
      const secret = new URL(res.totpURI).searchParams.get('secret') ?? '';
      setSetup({
        qr: await QRCode.toDataURL(res.totpURI, { margin: 1, width: 220 }),
        secret,
        backupCodes: res.backupCodes,
      });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await authApi('/two-factor/verify-totp', {
        code: String(new FormData(e.currentTarget).get('code')).replace(/\s/g, ''),
      });
      setDone(true);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container narrow stack">
      <h1>{t.mfa.title}</h1>
      <p>{t.mfa.intro}</p>
      <FormError error={formError} />
      {me.user.twoFactorEnabled || done ? (
        <>
          <p className="success" role="status">
            {t.mfa.done}
          </p>
          <p>
            <Link href="/admin">{t.admin.title}</Link>
          </p>
        </>
      ) : !setup ? (
        <form onSubmit={generate} className="stack card">
          <p>{t.mfa.step1}</p>
          <label>
            {t.auth.password}
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>
            {t.mfa.generate}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="stack card">
          <p>{t.mfa.step2}</p>
          <img src={setup.qr} alt="Kode QR TOTP" width={220} height={220} />
          <p className="small">
            {t.mfa.manual} <code>{setup.secret}</code>
          </p>
          <p className="small">{t.mfa.backup}</p>
          <pre className="code">{setup.backupCodes.join('\n')}</pre>
          <label>
            {t.auth.totpCode}
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              required
            />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>
            {t.auth.verify}
          </button>
        </form>
      )}
    </div>
  );
}
