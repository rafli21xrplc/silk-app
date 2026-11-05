'use client';

import Link from 'next/link';
import { can } from '@silk/shared';
import type { Me } from '@/lib/types';
import { t } from '@/messages/id';

const m = t.articleEditor;

/** Menulis artikel: role berizin `portal.articles` dan data mitra terverifikasi (API tetap menegakkan keduanya). */
export function ArticleGate({ me, children }: { me: Me; children: React.ReactNode }) {
  if (!can(me.user.role, 'portal.articles')) return <p className="card">{m.notAllowed}</p>;
  if (me.partner?.status !== 'verified')
    return (
      <p className="card">
        {m.needsVerified} <Link href="/portal/mitra">{t.partner.title}</Link>
      </p>
    );
  return <>{children}</>;
}
