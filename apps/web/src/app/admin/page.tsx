'use client';

import Link from 'next/link';
import { t } from '@/messages/id';
import { AdminShell, useAdminData } from './admin-shell';
import { Skeleton } from '@/components/ui/skeleton';

interface QueueCounts {
  claims: number;
  tariffs: number;
  reports: number;
  imports: number;
}

export default function AdminHome() {
  return <AdminShell>{() => <Overview />}</AdminShell>;
}

function Overview() {
  const { items, error } = useAdminData<QueueCounts>('/admin/overview');
  const cards: { key: keyof QueueCounts; href: string; label: string }[] = [
    { key: 'claims', href: '/admin/klaim', label: t.admin.claims },
    { key: 'tariffs', href: '/admin/tarif', label: t.admin.tariffs },
    { key: 'reports', href: '/admin/laporan', label: t.admin.reports },
    { key: 'imports', href: '/admin/impor', label: t.admin.imports },
  ];
  return (
    <>
      {error && <p className="error">{error}</p>}
      <ul className="plain grid grid-2">
        {cards.map((c) => (
          <li key={c.key} className="card">
            <Link href={c.href}>
              <strong>{c.label}</strong>
            </Link>
            {items ? (
              <p className="price-lg">{items[c.key]}</p>
            ) : (
              <Skeleton className="my-3 h-8 w-14 rounded-xl" />
            )}
            <p className="small muted">{t.admin.pending}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
