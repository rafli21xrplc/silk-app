import type { DbOrTx } from '@silk/db';
import { db } from '../../lib/db';
import { revalidate, tags } from '../../lib/revalidate';
import { practitionerSlugsOfFacility } from './directory.repo';

/**
 * Halaman dokter (Fase 4b) memakai data faskes tempat praktiknya: profil, media, jadwal, dan tarif.
 * Dipanggil di samping revalidate faskes. Modul terpisah agar service lain tidak mengimpor
 * directory.service (yang sudah mengimpor profiles). Kegagalan hanya membuat cache bertahan sampai TTL.
 */
export async function revalidatePractitionersOfFacilities(facilityIds: string[], database: DbOrTx = db()): Promise<void> {
  const slugs = new Set<string>();
  for (const id of facilityIds) for (const slug of await practitionerSlugsOfFacility(database, id)) slugs.add(slug);
  if (slugs.size) await revalidate([tags.practitioners, ...[...slugs].map(tags.practitioner)]);
}
