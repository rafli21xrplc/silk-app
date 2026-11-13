import { NextResponse, type NextRequest } from 'next/server';
import { parseDoctorParams } from '@/lib/search';
import { searchPractitioners } from '@/lib/silk/api';
import type { DoctorPage } from '@/lib/pages';

/** Halaman berikutnya hasil pencarian dokter. Parameter divalidasi Zod. */
export async function GET(req: NextRequest) {
  const page = await searchPractitioners(parseDoctorParams(req.nextUrl.searchParams));
  const body: DoctorPage = page;
  return NextResponse.json(body, { headers: { 'cache-control': 'private, max-age=30' } });
}
