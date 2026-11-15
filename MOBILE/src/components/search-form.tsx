import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

/** Kotak cari (form GET biasa: tetap berfungsi tanpa JavaScript). */
export function SearchForm({
  action = '/cari',
  placeholder,
  defaultValue,
  hidden,
  elevated,
}: {
  action?: string;
  placeholder: string;
  defaultValue?: string;
  hidden?: Record<string, string | undefined>;
  /** Kotak besar berbayang yang menimpa tepi bawah kepala beranda. */
  elevated?: boolean;
}) {
  return (
    <form action={action} role="search" className="relative">
      {Object.entries(hidden ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        className={cn(
          'w-full border bg-white pr-4 pl-12 text-base text-ink outline-none placeholder:text-muted focus:border-primary-400',
          elevated ? 'h-14 rounded-2xl border-white shadow-lift' : 'h-12 rounded-xl border-line',
        )}
      />
      <button type="submit" className="sr-only">
        {t.search.submit}
      </button>
    </form>
  );
}
