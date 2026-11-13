import { Search } from 'lucide-react';
import { t } from '@/messages/id';

/** Kotak cari (form GET biasa: tetap berfungsi tanpa JavaScript). */
export function SearchForm({ action = '/cari', placeholder, defaultValue, hidden }: { action?: string; placeholder: string; defaultValue?: string; hidden?: Record<string, string | undefined> }) {
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
        className="h-12 w-full rounded-2xl border border-line bg-white pr-4 pl-12 text-[0.95rem] text-ink shadow-soft outline-none placeholder:text-muted focus:border-primary-400"
      />
      <button type="submit" className="sr-only">
        {t.search.submit}
      </button>
    </form>
  );
}
