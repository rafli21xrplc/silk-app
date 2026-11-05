'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { accountNav } from '@/components/account-nav';
import { AppShell, FormError, Loading } from '@/components/app-shell';
import { buttonVariants } from '@/components/ui/button';
import { api, authApi, errorMessage } from '@/lib/client-api';
import { clearQueryCache, queryCache } from '@/lib/query-cache';
import type { Me } from '@/lib/types';
import { useMe } from '@/lib/use-me';
import { t } from '@/messages/id';

export default function AccountPage() {
  const { me, error } = useMe();
  if (!me) return <Loading error={error} />;
  return (
    <AppShell me={me} title={t.account.title} nav={accountNav(me)}>
      <div className="grid max-w-2xl gap-6">
        <ProfileCard me={me} />
        <PasswordCard />
        <SessionsCard />
      </div>
    </AppShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
      <h2 className="mt-0 mb-4 text-lg">{title}</h2>
      {children}
    </section>
  );
}

function ProfileCard({ me }: { me: Me }) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api('PATCH', '/me', { name: String(f.get('name')).trim(), phone: String(f.get('phone')).trim() || null });
      queryCache.invalidate('/me');
      await queryCache.fetchQuery<Me>('/me');
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title={t.account.profile}>
      <dl className="mt-0 mb-5 grid gap-x-6 gap-y-1 sm:grid-cols-[max-content_1fr]">
        <dt className="text-muted">{t.account.emailLabel}</dt>
        <dd className="m-0 break-all">{me.user.email}</dd>
        <dt className="text-muted">{t.account.roleLabel}</dt>
        <dd className="m-0">{t.account.roles[me.user.role] ?? me.user.role}</dd>
      </dl>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError error={error} />
        {saved && <p role="status" className="m-0 text-primary-700">{t.account.profileSaved}</p>}
        <label className="grid gap-1.5">
          {t.auth.name}
          <input name="name" defaultValue={me.user.name} autoComplete="name" required minLength={2} maxLength={100} />
        </label>
        <label className="grid gap-1.5">
          {t.account.phone}
          <input name="phone" type="tel" inputMode="tel" defaultValue={me.user.phone ?? ''} autoComplete="tel" pattern="(\+?62|0)8[0-9]{7,12}" />
          <span className="text-sm text-muted">{t.account.phoneHint}</span>
        </label>
        <div>
          <button type="submit" className={buttonVariants({ variant: 'primary' })} disabled={busy} aria-busy={busy}>
            {busy ? t.common.loading : t.common.save}
          </button>
        </div>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await authApi('/change-password', {
        currentPassword: String(f.get('currentPassword')),
        newPassword: String(f.get('newPassword')),
        revokeOtherSessions: true,
      });
      form.reset();
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title={t.account.password}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError error={error} />
        {saved && <p role="status" className="m-0 text-primary-700">{t.account.passwordSaved}</p>}
        <label className="grid gap-1.5">
          {t.account.currentPassword}
          <input name="currentPassword" type="password" autoComplete="current-password" required />
        </label>
        <label className="grid gap-1.5">
          {t.auth.newPassword}
          <input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
          <span className="text-sm text-muted">{t.auth.passwordHelp}</span>
        </label>
        <div>
          <button type="submit" className={buttonVariants({ variant: 'primary' })} disabled={busy} aria-busy={busy}>
            {busy ? t.common.loading : t.common.save}
          </button>
        </div>
      </form>
    </Card>
  );
}

function SessionsCard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function logoutAll() {
    setBusy(true);
    setError(null);
    try {
      // Mencabut semua sesi; JWT yang terikat ke sesi tersebut ikut tidak berlaku.
      await authApi('/revoke-sessions', {});
      clearQueryCache();
      router.replace('/masuk');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <Card title={t.account.sessions}>
      <p className="mt-0">{t.account.sessionsBody}</p>
      <FormError error={error} />
      <button type="button" onClick={() => void logoutAll()} className={buttonVariants({ variant: 'soft' })} disabled={busy} aria-busy={busy}>
        {busy ? t.common.loading : t.account.logoutAll}
      </button>
    </Card>
  );
}
