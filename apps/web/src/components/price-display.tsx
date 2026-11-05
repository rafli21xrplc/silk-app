import { formatPrice } from '@silk/shared';
import { cn } from '@/lib/cn';
import type { Price } from '@/lib/types';
import { t } from '@/messages/id';

/** Harga sesuai price_type; tarif "tanya" tidak pernah tampil sebagai nol (M2). */
export function PriceDisplay({ price, size = 'md' }: { price: Price; size?: 'md' | 'lg' }) {
  const text = formatPrice(price, { ask: t.price.ask, from: t.price.from });
  const ask = price.type === 'tanya';
  return (
    <span
      className={cn(
        'price font-bold tracking-tight text-ink tabular-nums',
        size === 'lg' ? 'price-lg text-[1.4rem] sm:text-[1.5rem]' : 'text-[1.1rem]',
        ask && 'price-ask text-base font-semibold text-muted',
      )}
      data-price-type={price.type}
    >
      {text}
    </span>
  );
}
