'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { READINESS_PILLARS, type Readiness } from '@silk/shared';
import { cn } from '@/lib/cn';
import { useQuery } from '@/lib/query-cache';
import { pillarLabel, readinessAction, readinessHint } from '@/lib/readiness';
import { t } from '@/messages/id';

const r = t.readiness;

/**
 * Kesiapan profil terhadap USP "Tahu biayanya, kenal dokternya, sebelum datang". Dinilai API dengan aturan
 * yang sama seperti halaman publik. `version` berubah setiap profil atau media berubah, lalu panel memuat ulang.
 */
export function ReadinessPanel({ facilityId, facilityType, version }: { facilityId: string; facilityType: string; version: string }) {
  const { data, refetch } = useQuery<Readiness>(`/portal/facilities/${facilityId}/readiness`);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void refetch();
    // refetch stabil per path; hanya `version` yang memicu muat ulang.
  }, [version]);

  if (!data) return null;
  const percent = data.total ? Math.round((data.done / data.total) * 100) : 0;
  return (
    <section className="stack card" aria-labelledby="kesiapan-judul">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="kesiapan-judul" className="m-0">
          {r.title}
        </h2>
        <span className="text-sm font-semibold text-ink-soft">{r.progress(data.done, data.total)}</span>
      </div>
      <p className="small muted m-0">{r.intro}</p>
      <span className="block h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={r.progress(data.done, data.total)}>
        <span className="block h-full rounded-full bg-primary-600 transition-[width]" style={{ width: `${percent}%` }} />
      </span>
      {!data.published && <p className="small m-0 rounded-xl bg-warn-soft px-3 py-2">{r.notPublished}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        {READINESS_PILLARS.map((pillar) => {
          const checks = data.checks.filter((c) => c.pillar === pillar);
          const ok = data.pillars[pillar];
          return (
            <div key={pillar} className={cn('grid content-start gap-2 rounded-2xl border p-4', ok ? 'border-primary-200 bg-primary-50/60' : 'border-line bg-white')}>
              <p className="m-0 flex items-center justify-between gap-2">
                <strong>{pillarLabel(pillar, facilityType)}</strong>
                <span className={cn('badge', !ok && 'badge-stale')}>{ok ? r.pillarDone : r.pillarTodo}</span>
              </p>
              <ul className="plain grid gap-2">
                {checks.map((c) => {
                  const hint = readinessHint(c);
                  const action = readinessAction(c, facilityId);
                  return (
                    <li key={c.item} className="flex items-start gap-2 text-sm">
                      {c.done ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary-700" aria-label={r.done} />
                      ) : (
                        <Circle className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                      )}
                      <span className="grid gap-0.5">
                        <span className={cn(c.done && 'text-ink-soft')}>
                          {r.items[c.item] ?? c.item}
                          {c.optional && <span className="text-muted">{` · ${r.optional}`}</span>}
                        </span>
                        {hint && <span className="text-muted">{hint}</span>}
                        {action && (
                          <a href={action.href} className="font-semibold">
                            {action.label}
                          </a>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
