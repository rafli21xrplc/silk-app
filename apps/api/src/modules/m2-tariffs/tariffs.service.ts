import type { PublicTariff, ServiceCategory, ServiceDetail, ServiceListItem, ServicesQuery } from '@silk/shared';
import { db } from '../../lib/db';
import { notFound } from '../../lib/errors';
import { decodeOffsetCursor, pageOf } from '../../lib/pagination';
import { toPrice, toTrust } from '../m4-trust/trust.mapper';
import * as repo from './tariffs.repo';

export async function listServices(q: ServicesQuery) {
  const offset = decodeOffsetCursor(q.cursor);
  const rows = await repo.searchServices(db(), { q: q.q, category: q.category, limit: q.limit, offset });
  const page = pageOf(rows, q.limit, offset);
  const items: ServiceListItem[] = page.items.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    category: { slug: r.categorySlug, name: r.categoryName },
  }));
  return { items, nextCursor: page.nextCursor };
}

export async function getService(slug: string): Promise<ServiceDetail> {
  const s = await repo.findServiceBySlug(db(), slug);
  if (!s) throw notFound('SERVICE_NOT_FOUND', 'Layanan');
  const cities = await repo.cityPriceSummary(db(), s.id);
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description,
    aliases: s.aliases,
    category: { slug: s.categorySlug, name: s.categoryName },
    cities: cities.map((c) => ({
      city: c.city,
      facilityCount: Number(c.facility_count),
      minPrice: c.min_price === null ? null : Number(c.min_price),
      maxPrice: c.max_price === null ? null : Number(c.max_price),
      medianPrice: c.median_price === null ? null : Number(c.median_price),
      latestVerifiedAt: c.latest_verified_at ? new Date(c.latest_verified_at).toISOString() : null,
    })),
  };
}

/** Tarif terbit untuk satu faskes, dalam bentuk kontrak publik. */
export async function publicTariffsForFacility(facilityId: string, now = new Date()): Promise<PublicTariff[]> {
  const [rows, components] = await Promise.all([
    repo.listPublishedTariffs(db(), { facilityIds: [facilityId] }),
    repo.componentsForFacility(db(), facilityId),
  ]);
  return rows.map((r) => ({
    id: r.tariffId,
    versionNo: r.versionNo,
    service: { slug: r.serviceSlug, name: r.serviceName, category: r.categoryName, categorySlug: r.categorySlug },
    package:
      r.packageId && r.packageName
        ? {
            name: r.packageName,
            notes: r.packageNotes,
            components: (components.get(r.packageId) ?? []).map(({ label, included }) => ({ label, included })),
          }
        : null,
    price: toPrice(r),
    trust: toTrust(r, now),
    inclusions: r.inclusions,
    exclusions: r.exclusions,
  }));
}

export async function listCategories(): Promise<ServiceCategory[]> {
  const rows = await repo.listCategories(db());
  return rows.map((r) => ({ slug: r.slug, name: r.name, serviceCount: Number(r.serviceCount) }));
}
