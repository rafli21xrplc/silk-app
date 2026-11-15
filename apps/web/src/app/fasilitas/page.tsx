import { redirect } from 'next/navigation';
import { FACILITY_TYPES } from '@silk/shared';

type SP = Promise<Record<string, string | string[] | undefined>>;

/**
 * Alamat direktori faskes dari SILK versi lama. Direktori kini satu dengan pencarian (/cari), yang punya
 * pilihan jenis, filter, peta, dan halaman berikutnya. `?type=` yang sah diteruskan.
 */
export default async function FacilitiesRedirect({ searchParams }: { searchParams: SP }) {
  const raw = (await searchParams).type;
  const type = Array.isArray(raw) ? raw[0] : raw;
  redirect(type && (FACILITY_TYPES as readonly string[]).includes(type) ? `/cari?type=${type}` : '/cari');
}
