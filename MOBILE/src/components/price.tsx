import type { Price } from '@silk/shared';
import { cn } from '@/lib/cn';
import { priceText } from '@/lib/format';
import { t } from '@/messages/id';

/** Harga + label "Perkiraan". Tarif "tanya" tampil sebagai teks, tidak pernah angka nol. */
export function PriceTag({ price, size = 'md', className }: { price: Price; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const ask = price.type === 'tanya' || price.min === null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <span
        className={cn(
          'font-bold tracking-tight tabular-nums',
          ask ? 'text-[0.95rem] font-semibold text-muted' : size === 'lg' ? 'text-2xl text-ink' : size === 'sm' ? 'text-base text-ink' : 'text-lg text-ink',
        )}
      >
        {priceText(price)}
      </span>
      {!ask && <EstimateChip />}
    </span>
  );
}

export function EstimateChip() {
  return <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[0.7rem] font-semibold text-ink-soft">{t.price.estimate}</span>;
}
