import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import type { CompareResponse } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { t } from '@/messages/id';
import { PriceDisplay } from './price-display';
import { InfoPopover } from './ui/info-popover';

/**
 * Tabel perbandingan semantik (header ber-scope). Komponen yang tidak ada = "tidak termasuk".
 * Kolom faskes tetap terlihat saat tabel digeser ke samping di ponsel.
 */
export function ComparisonTable({ data }: { data: CompareResponse }) {
  return (
    <div className="table-scroll" tabIndex={0} aria-label={t.compare.title(data.service.name, '')}>
      <table className="compare-table">
        <caption className="sr-only">{t.compare.title(data.service.name, '')}</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-20 bg-surface">
              {t.compare.facility}
            </th>
            <th scope="col">{t.compare.price}</th>
            {data.columns.map((c) => (
              <th scope="col" key={c} className="text-center">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.tariffId} className={r.stale ? 'row-stale' : undefined}>
              <th scope="row" className="sticky left-0 z-10 bg-white shadow-[1px_0_0_var(--color-line)]">
                <Link href={`/faskes/${r.facility.slug}`} className="font-semibold text-ink no-underline hover:text-primary-800 hover:underline">
                  {r.facility.name}
                </Link>
                <div className="text-sm font-normal text-muted">{r.facility.city}</div>
              </th>
              <td className="min-w-[200px]">
                <PriceDisplay price={r.price} />
                <div className="mt-1 text-[0.82rem] leading-relaxed text-muted">
                  {t.trust.effectiveFrom} {formatDate(r.effectiveFrom)}
                  <br />
                  {r.verifiedAt ? `${t.trust.verifiedAt} ${formatDate(r.verifiedAt)}` : t.trust.notVerified}
                  {r.stale && (
                    <>
                      {' '}
                      <InfoPopover content={t.trust.staleHelp}>
                        <span className="badge badge-stale">{t.trust.stale}</span>
                      </InfoPopover>
                    </>
                  )}
                </div>
              </td>
              {data.columns.map((c) =>
                r.components[c] ? (
                  <td key={c} className="cell-yes text-center align-middle">
                    <span className="inline-grid size-7 place-items-center rounded-full bg-ok-soft text-ok" aria-hidden="true">
                      <Check className="size-4" strokeWidth={2.5} />
                    </span>
                    <span className="sr-only">{t.compare.included}</span>
                  </td>
                ) : (
                  <td key={c} className="cell-no text-center align-middle text-muted">
                    <span className="inline-grid size-7 place-items-center rounded-full bg-surface-2" aria-hidden="true">
                      <Minus className="size-4" />
                    </span>
                    <span className="mt-1 block text-[0.72rem]">{t.compare.notIncluded}</span>
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
