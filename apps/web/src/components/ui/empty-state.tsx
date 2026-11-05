import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Tampilan saat daftar kosong: ikon, judul, penjelasan singkat, dan tindakan opsional. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex animate-rise flex-col items-center rounded-card border border-dashed border-line-strong bg-white px-6 py-12 text-center sm:py-16',
        className,
      )}
    >
      <span
        className="mb-5 grid size-16 place-items-center rounded-full bg-primary-50 ring-8 ring-primary-50/50"
        aria-hidden="true"
      >
        <span className="grid size-11 place-items-center rounded-full bg-white text-primary-700 shadow-soft">
          <Icon className="size-[22px]" strokeWidth={1.75} />
        </span>
      </span>
      <h2 className="m-0 text-lg font-semibold text-ink">{title}</h2>
      {children && (
        <p className="mx-auto mt-2 mb-0 max-w-md text-[0.925rem] leading-relaxed text-muted">
          {children}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
