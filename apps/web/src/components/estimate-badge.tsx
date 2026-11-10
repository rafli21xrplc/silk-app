import type { Price } from '@/lib/types';
import { t } from '@/messages/id';
import { InfoPopover } from './ui/info-popover';

/**
 * Label "Perkiraan" di samping harga publik (USP P1: angka biaya berlabel perkiraan dengan sumber mitra).
 * Tarif "tanya" tidak punya angka, jadi tidak diberi label.
 */
export function EstimateBadge({ price }: { price: Pick<Price, 'type'> }) {
  if (price.type === 'tanya') return null;
  return (
    <InfoPopover content={t.price.estimateHelp}>
      <span className="badge badge-estimate" data-estimate>
        {t.price.estimate}
      </span>
    </InfoPopover>
  );
}
