'use client';

import { CheckCircle2, Clock, FlaskConical, XCircle, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatRupiah, type PaymentOrder, type SubscriptionOverview } from '@silk/shared';
import { FormError } from '@/components/app-shell';
import { buttonVariants } from '@/components/ui/button';
import { LoadingTable } from '@/components/ui/skeleton';
import { api, errorMessage } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime } from '@/lib/format';
import { queryCache, useQuery } from '@/lib/query-cache';
import type { Me } from '@/lib/types';
import { t } from '@/messages/id';

const m = t.subscription;
const OVERVIEW = '/v1/partners/me/subscription';

/** Label mode uji. Wajib tampil di sandbox/simulator agar tidak ada yang mengira uangnya ditarik. */
function ModeNotice({ mode }: { mode: SubscriptionOverview['providerMode'] }) {
  if (!m.mode[mode]) return null;
  return (
    <p role="note" className="mb-6 flex items-start gap-2 rounded-2xl border border-warn-line bg-warn-soft p-3 text-sm">
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {m.mode[mode]}
    </p>
  );
}

const STATUS: Record<PaymentOrder['status'], { icon: LucideIcon; className: string }> = {
  pending: { icon: Clock, className: 'text-warn' },
  paid: { icon: CheckCircle2, className: 'text-primary-700' },
  failed: { icon: XCircle, className: 'text-danger' },
  expired: { icon: XCircle, className: 'text-muted' },
};

function StatusLabel({ status }: { status: PaymentOrder['status'] }) {
  const { icon: Icon, className } = STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-semibold', className)}>
      <Icon className="size-4" aria-hidden="true" />
      {m.status[status]}
    </span>
  );
}

