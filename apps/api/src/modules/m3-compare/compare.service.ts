import { buildComparison, type CompareQuery, type CompareResponse } from '@silk/shared';
import { db } from '../../lib/db';
import { notFound } from '../../lib/errors';
import { componentsForService, findServiceBySlug, listPublishedTariffs } from '../m2-tariffs/tariffs.repo';
import { toPrice, toTrust } from '../m4-trust/trust.mapper';

/**
 * Perbandingan apple-to-apple (M3): hanya tarif pada layanan yang sama; kolom = gabungan komponen;
 * komponen yang tidak ada bernilai false ("tidak termasuk"); urutan default harga naik.
 */
export async function compare(q: CompareQuery, now = new Date()): Promise<CompareResponse> {
  const service = await findServiceBySlug(db(), q.service);
  if (!service) throw notFound('SERVICE_NOT_FOUND', 'Layanan');

  const [rows, components] = await Promise.all([
    listPublishedTariffs(db(), {
      serviceId: service.id,
      facilityIds: q.facilityIds,
      city: q.facilityIds ? undefined : q.city,
    }),
    componentsForService(db(), service.id),
  ]);

  const input = rows.map((r) => {
    const trust = toTrust(r, now);
    return {
      tariffId: r.tariffId,
      facility: { id: r.facilityId, slug: r.facilitySlug, name: r.facilityName, city: r.facilityCity },
      price: toPrice(r),
      components: r.packageId ? components.get(r.packageId) ?? [] : [],
      stale: trust.stale,
      effectiveFrom: trust.effectiveFrom,
      verifiedAt: trust.verifiedAt,
      verification: trust.verification,
      source: trust.source ? { kind: trust.source.kind, title: trust.source.title } : null,
    };
  });

  const result = buildComparison(input, { sort: q.sort, hideStale: q.hideStale });
  return {
    service: { slug: service.slug, name: service.name },
    columns: result.columns,
    rows: result.rows.slice(0, q.limit).map((r) => ({
      tariffId: r.tariffId,
      facility: r.facility,
      price: { ...r.price, currency: 'IDR' as const },
      components: r.components,
      effectiveFrom: r.effectiveFrom,
      verifiedAt: r.verifiedAt,
      verification: r.verification,
      stale: r.stale,
      source: r.source,
    })),
  };
}
