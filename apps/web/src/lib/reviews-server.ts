import 'server-only';
import type { FacilityReviews } from '@/components/reviews/reviews-section';
import { apiGetOrNull } from './api';
import { featureEnabled } from './flags';

/**
 * Ulasan satu profil untuk halaman publik (evaluasi USP R8). Null bila flag reviews_enabled OFF atau API
 * menolak; halaman lalu tidak menampilkan apa pun. Cache ikut tag faskes, yang direvalidasi API saat ulasan
 * disetujui, diubah, atau dihapus.
 */
export async function loadFacilityReviews(facilitySlug: string): Promise<FacilityReviews | null> {
  if (!featureEnabled('reviews_enabled')) return null;
  return apiGetOrNull<FacilityReviews>(`/facilities/${encodeURIComponent(facilitySlug)}/reviews?limit=10`, {
    tags: [`facility:${facilitySlug}`],
  });
}