/** Halaman langganan: masa aktif, pilihan paket, dan riwayat pembayaran. */
export function SubscriptionView({ me }: { me: Me }) {
  const q = useQuery<SubscriptionOverview>(OVERVIEW);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verified = me.partner?.status === 'verified';

  async function pay(plan: string) {
    setBusy(plan);
    setError(null);
    try {
      const { data } = await api<PaymentOrder>('POST', '/v1/partners/me/subscription/orders', { plan });
      if (!data.paymentUrl) throw new Error(t.common.error);
      // Halaman bayar Duitku (atau simulator). Status dibaca lagi dari server saat kembali.
      window.location.assign(data.paymentUrl);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  if (q.loading) return <LoadingTable />;
  if (q.error || !q.data) return <p className="error">{errorMessage(q.error)}</p>;
  const s = q.data;
  const pending = s.orders.find((o) => o.status === 'pending' && o.paymentUrl);

  return (
    <div className="max-w-3xl">
      <p className="mt-0 mb-4 text-ink-soft">{m.intro}</p>
      <ModeNotice mode={s.providerMode} />

      <div role="status" className={cn('mb-6 rounded-2xl border p-4', s.activeUntil ? 'border-primary-200 bg-primary-50' : 'border-line bg-surface')}>
        <p className="m-0 font-semibold">{s.activeUntil ? m.activeUntil(formatDate(s.activeUntil)) : m.inactive}</p>
        {s.trialEndsAt && (
          <p className="m-0 mt-1 text-sm text-ink-soft" data-trial>
            {new Date(s.trialEndsAt).getTime() > Date.now() ? m.trialActive(formatDate(s.trialEndsAt)) : m.trialEnded(formatDate(s.trialEndsAt))}
          </p>
        )}
        {s.activeUntil && <p className="m-0 mt-1 text-sm text-ink-soft">{s.trialEndsAt && new Date(s.trialEndsAt).getTime() > Date.now() ? m.trialExtendNote : m.extendNote}</p>}
      </div>

      {!verified ? (
        <p className="rounded-2xl border border-line bg-surface p-4">
          {m.needVerified}{' '}
          <Link href="/portal/mitra">{t.partner.title}</Link>
        </p>
      ) : (
        <>
          {pending && (
            <p className="mb-4 rounded-2xl border border-warn-line bg-warn-soft p-4">
              {m.status.pending}: {m.plans[pending.plan]?.name} · {formatRupiah(pending.amount)}{' '}
              <a href={pending.paymentUrl!} className="font-semibold">
                {m.continuePay}
              </a>
            </p>
          )}
          <ul className="m-0 grid list-none gap-4 p-0 sm:max-w-md">
            {s.plans.map((p) => (
              <li key={p.id} className="flex flex-col rounded-2xl border border-line bg-white p-5">
                <p className="m-0 text-lg font-semibold">{m.plans[p.id]?.name ?? p.id}</p>
                <p className="m-0 mt-2 text-2xl font-bold tabular-nums">
                  {formatRupiah(p.price)} <span className="text-sm font-normal text-muted">{m.plans[p.id]?.period}</span>
                </p>
                <p className="m-0 mt-1 text-sm text-muted">{m.priceFor(t.partner.types[s.partnerType] ?? s.partnerType)}</p>
                <button
                  type="button"
                  onClick={() => pay(p.id)}
                  disabled={busy !== null}
                  className={cn(buttonVariants({ variant: 'primary' }), 'mt-5')}
                  data-plan={p.id}
                >
                  {busy === p.id ? m.paying : m.pay}
                </button>
              </li>
            ))}
          </ul>
          <FormError error={error} />
        </>
      )}

      <h2 className="mt-10 mb-3 text-lg">{m.ordersTitle}</h2>
      {s.orders.length === 0 ? (
        <p className="text-muted">{m.noOrders}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="hidden p-3 font-medium sm:table-cell">{m.date}</th>
                <th className="p-3 font-medium">{m.orderId}</th>
                <th className="p-3 font-medium">{m.amount}</th>
                <th className="p-3 font-medium">{m.statusCol}</th>
              </tr>
            </thead>
            <tbody>
              {s.orders.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="hidden p-3 whitespace-nowrap sm:table-cell">{formatDateTime(o.createdAt)}</td>
                  <td className="p-3">
                    <Link href={`/portal/langganan/${o.id}`} className="font-mono text-xs break-all">
                      {o.merchantOrderId}
                    </Link>
                    <span className="block text-xs text-muted">
                      {m.plans[o.plan]?.name}
                      <span className="sm:hidden"> · {formatDateTime(o.createdAt)}</span>
                    </span>
                  </td>
                  <td className="p-3 tabular-nums">{formatRupiah(o.amount)}</td>
                  <td className="p-3">
                    <StatusLabel status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Halaman kembali dari Duitku. Parameter URL (resultCode dsb.) sengaja diabaikan: status hanya dari API,
 * yang berubah lewat callback bertanda tangan. Selama `pending`, status dibaca ulang tiap 4 detik (maks. 2 menit).
 */
export function PaymentReturn({ id }: { id: string }) {
  const path = `/v1/partners/me/subscription/orders/${id}`;
  const q = useQuery<PaymentOrder>(path);
  const tries = useRef(0);
  const [gaveUp, setGaveUp] = useState(false);
  const status = q.data?.status;
  const refetch = q.refetch;

  useEffect(() => {
    if (status !== 'pending') {
      // invalidate() bekerja per awalan: entri pesanan ini harus dikecualikan, kalau tidak halaman kembali ke "Memuat…".
      if (status) queryCache.invalidate(OVERVIEW, path);
      return;
    }
    const timer = setInterval(() => {
      if (++tries.current > 30) {
        setGaveUp(true);
        clearInterval(timer);
        return;
      }
      void refetch();
    }, 4000);
    return () => clearInterval(timer);
  }, [status, refetch, path]);

  if (q.loading) return <LoadingTable />;
  if (q.error || !q.data) return <p className="error">{errorMessage(q.error)}</p>;
  const o = q.data;
  const body = o.status === 'paid' ? m.paidBody : o.status === 'failed' ? m.failedBody : o.status === 'expired' ? m.expiredBody : gaveUp ? m.stillPending : m.waiting;

  return (
    <div className="max-w-xl">
      <div role="status" aria-live="polite" className="rounded-2xl border border-line bg-white p-5">
        <StatusLabel status={o.status} />
        <p className="mt-2 mb-4">{body}</p>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">{m.orderId}</dt>
          <dd className="m-0 font-mono text-xs">{o.merchantOrderId}</dd>
          <dt className="text-muted">{m.amount}</dt>
          <dd className="m-0 tabular-nums">
            {formatRupiah(o.amount)} · {m.plans[o.plan]?.name}
          </dd>
          {o.paidAt && (
            <>
              <dt className="text-muted">{m.status.paid}</dt>
              <dd className="m-0">{formatDateTime(o.paidAt)}</dd>
            </>
          )}
        </dl>
        {o.status === 'pending' && o.paymentUrl && (
          <a href={o.paymentUrl} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-4')}>
            {m.continuePay}
          </a>
        )}
      </div>
      <Link href="/portal/langganan" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mt-4')}>
        {m.back}
      </Link>
    </div>
  );
}
