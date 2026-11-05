import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { JsonLd } from '@/components/json-ld';
import { apiGetOrNull } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { physicianLd } from '@/lib/seo';
import type { PractitionerDetail } from '@/lib/types';
import { t } from '@/messages/id';

type Params = Promise<{ slug: string }>;
export const revalidate = 3600;

/** Tidak ada prerender saat build; halaman dibuat saat diminta pertama kali lalu di-cache (ISR). */
export function generateStaticParams() {
  return [];
}

const load = (slug: string) => apiGetOrNull<PractitionerDetail>(`/practitioners/${encodeURIComponent(slug)}`, { tags: [`practitioner:${slug}`] });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await load((await params).slug);
  if (!p) return { title: t.notFound.title, robots: { index: false } };
  return {
    title: `${p.name}${p.specialty ? `, ${p.specialty}` : ''}`,
    description: `Profil ${p.name}${p.facilities.length ? ` di ${p.facilities.map((f) => f.name).join(', ')}` : ''}.`,
    alternates: { canonical: `/dokter/${p.slug}` },
  };
}

export default async function PractitionerPage({ params }: { params: Params }) {
  const p = await load((await params).slug);
  if (!p) notFound();
  return (
    <div className="container">
      <Breadcrumbs items={[{ name: 'Beranda', path: '/' }, { name: p.name, path: `/dokter/${p.slug}` }]} />
      <JsonLd data={physicianLd(p)} />
      <h1>{p.name}</h1>
      <dl className="kv card max-w-2xl">
        {p.specialty && (
          <>
            <dt>{t.practitioner.specialty}</dt>
            <dd>{p.specialty}</dd>
          </>
        )}
        <dt>{t.practitioner.str}</dt>
        <dd>{p.strNo ? `${p.strNo} (${t.practitioner.strVerified}, ${formatDate(p.strVerifiedAt)})` : t.practitioner.strUnverified}</dd>
      </dl>
      {p.facilities.length > 0 && (
        <>
          <h2>{t.practitioner.facilities}</h2>
          <ul>
            {p.facilities.map((f) => (
              <li key={f.slug}>
                <Link href={`/faskes/${f.slug}`}>{f.name}</Link> <span className="muted">· {f.city}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
