import { ChevronDown } from 'lucide-react';

/** Pilihan native (pemilih bawaan ponsel lebih nyaman daripada daftar buatan). */
export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-ink-soft">{label}</span>
      <span className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full appearance-none rounded-xl border border-field/60 bg-white pr-10 pl-3.5 text-[0.95rem] text-ink disabled:bg-surface disabled:text-muted"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
      </span>
      {hint && <span className="text-[0.75rem] text-muted">{hint}</span>}
    </label>
  );
}
