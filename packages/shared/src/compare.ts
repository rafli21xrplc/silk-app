import type { SortOption } from './constants';
import { priceSortKey, type PriceValue } from './price';

export interface ComponentInput {
  label: string;
  included: boolean;
  sortOrder?: number;
}

export interface CompareInputRow<F> {
  facility: F & { name: string };
  price: PriceValue;
  components: ComponentInput[];
  stale: boolean;
  distanceM?: number | null;
}

export type CompareOutputRow<R extends { components: ComponentInput[] }> = Omit<R, 'components'> & {
  components: Record<string, boolean>;
};

/**
 * Gabungan label komponen dari semua paket, urut kemunculan pertama (M3).
 * Label dibandingkan tanpa beda huruf besar/kecil dan spasi berlebih.
 */
export function unionComponentLabels(rows: { components: ComponentInput[] }[]): string[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const sorted = [...row.components].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const c of sorted) {
      const key = labelKey(c.label);
      if (!seen.has(key)) seen.set(key, c.label.trim());
    }
  }
  return [...seen.values()];
}

function labelKey(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Bentuk tabel perbandingan. Komponen yang tidak ada di sebuah paket bernilai `false`
 * ("tidak termasuk"), bukan kosong. Urutan default harga naik; tidak pernah berdasarkan pembayaran.
 */
export function buildComparison<R extends CompareInputRow<{ name: string }>>(
  rows: R[],
  opts: { sort?: SortOption; hideStale?: boolean } = {},
): { columns: string[]; rows: CompareOutputRow<R>[] } {
  const filtered = opts.hideStale ? rows.filter((r) => !r.stale) : rows;
  const columns = unionComponentLabels(filtered);

  const out = filtered.map((row) => {
    const byKey = new Map(row.components.map((c) => [labelKey(c.label), c.included]));
    const components: Record<string, boolean> = {};
    for (const col of columns) components[col] = byKey.get(labelKey(col)) ?? false;
    const { components: _ignored, ...rest } = row;
    return { ...rest, components } as CompareOutputRow<R>;
  });

  return { columns, rows: sortRows(out, opts.sort ?? 'price_asc') };
}

export function sortRows<
  R extends { price: PriceValue; facility: { name: string }; distanceM?: number | null },
>(rows: R[], sort: SortOption): R[] {
  const byName = (a: R, b: R) => a.facility.name.localeCompare(b.facility.name, 'id');
  const copy = [...rows];
  switch (sort) {
    case 'price_asc':
      return copy.sort((a, b) => priceSortKey(a.price) - priceSortKey(b.price) || byName(a, b));
    case 'price_desc':
      return copy.sort((a, b) => {
        const ka = priceSortKey(a.price);
        const kb = priceSortKey(b.price);
        // `tanya` tetap di akhir pada urutan turun
        if (ka === Infinity || kb === Infinity) return ka === kb ? byName(a, b) : ka === Infinity ? 1 : -1;
        return kb - ka || byName(a, b);
      });
    case 'name':
      return copy.sort(byName);
    case 'distance':
      return copy.sort(
        (a, b) =>
          (a.distanceM ?? Number.POSITIVE_INFINITY) - (b.distanceM ?? Number.POSITIVE_INFINITY) ||
          byName(a, b),
      );
  }
}
