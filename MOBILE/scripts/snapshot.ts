/**
 * Ambil data cadangan demo dari API SILK dan simpan ke src/demo/snapshot.json.
 *
 *   SILK_API_ORIGIN=http://127.0.0.1:4000 corepack pnpm --filter @silk/mobile snapshot
 *
 * Arahkan HANYA ke API yang berisi data demo/seed (bukan produksi): berkas ini ikut di-commit.
 * Hanya endpoint publik yang dibaca; tidak ada data akun, ulasan pribadi, atau rahasia.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import {
  compareResponseSchema,
  dataResponse,
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
} from '@silk/shared';
import { snapshotSchema, type Snapshot } from '../src/lib/silk/snapshot';

const ORIGIN = (process.env.SILK_API_ORIGIN ?? 'http://127.0.0.1:4000').replace(/\/+$/, '');
const OUT = fileURLToPath(new URL('../src/demo/snapshot.json', import.meta.url));

async function get<S extends z.ZodType>(path: string, schema: S): Promise<{ data: z.infer<S>; next: string | null }> {
  const res = await fetch(`${ORIGIN}/v1${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const parsed = dataResponse(schema as z.ZodType).parse(await res.json());
  return { data: parsed.data as z.infer<S>, next: parsed.meta?.nextCursor ?? null };
}

/** Semua halaman satu daftar. */
async function all<S extends z.ZodType>(path: string, item: S): Promise<z.infer<S>[]> {
  const out: z.infer<S>[] = [];
  let cursor: string | null = null;
  do {
    const sep = path.includes('?') ? '&' : '?';
    const page: { data: z.infer<S>[]; next: string | null } = await get(
      `${path}${sep}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      item.array(),
    );
    out.push(...page.data);
    cursor = page.next;
  } while (cursor);
  return out;
}

async function each<T, R>(items: readonly T[], fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += 6) out.push(...(await Promise.all(items.slice(i, i + 6).map(fn))));
  return out;
}

async function main() {
  console.log(`Mengambil data dari ${ORIGIN} …`);
  const categories = (await get('/service-categories', serviceCategorySchema.array())).data;
  const services = await all('/services', serviceListItemSchema);
  const serviceDetails = Object.fromEntries(
    await each(services, async (s) => [s.slug, (await get(`/services/${s.slug}`, serviceDetailSchema)).data] as const),
  );
  const compare = Object.fromEntries(
    await each(services, async (s) => {
      const cities = serviceDetails[s.slug]?.cities.map((c) => c.city) ?? [];
      const rows = (
        await Promise.all(
          cities.map(async (city) => (await get(`/compare?service=${s.slug}&city=${encodeURIComponent(city)}&limit=50`, compareResponseSchema)).data.rows),
        )
      ).flat();
      return [s.slug, rows] as const;
    }),
  );
  const facilities = await all('/facilities', facilityListItemSchema);
  const facilityDetails = Object.fromEntries(
    await each(facilities, async (f) => [f.slug, (await get(`/facilities/${f.slug}`, facilityDetailSchema)).data] as const),
  );
  const practitioners = await all('/practitioners', practitionerListItemSchema);
  const practitionerDetails = Object.fromEntries(
    await each(practitioners, async (p) => [p.slug, (await get(`/practitioners/${p.slug}`, practitionerDetailSchema)).data] as const),
  );
  const specialties = (await get('/practitioner-specialties', practitionerSpecialtySchema.array())).data;
  const articles = await all('/articles', publicArticleSummarySchema);
  const articleDetails = Object.fromEntries(
    await each(articles, async (a) => [a.slug, (await get(`/articles/${a.slug}`, publicArticleSchema)).data] as const),
  );

  const snapshot: Snapshot = snapshotSchema.parse({
    generatedAt: new Date().toISOString(),
    categories,
    services,
    serviceDetails,
    compare,
    facilities,
    facilityDetails,
    practitioners,
    practitionerDetails,
    specialties,
    articles,
    articleDetails,
  });
  await writeFile(OUT, `${JSON.stringify(snapshot, null, 1)}\n`);
  console.log(
    `Selesai: ${services.length} layanan, ${facilities.length} faskes, ${practitioners.length} dokter, ${articles.length} artikel → ${OUT}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
