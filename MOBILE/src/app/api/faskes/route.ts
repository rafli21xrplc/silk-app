import { NextResponse, type NextRequest } from 'next/server';
import { parseFacilityParams } from '@/lib/search';
import { searchFacilities } from '@/lib/silk/api';
import type { FacilityPage } from '@/lib/pages';

/** Halaman berikutnya hasil pencarian faskes (gulir tanpa batas). Parameter divalidasi Zod. */
export async function GET(req: NextRequest) {
  const page = await searchFacilities(parseFacilityParams(req.nextUrl.searchParams));
  const body: FacilityPage = page;
  return NextResponse.json(body, { headers: { 'cache-control': 'private, max-age=30' } });
}
