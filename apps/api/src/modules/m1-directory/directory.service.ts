import type {
  FacilityDetail,
  FacilityListItem,
  FacilitySearchQuery,
  PractitionerDetail,
} from '@silk/shared';
import { db } from '../../lib/db';
import { notFound } from '../../lib/errors';
import { decodeOffsetCursor, pageOf } from '../../lib/pagination';
import { publicTariffsForFacility } from '../m2-tariffs/tariffs.service';
import { findServiceBySlug } from '../m2-tariffs/tariffs.repo';
import { toPrice, toTrust } from '../m4-trust/trust.mapper';
import { publicMedia } from '../profiles/media.service';
import { publicProfileExtras } from '../profiles/profiles.service';
import * as repo from './directory.repo';

export async function searchFacilities(q: FacilitySearchQuery, now = new Date()) {
  const offset = decodeOffsetCursor(q.cursor);
  let serviceId: string | undefined;
  if (q.service) {
    const s = await findServiceBySlug(db(), q.service);
    if (!s) return { items: [] as FacilityListItem[], nextCursor: null };
    serviceId = s.id;
  }
  const rows = await repo.searchFacilities(db(), {
    q: q.q,
    city: q.city,
    type: q.type,
    serviceId,
    lat: q.lat,
    lng: q.lng,
    radius: q.radius,
    sort: q.sort,
    limit: q.limit,
    offset,
  });
  const page = pageOf(rows, q.limit, offset);
  const items: FacilityListItem[] = page.items.map((r) => {
    const version =
      r.tariff_id && r.price_type && r.effective_from && r.t_verification
        ? {
            priceType: r.price_type,
            priceMin: r.price_min === null ? null : Number(r.price_min),
            priceMax: r.price_max === null ? null : Number(r.price_max),
            effectiveFrom: r.effective_from,
            effectiveTo: r.effective_to,
            verifiedAt: r.verified_at ? new Date(r.verified_at) : null,
            verification: r.t_verification,
            sourceKind: r.source_kind,
            sourceTitle: r.source_title,
            sourceUrl: r.source_url,
            sourceDocumentDate: r.source_document_date,
          }
        : null;
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      type: r.type,
      address: r.address,
      city: r.city,
      verification: r.verification,
      location: r.lat !== null && r.lng !== null ? { lat: Number(r.lat), lng: Number(r.lng) } : null,
      distanceM: r.distance_m === null ? null : Math.round(Number(r.distance_m)),
      price: version ? toPrice(version) : null,
      trust: version ? toTrust(version, now) : null,
    };
  });
  return { items, nextCursor: page.nextCursor };
}

export async function getFacility(slug: string, now = new Date()): Promise<FacilityDetail> {
  const f = await repo.findPublishedFacilityBySlug(db(), slug);
  if (!f) throw notFound('FACILITY_NOT_FOUND', 'Faskes');
  const [practitionerRows, tariffs, extras, media] = await Promise.all([
    repo.practitionersForFacility(db(), f.id),
    publicTariffsForFacility(f.id, now),
    publicProfileExtras(f.id),
    publicMedia(f.id),
  ]);
  return {
    id: f.id,
    slug: f.slug,
    name: f.name,
    type: f.type,
    description: f.description,
    address: f.address,
    city: f.city,
    province: f.province,
    region: f.regionCode && f.regionName && f.regionType ? { code: f.regionCode, name: f.regionName, type: f.regionType } : null,
    location: f.lat !== null && f.lng !== null ? { lat: Number(f.lat), lng: Number(f.lng) } : null,
    phone: f.phone,
    website: f.website,
    hours: f.hours ?? null,
    verification: f.verification,
    updatedAt: f.updatedAt.toISOString(),
    practitioners: practitionerRows,
    tariffs,
    locations: extras.locations,
    schedules: extras.schedules,
    media,
  };
}

export async function getPractitioner(slug: string): Promise<PractitionerDetail> {
  const p = await repo.findPublishedPractitioner(db(), slug);
  if (!p) throw notFound('PRACTITIONER_NOT_FOUND', 'Tenaga medis');
  const facilityRows = await repo.facilitiesForPractitioner(db(), p.id);
  // STR hanya tampil bila sudah diverifikasi (M1).
  const strVerified = p.strVerifiedAt !== null;
  return {
    slug: p.slug,
    name: p.name,
    specialty: p.specialty,
    strNo: strVerified ? p.strNo : null,
    strVerifiedAt: strVerified ? p.strVerifiedAt!.toISOString() : null,
    facilities: facilityRows,
  };
}

export async function sitemap() {
  const s = await repo.sitemapEntries(db());
  return {
    facilities: s.facilityRows.map((f) => ({ path: `/faskes/${f.slug}`, lastModified: f.updatedAt.toISOString() })),
    practitioners: s.practitionerRows.map((p) => ({ path: `/dokter/${p.slug}`, lastModified: null })),
    services: s.serviceRows.map((r) => ({
      path: `/layanan/${r.slug}`,
      lastModified: r.last_verified ? new Date(r.last_verified).toISOString() : null,
    })),
    compare: s.serviceRows
      .filter((r) => r.has_tariffs)
      .map((r) => ({ path: `/bandingkan/${r.slug}`, lastModified: r.last_verified ? new Date(r.last_verified).toISOString() : null })),
  };
}
