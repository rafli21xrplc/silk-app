import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Daftar berkelompok (pola aplikasi ponsel): satu permukaan putih, baris dipisah garis tipis.
 * Menggantikan "satu kartu berbayang per butir" (evaluasi UI/UX mobile B1).
 */
export function ListGroup({
  id,
  title,
  aside,
  note,
  level = 2,
  className,
  children,
}: {
  id?: string;
  title?: React.ReactNode;
  aside?: React.ReactNode;
  note?: React.ReactNode;
  level?: 2 | 3;
  className?: string;
  children: React.ReactNode;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section aria-labelledby={title && id ? id : undefined} className={cn('mt-6', className)}>
      {title && (
        <div className="flex items-baseline justify-between gap-3 px-5 pb-2">
          <Heading id={id} className={cn('m-0 font-bold', level === 2 ? 'text-base' : 'text-sm text-ink-soft')}>
            {title}
          </Heading>
          {aside}
        </div>
      )}
      <ul className="m-0 mx-4 list-none divide-y divide-line/80 overflow-hidden rounded-2xl bg-white p-0">{children}</ul>
      {note && <p className="m-0 px-5 pt-2 text-xs text-muted">{note}</p>}
    </section>
  );
}

type RowProps = {
  title: React.ReactNode;
  sub?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  align?: 'center' | 'start';
  className?: string;
  /** Penanda untuk uji dan tangkapan layar, mis. "tariff" → data-tariff. */
  marker?: string;
};

export function ListRow({ title, sub, leading, trailing, href, onClick, chevron = !!href, align = 'center', className, marker }: RowProps) {
  const cls = cn(
    'flex w-full gap-3 px-4 py-3 text-left text-ink no-underline',
    align === 'start' ? 'items-start' : 'items-center',
    (href || onClick) && 'transition-colors active:bg-surface',
    className,
  );
  const inner = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-base leading-snug">{title}</span>
        {sub && <span className="mt-0.5 block text-xs text-muted">{sub}</span>}
      </span>
      {trailing && <span className="shrink-0 text-right">{trailing}</span>}
      {chevron && <ChevronRight className={cn('size-4 shrink-0 text-line-strong', align === 'start' && 'mt-1')} aria-hidden="true" />}
    </>
  );
  const data = marker ? { [`data-${marker}`]: '' } : {};
  return (
    <li {...data}>
      {href ? (
        <Link href={href} className={cls}>
          {inner}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cls}>
          {inner}
        </button>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}

/** Wadah baris tanpa judul (mis. daftar tak berujung). */
export function ListBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={cn('m-0 mx-4 list-none divide-y divide-line/80 overflow-hidden rounded-2xl bg-white p-0', className)}>{children}</ul>;
}
