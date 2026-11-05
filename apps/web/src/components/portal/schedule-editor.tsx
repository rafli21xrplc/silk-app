'use client';

import { Plus, Trash2 } from 'lucide-react';
import { DEFAULT_TIMEZONE, PROFILE_MAX_SCHEDULES, SCHEDULE_KINDS, TIMEZONES, type ScheduleKind } from '@silk/shared';
import { Select } from '@/components/ui/select';
import { WEEKDAYS, tzShort, weekdayName } from '@/lib/profile';
import type { PortalSchedule } from '@/lib/portal-types';
import { t } from '@/messages/id';

export type ScheduleDraft = Omit<PortalSchedule, 'id'>;

const newRow = (weekday: number, timezone: string): ScheduleDraft => ({
  kind: 'operasional',
  weekday,
  start: '08:00',
  end: '16:00',
  timezone,
  practitionerId: null,
  note: null,
});

/** Editor jadwal per hari (K7): jam lokal + zona waktu, satu hari boleh beberapa baris. */
export function ScheduleEditor({
  value,
  onChange,
  practitioners,
  disabled,
}: {
  value: ScheduleDraft[];
  onChange: (v: ScheduleDraft[]) => void;
  practitioners: { id: string; name: string }[];
  disabled?: boolean;
}) {
  const timezone = value[0]?.timezone ?? DEFAULT_TIMEZONE;
  const indexed = value.map((s, i) => ({ s, i }));
  const set = (i: number, patch: Partial<ScheduleDraft>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const full = value.length >= PROFILE_MAX_SCHEDULES;

  /** Salin jadwal Senin ke Selasa–Jumat (menggantikan isi hari-hari itu). */
  function copyMonday() {
    const monday = value.filter((s) => s.weekday === 1);
    const rest = value.filter((s) => s.weekday === 1 || s.weekday > 5);
    const copies = [2, 3, 4, 5].flatMap((d) => monday.map((s) => ({ ...s, weekday: d })));
    onChange([...rest, ...copies].slice(0, PROFILE_MAX_SCHEDULES));
  }

  return (
    <fieldset className="stack" disabled={disabled}>
      <legend>{t.profile.schedules}</legend>
      <p className="small muted">{t.profile.schedulesHelp}</p>
      <div className="row items-end">
        <label>
          {t.profile.timezone}
          <Select
            value={timezone}
            label={t.profile.timezone}
            onValueChange={(tz) => onChange(value.map((s) => ({ ...s, timezone: tz })))}
            options={TIMEZONES.map((z) => ({ value: z, label: `${tzShort(z)} (${z})` }))}
          />
        </label>
        {value.some((s) => s.weekday === 1) && (
          <button type="button" className="btn" onClick={copyMonday}>
            {t.profile.copyToWeekdays}
          </button>
        )}
      </div>
      <ul className="plain grid gap-2">
        {WEEKDAYS.map((d) => {
          const rows = indexed.filter(({ s }) => s.weekday === d).sort((a, b) => a.s.start.localeCompare(b.s.start));
          return (
            <li key={d} className="rounded-2xl border border-line bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="min-w-20">{weekdayName(d)}</strong>
                {rows.length === 0 && <span className="small muted">{t.profile.noSchedule}</span>}
                <button
                  type="button"
                  className="btn-link inline-flex items-center gap-1"
                  disabled={full}
                  onClick={() => onChange([...value, newRow(d, timezone)])}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t.profile.addSchedule}
                </button>
              </div>
              {rows.map(({ s, i }) => {
                const invalid = s.end <= s.start;
                return (
                  <div key={i} className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,0.8fr))_minmax(0,1.4fr)_auto] sm:items-end">
                    <label>
                      <span className="small">{t.profile.kind}</span>
                      <Select
                        value={s.kind}
                        label={t.profile.kind}
                        onValueChange={(k) => set(i, { kind: k as ScheduleKind, practitionerId: k === 'praktik' ? s.practitionerId : null })}
                        options={SCHEDULE_KINDS.map((k) => ({ value: k, label: t.facility.scheduleKinds[k] ?? k }))}
                      />
                    </label>
                    <label>
                      <span className="small">{t.profile.start}</span>
                      <input type="time" value={s.start} required onChange={(e) => set(i, { start: e.target.value })} />
                    </label>
                    <label>
                      <span className="small">{t.profile.end}</span>
                      <input
                        type="time"
                        value={s.end}
                        required
                        aria-invalid={invalid || undefined}
                        onChange={(e) => set(i, { end: e.target.value })}
                      />
                    </label>
                    {s.kind === 'praktik' && practitioners.length > 0 ? (
                      <label>
                        <span className="small">{t.profile.practitioner}</span>
                        <Select
                          value={s.practitionerId ?? ''}
                          label={t.profile.practitioner}
                          onValueChange={(v) => set(i, { practitionerId: v || null })}
                          options={[{ value: '', label: t.profile.noPractitioner }, ...practitioners.map((p) => ({ value: p.id, label: p.name }))]}
                        />
                      </label>
                    ) : (
                      <label>
                        <span className="small">{t.profile.note}</span>
                        <input value={s.note ?? ''} maxLength={200} onChange={(e) => set(i, { note: e.target.value || null })} />
                      </label>
                    )}
                    <button
                      type="button"
                      className="btn-link inline-flex items-center gap-1 sm:mb-2"
                      aria-label={`${t.portal.remove} ${weekdayName(d)} ${s.start}`}
                      onClick={() => onChange(value.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                    {invalid && <p className="error small m-0 sm:col-span-5">{t.profile.endBeforeStart}</p>}
                  </div>
                );
              })}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
