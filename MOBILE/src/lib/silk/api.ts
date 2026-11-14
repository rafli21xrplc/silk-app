import 'server-only';
import {
  compareResponseSchema,
  facilityDetailSchema,
  facilityListItemSchema,
  practitionerDetailSchema,
  practitionerListItemSchema,
  practitionerSpecialtySchema,
  publicArticleSchema,
  publicArticleSummarySchema,
  serviceCategorySchema,
  serviceDetailSchema,
  serviceListItemSchema,
  slugSchema,
  type CompareResponse,
  type FacilityDetail,
  type FacilityListItem,
  type PractitionerDetail,
  type PractitionerListItem,
  type PractitionerSpecialty,
  type PublicArticle,
  type PublicArticleSummary,
  type ServiceCategory,
  type ServiceDetail,
  type ServiceListItem,
} from '@silk/shared';
import { toQueryString, type DoctorParams, type FacilityParams } from '../search';
import { demoCompare, demoSearchFacilities, demoSearchPractitioners, PAGE_SIZE, type Page } from './demo';
import { fetchApi, getSnapshot, type DataSource, type Fetched } from './source';

/**
 * Fungsi data untuk halaman dan route handler. Setiap hasil membawa `source` agar UI bisa memberi tahu
 * pengguna saat data cadangan dipakai. `null` = memang tidak ditemukan (404).
 */
export interface Loaded<T> {
  data: T;
  source: DataSource;
}
export interface LoadedPage<T> extends Page<T> {
  source: DataSource;
}

function settle<T>(res: Fetched<T>, demo: () => T | null | undefined): Loaded<T> | null {
  if (res.kind === 'ok') return { data: res.data, source: 'live' };
  if (res.kind === 'not_found') return null;
  const data = demo();
  return data === null || data === undefined ? null : { data, source: 'demo' };
}

/** Untuk daftar: tidak pernah null (kosong bila cadangan juga tidak punya). */
function settleList<T>(res: Fetched<T[]>, demo: () => T[]): Loaded<T[]> {
  return settle(res, demo) ?? { data: [], source: res.kind === 'ok' ? 'live' : 'demo' };
}

/**
 * Slug dari URL dicek sebelum ke API: yang tidak sah pasti tidak ada (404), tanpa memakan permintaan API.
 * Ini juga mencegah kunci seperti `constructor` atau `__proto__` terbaca dari objek data cadangan.
 */
const isSlug = (slug: string) => slugSchema.safeParse(slug).success;
const own = <T>(map: Record<string, T>, slug: string): T | undefined => (Object.hasOwn(map, slug) ? map[slug] : undefined);

export const anyDemo = (...results: ({ source: DataSource } | null | undefined)[]) => results.some((r) => r?.source === 'demo');

export async function getCategories(): Promise<Loaded<ServiceCategory[]>> {
  return settleList(await fetchApi('/service-categories', serviceCategorySchema.array(), { tags: ['services'] }), () => getSnapshot().categories);
}

export async function getServices(): Promise<Loaded<ServiceListItem[]>> {
  return settleList(await fetchApi('/services?limit=100', serviceListItemSchema.array(), { tags: ['services'] }), () => getSnapshot().services);
}

export async function getService(slug: string): Promise<Loaded<ServiceDetail> | null> {
  if (!isSlug(slug)) return null;
  return settle(await fetchApi(`/services/${encodeURIComponent(slug)}`, serviceDetailSchema, { tags: [`service:${slug}`] }), () =>
    own(getSnapshot().serviceDetails, slug),
  );
}

export async function getCompare(service: string, city: string, hideStale: boolean): Promise<Loaded<CompareResponse> | null> {
  const qs = toQueryString({ service, city, hideStale: hideStale ? 'true' : undefined, limit: 50 });
  return settle(await fetchApi(`/compare?${qs}`, compareResponseSchema, { tags: [`service:${service}`] }), () =>
    demoCompare(getSnapshot(), service, city, hideStale),
  );
}

export async function searchFacilities(p: FacilityParams, limit = PAGE_SIZE): Promise<LoadedPage<FacilityListItem>> {
  const qs = toQueryString({
    q: p.q,
    city: p.city,
    type: p.type,
    service: p.service,
    category: p.category,
    sort: p.sort,
    lat: p.lat,
    lng: p.lng,
    cursor: p.cursor,
    limit,
  });
  const res = await fetchApi(`/facilities?${qs}`, facilityListItemSchema.array(), { revalidate: 60, tags: ['facilities'] });
  if (res.kind === 'ok') return { items: res.data, nextCursor: res.nextCursor, source: 'live' };
  return { ...demoSearchFacilities(getSnapshot(), p, limit), source: 'demo' };
}

export async function getFacility(slug: string): Promise<Loaded<FacilityDetail> | null> {
  if (!isSlug(slug)) return null;
  return settle(await fetchApi(`/facilities/${encodeURIComponent(slug)}`, facilityDetailSchema, { tags: [`facility:${slug}`] }), () =>
    own(getSnapshot().facilityDetails, slug),
  );
}

export async function searchPractitioners(p: DoctorParams, limit = PAGE_SIZE): Promise<LoadedPage<PractitionerListItem>> {
  const qs = toQueryString({ q: p.q, specialty: p.specialty, sort: p.sort, video: p.video, fee: p.fee, cursor: p.cursor, limit });
  const res = await fetchApi(`/practitioners?${qs}`, practitionerListItemSchema.array(), { revalidate: 60, tags: ['practitioners'] });
  if (res.kind === 'ok') return { items: res.data, nextCursor: res.nextCursor, source: 'live' };
  return { ...demoSearchPractitioners(getSnapshot(), p, limit), source: 'demo' };
}

export async function getSpecialties(): Promise<Loaded<PractitionerSpecialty[]>> {
  return settleList(
    await fetchApi('/practitioner-specialties', practitionerSpecialtySchema.array(), { tags: ['practitioners'] }),
    () => getSnapshot().specialties,
  );
}

export async function getPractitioner(slug: string): Promise<Loaded<PractitionerDetail> | null> {
  if (!isSlug(slug)) return null;
  return settle(await fetchApi(`/practitioners/${encodeURIComponent(slug)}`, practitionerDetailSchema, { tags: ['practitioners'] }), () =>
    own(getSnapshot().practitionerDetails, slug),
  );
}

export async function getArticles(): Promise<Loaded<PublicArticleSummary[]>> {
  return settleList(await fetchApi('/articles?limit=50', publicArticleSummarySchema.array(), { tags: ['articles'] }), () => getSnapshot().articles);
}

export async function getArticle(slug: string): Promise<Loaded<PublicArticle> | null> {
  if (!isSlug(slug)) return null;
  return settle(await fetchApi(`/articles/${encodeURIComponent(slug)}`, publicArticleSchema, { tags: ['articles'] }), () =>
    own(getSnapshot().articleDetails, slug),
  );
}

/** Tanggal data cadangan, untuk pemberitahuan mode demo. */
export const snapshotDate = () => getSnapshot().generatedAt;
