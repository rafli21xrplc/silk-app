'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Check, Minus, Scale } from 'lucide-react';
import type { PublicTariff } from '@silk/shared';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';
import { Empty } from './empty';
import { commonVerification } from '@/lib/trust';
import { ListGroup, ListRow } from './list';
import { PriceTag, PriceValue } from './price';
import { Sheet } from './sheet';
import { TrustDetail, TrustNote } from './trust';

/**
 * Daftar tarif satu profil seperti papan tarif: dikelompokkan per kategori, harga rata kanan.
 * "Perkiraan" dan sumber terbanyak disebut sekali di atas; baris hanya menandai yang berbeda.
 * Ketuk baris untuk rincian lengkap (sumber, tanggal, verifikasi, isi paket) dalam lembar bawah.
 */
export function TariffBrowser({ tariffs }: { tariffs: PublicTariff[] }) {
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const x of tariffs) seen.set(x.service.categorySlug, x.service.category);
    return [...seen.entries()].map(([slug, name]) => ({ slug, name }));
  }, [tariffs]);
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState<PublicTariff | null>(null);
  const shown = cat ? tariffs.filter((x) => x.service.categorySlug === cat) : tariffs;

  if (tariffs.length === 0) return <Empty text={t.facility.noTariffs} />;
  const common = commonVerification(tariffs.map((x) => x.trust));
  // "Semua": dikelompokkan per kategori (kepala kelompok = kategori, jadi baris tidak perlu ikon).
  const groups = cat
    ? [{ slug: cat, name: categories.find((c) => c.slug === cat)?.name ?? '', items: shown }]
    : categories.map((c) => ({
        ...c,
        items: tariffs.filter((x) => x.service.categorySlug === c.slug),
      }));
  return (
    <>
      {categories.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={t.search.category}>
          {[{ slug: '', name: t.facility.allCategories }, ...categories].map((c) => (
            <button
              key={c.slug || 'semua'}
              type="button"
              aria-pressed={cat === c.slug}
              onClick={() => setCat(c.slug)}
              className={cn(
                'h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors',
                cat === c.slug ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft active:bg-surface',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <p className="m-0 px-5 pt-3 text-xs text-muted" data-estimate-note>
        {t.price.groupNote(common ? (t.verification[common] ?? null) : null)}
      </p>
      {groups.map((g, i) => (
        <ListGroup
          key={g.slug}
          id={`tarif-${g.slug}`}
          level={3}
          title={groups.length > 1 ? g.name : undefined}
          aside={groups.length > 1 ? <span className="text-xs text-muted">{g.items.length}</span> : undefined}
          className={i === 0 ? 'mt-3' : 'mt-5'}
        >
          {g.items.map((x) => (
            <ListRow
              key={x.id}
              marker="tariff"
              onClick={() => setOpen(x)}
              title={x.package?.name ?? x.service.name}
              sub={<TrustNote trust={x.trust} common={common} />}
              trailing={<PriceValue price={x.price} />}
            />
          ))}
        </ListGroup>
      ))}

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)} title={t.facility.tariffDetail}>
        {open && (
          <div className="grid gap-5">
            <div>
              <p className="m-0 text-xs font-semibold tracking-wide text-muted uppercase">{open.service.category}</p>
              <p className="m-0 mb-2 text-xl leading-snug font-bold">{open.package?.name ?? open.service.name}</p>
              <PriceTag price={open.price} size="lg" />
              <p className="m-0 mt-2 text-sm text-muted">{t.price.estimateHelp}</p>
            </div>
            {open.package && open.package.components.length > 0 && (
              <div>
                <p className="m-0 mb-2 text-sm font-bold">{t.facility.packageContents}</p>
                <ul className="m-0 grid list-none gap-1.5 p-0">
                  {open.package.components.map((c) => (
                    <li key={c.label} className="flex items-center gap-2 text-sm">
                      {c.included ? (
                        <Check className="size-4 text-ok" aria-label={t.facility.included} />
                      ) : (
                        <Minus className="size-4 text-muted" aria-label={t.facility.excluded} />
                      )}
                      <span className={c.included ? 'text-ink' : 'text-muted line-through'}>{c.label}</span>
                    </li>
                  ))}
                </ul>
                {open.package.notes && <p className="m-0 mt-2 text-sm text-muted">{open.package.notes}</p>}
              </div>
            )}
            {(open.inclusions || open.exclusions) && (
              <dl className="m-0 grid gap-2 text-sm">
                {open.inclusions && (
                  <div>
                    <dt className="font-bold">{t.facility.included}</dt>
                    <dd className="m-0 text-ink-soft">{open.inclusions}</dd>
                  </div>
                )}
                {open.exclusions && (
                  <div>
                    <dt className="font-bold">{t.facility.excluded}</dt>
                    <dd className="m-0 text-ink-soft">{open.exclusions}</dd>
                  </div>
                )}
              </dl>
            )}
            <div className="rounded-2xl bg-surface p-4">
              <p className="m-0 mb-3 text-sm font-bold">{t.facility.trustTitle}</p>
              <TrustDetail trust={open.trust} />
            </div>
            <Link
              href={`/layanan/${open.service.slug}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-600 font-semibold text-white no-underline active:bg-primary-700"
            >
              <Scale className="size-4" aria-hidden="true" />
              {t.facility.compareThis}
            </Link>
          </div>
        )}
      </Sheet>
    </>
  );
}
