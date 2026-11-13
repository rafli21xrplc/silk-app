'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Check, ChevronRight, Minus, Scale } from 'lucide-react';
import type { PublicTariff } from '@silk/shared';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';
import { Empty } from './empty';
import { PriceTag } from './price';
import { serviceIcon, categoryTone, IconTile } from './service-icon';
import { Sheet } from './sheet';
import { TrustDetail, TrustLine } from './trust';

/**
 * Daftar tarif satu profil: saring per kategori (evaluasi UI/UX C4), ketuk untuk rincian
 * (sumber, tanggal, verifikasi, isi paket) dalam lembar bawah.
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
  return (
    <>
      {categories.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3" role="group" aria-label={t.search.category}>
          {[{ slug: '', name: t.facility.allCategories }, ...categories].map((c) => (
            <button
              key={c.slug || 'semua'}
              type="button"
              aria-pressed={cat === c.slug}
              onClick={() => setCat(c.slug)}
              className={cn(
                'tap h-9 shrink-0 rounded-full border px-3.5 text-[0.8rem] font-semibold',
                cat === c.slug ? 'border-primary-600 bg-primary-600 text-white' : 'border-line bg-white text-ink-soft',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <ul className="m-0 grid list-none gap-2.5 px-4">
        {shown.map((x) => (
          <li key={x.id}>
            <button
              type="button"
              onClick={() => setOpen(x)}
              className="tap flex w-full items-start gap-3 rounded-2xl border border-line/70 bg-white p-3.5 text-left shadow-soft"
              data-tariff
            >
              <IconTile icon={serviceIcon(x.service.slug)} tone={categoryTone(x.service.categorySlug)} size="sm" />
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="text-sm leading-snug font-semibold">{x.package?.name ?? x.service.name}</span>
                <PriceTag price={x.price} size="sm" />
                <TrustLine trust={x.trust} />
              </span>
              <ChevronRight className="mt-1 size-5 shrink-0 text-muted" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)} title={t.facility.tariffDetail}>
        {open && (
          <div className="grid gap-5">
            <div>
              <p className="m-0 text-[0.8rem] font-semibold text-muted">{open.service.category}</p>
              <p className="m-0 mb-2 text-lg leading-snug font-bold">{open.package?.name ?? open.service.name}</p>
              <PriceTag price={open.price} size="lg" />
              <p className="m-0 mt-2 text-[0.8rem] text-muted">{t.price.estimateHelp}</p>
            </div>
            {open.package && open.package.components.length > 0 && (
              <div>
                <p className="m-0 mb-2 text-sm font-bold">{t.facility.packageContents}</p>
                <ul className="m-0 grid list-none gap-1.5 p-0">
                  {open.package.components.map((c) => (
                    <li key={c.label} className="flex items-center gap-2 text-sm">
                      {c.included ? <Check className="size-4 text-ok" aria-label={t.facility.included} /> : <Minus className="size-4 text-muted" aria-label={t.facility.excluded} />}
                      <span className={c.included ? 'text-ink' : 'text-muted line-through'}>{c.label}</span>
                    </li>
                  ))}
                </ul>
                {open.package.notes && <p className="m-0 mt-2 text-[0.8rem] text-muted">{open.package.notes}</p>}
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
            <div className="rounded-2xl bg-surface/70 p-4">
              <p className="m-0 mb-3 text-sm font-bold">{t.facility.trustTitle}</p>
              <TrustDetail trust={open.trust} />
            </div>
            <Link
              href={`/layanan/${open.service.slug}`}
              className="tap inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary-600 font-semibold text-white no-underline shadow-soft"
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
