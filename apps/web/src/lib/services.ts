import 'server-only';
import { apiGet, apiGetOrNull } from './api';
import { mapLimit, summarizeCities, type CatalogItem } from './service-summary';
import type { ServiceDetail, ServiceListItem } from './types';

const detailTags = (slug: string) => [`service:${slug}`, 'services'];

/** Detail satu layanan; tag cache sama dengan halaman detail sehingga keduanya berbagi cache. */
export const loadService = (slug: string) =>
  apiGetOrNull<ServiceDetail>(`/services/${encodeURIComponent(slug)}`, { tags: detailTags(slug) });

export const listServices = async () =>
  (await apiGet<ServiceListItem[]>('/services?limit=100', { tags: ['services'] })).data;

/**
 * Katalog + ringkasan harga per layanan. Detail diambil paralel terbatas (6 sekaligus) dan di-cache ISR;
 * bila satu detail gagal, kartunya tetap tampil tanpa harga.
 */
export async function loadCatalog(): Promise<CatalogItem[]> {
  const services = await listServices();
  return mapLimit(services, 6, async (s) => {
    const detail = await loadService(s.slug).catch(() => null);
    return {
      ...s,
      aliases: detail?.aliases ?? [],
      summary: detail ? summarizeCities(detail.cities) : null,
    };
  });
}
