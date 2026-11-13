import type { CompareResponse, FacilityListItem, PractitionerListItem, PublicTariff } from '@silk/shared';
import { normalizeTerm, type DoctorParams, type FacilityParams } from '../search';
import type { Snapshot } from './snapshot';

/**
 * Pencarian di atas data cadangan, meniru perilaku API untuk kebutuhan demo:
 * filter yang sama, urutan netral (nama, harga, atau jarak), tanpa pembayaran atau langganan.
 */

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const PAGE_SIZE = 20;

function paginate<T>(items: T[], cursor: string | undefined, limit: number): Page<T> {
  const start = cursor && /^\d+$/.test(cursor) ? Number(cursor) : 0;
  const end = start + limit;
  return { items: items.slice(start, end), nextCursor: end < items.length ? String(end) : null };
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'id');

/** Jarak permukaan bumi (meter, haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

const numeric = (tariff: PublicTariff) => tariff.price.type !== 'tanya' && tariff.price.min !== null;

/** Tarif yang mewakili layanan di satu faskes: berangka dulu, lalu harga terendah. */
function representativeTariff(tariffs: PublicTariff[]): PublicTariff | null {
  const sorted = [...tariffs].sort(
    (a, b) => Number(numeric(b)) - Number(numeric(a)) || (a.price.min ?? Number.MAX_SAFE_INTEGER) - (b.price.min ?? Number.MAX_SAFE_INTEGER),
  );
  return sorted[0] ?? null;
}

export function demoSearchFacilities(snap: Snapshot, p: FacilityParams, limit = PAGE_SIZE): Page<FacilityListItem> {
  const term = p.q ? normalizeTerm(p.q) : '';
  const point = p.lat !== undefined && p.lng !== undefined ? { lat: p.lat, lng: p.lng } : null;
  const rows: FacilityListItem[] = [];
  for (const f of snap.facilities) {
    const detail = snap.facilityDetails[f.slug];
    const tariffs = detail?.tariffs ?? [];
    if (p.city && f.city !== p.city) continue;
    if (p.type && f.type !== p.type) continue;
    if (p.category && !tariffs.some((x) => x.service.categorySlug === p.category)) continue;
    if (term) {
      const haystack = normalizeTerm([f.name, f.address, f.city, ...tariffs.map((x) => x.service.name)].join(' '));
      if (!haystack.includes(term)) continue;
    }
    let item: FacilityListItem = { ...f, price: null, trust: null, priceAvailable: false };
    if (p.service) {
      const tariff = representativeTariff(tariffs.filter((x) => x.service.slug === p.service));
      if (!tariff) continue;
      item = { ...item, price: tariff.price, trust: tariff.trust, priceAvailable: numeric(tariff) };
    }
    item.distanceM = point && f.location ? distanceMeters(point, f.location) : null;
    rows.push(item);
  }

  const priceKey = (x: FacilityListItem) => (x.priceAvailable && x.price?.min != null ? x.price.min : null);
  const sort = p.sort ?? (point ? 'distance' : 'name');
  rows.sort((a, b) => {
    if (sort === 'distance') return (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity) || byName(a, b);
    if (sort === 'price_asc' || sort === 'price_desc') {
      const ka = priceKey(a);
      const kb = priceKey(b);
      if (ka === null || kb === null) return Number(ka === null) - Number(kb === null) || byName(a, b);
      return (sort === 'price_asc' ? ka - kb : kb - ka) || byName(a, b);
    }
    return byName(a, b);
  });
  return paginate(rows, p.cursor, limit);
}

export function demoSearchPractitioners(snap: Snapshot, p: DoctorParams, limit = PAGE_SIZE): Page<PractitionerListItem> {
  const term = p.q ? normalizeTerm(p.q) : '';
  const fee = (d: PractitionerListItem) =>
    d.consultation && d.consultation.price.type !== 'tanya' ? d.consultation.price.min : null;
  const rows = snap.practitioners.filter((d) => {
    if (p.specialty && d.specialty !== p.specialty) return false;
    if (p.video && !d.hasVideo) return false;
    if (p.fee && fee(d) === null) return false;
    if (term && !normalizeTerm(`${d.name} ${d.specialty ?? ''} ${d.practices.map((x) => x.name).join(' ')}`).includes(term)) return false;
    return true;
  });
  rows.sort((a, b) => {
    if (p.sort === 'fee_asc') {
      const fa = fee(a);
      const fb = fee(b);
      if (fa === null || fb === null) return Number(fa === null) - Number(fb === null) || byName(a, b);
      return fa - fb || byName(a, b);
    }
    return byName(a, b);
  });
  return paginate(rows, p.cursor, limit);
}

export function demoCompare(snap: Snapshot, service: string, city: string | undefined, hideStale: boolean): CompareResponse | null {
  const detail = snap.serviceDetails[service];
  if (!detail) return null;
  const rows = (snap.compare[service] ?? [])
    .filter((r) => (!city || r.facility.city === city) && (!hideStale || !r.stale))
    .sort((a, b) => {
      const ka = a.price.type === 'tanya' ? null : a.price.min;
      const kb = b.price.type === 'tanya' ? null : b.price.min;
      if (ka === null || kb === null) return Number(ka === null) - Number(kb === null) || a.facility.name.localeCompare(b.facility.name, 'id');
      return ka - kb || a.facility.name.localeCompare(b.facility.name, 'id');
    });
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r.components)))];
  return { service: { slug: detail.slug, name: detail.name }, columns, rows };
}
