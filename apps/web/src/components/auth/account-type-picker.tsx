'use client';

import { Hospital, Leaf, Pill, Stethoscope, UserRound, type LucideIcon } from 'lucide-react';
import { PARTNER_TYPES, type AccountType } from '@silk/shared';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

const ICONS: Record<AccountType, LucideIcon> = {
  pasien: UserRound,
  fasilitas: Hospital,
  tenaga_medis: Stethoscope,
  gaya_hidup: Leaf,
  apotek: Pill,
};

function Option({ type, value, onChange }: { type: AccountType; value: AccountType; onChange: (v: AccountType) => void }) {
  const Icon = ICONS[type];
  const copy = t.auth.accountTypes[type]!;
  const checked = value === type;
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-3.5 transition-colors',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-300',
        checked ? 'border-primary-500 bg-primary-50' : 'border-line hover:border-primary-200',
      )}
    >
      <input type="radio" name="accountType" value={type} checked={checked} onChange={() => onChange(type)} className="sr-only" />
      <span
        className={cn('grid size-10 shrink-0 place-items-center rounded-xl', checked ? 'bg-primary-600 text-white' : 'bg-surface-2 text-primary-700')}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-ink">{copy.title}</span>
        <span className="block text-sm text-muted">{copy.body}</span>
      </span>
    </label>
  );
}

/** Pilihan jenis akun saat daftar. Role ditetapkan server dari nilai ini dan tidak bisa diubah sendiri. */
export function AccountTypePicker({ value, onChange }: { value: AccountType; onChange: (v: AccountType) => void }) {
  return (
    <fieldset className="m-0 grid min-w-0 gap-2.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-[0.925rem] font-semibold text-ink-soft">{t.auth.accountTypeLabel}</legend>
      <Option type="pasien" value={value} onChange={onChange} />
      <p className="m-0 mt-2 text-sm font-semibold text-ink-soft">{t.auth.partnerGroup}</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {PARTNER_TYPES.map((type) => (
          <Option key={type} type={type} value={value} onChange={onChange} />
        ))}
      </div>
      {value !== 'pasien' && <p className="m-0 text-sm text-muted">{t.auth.partnerHint}</p>}
    </fieldset>
  );
}
