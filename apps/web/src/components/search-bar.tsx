import { MapPin, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';
import { buttonVariants } from './ui/button';
import { Select } from './ui/select';

const CITY_OPTIONS = [
  { value: '', label: t.search.allCities },
  { value: 'Malang', label: 'Malang', hint: 'Kota dan kabupaten' },
  { value: 'kota-malang', label: 'Kota Malang' },
  { value: 'kabupaten-malang', label: 'Kabupaten Malang' },
];

/**
 * Formulir GET biasa (aturan SEO 1): lokasi dulu, lalu kata kunci.
 * Pilihan lokasi memakai popover; nilainya ikut terkirim lewat input tersembunyi.
 */
export function SearchBar({ q = '', city = '', variant = 'default' }: { q?: string; city?: string; variant?: 'default' | 'hero' }) {
  const hero = variant === 'hero';
  return (
    <form
      action="/cari"
      method="get"
      role="search"
      className={cn(
        'grid gap-2 rounded-[1.75rem] border border-line bg-white p-2.5 shadow-soft md:grid-cols-[230px_1fr_auto] md:items-center md:rounded-full md:p-2',
        hero ? 'shadow-lift' : 'my-5',
      )}
    >
      <Select
        name="city"
        defaultValue={city}
        options={CITY_OPTIONS}
        label={t.search.city}
        searchable={false}
        icon={<MapPin className="size-[18px] text-primary-600" />}
        className={cn('border-transparent bg-surface md:rounded-full md:bg-primary-50/60', hero && 'min-h-[52px]')}
      />
      <div className="relative">
        <label htmlFor="search-q" className="sr-only">
          {t.search.label}
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="search-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t.search.placeholder}
          autoComplete="off"
          className={cn('border-field pl-12 focus-visible:border-primary-600 md:rounded-full md:border-transparent md:hover:border-line-strong', hero && 'min-h-[52px]')}
        />
      </div>
      <button type="submit" className={buttonVariants({ variant: 'primary', size: hero ? 'lg' : 'md', className: 'w-full md:w-auto' })}>
        <Search className="size-[18px]" aria-hidden="true" />
        {t.search.submit}
      </button>
    </form>
  );
}
