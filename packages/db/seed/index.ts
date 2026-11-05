import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from '../src/client';
import { seedDemoData } from './demo';
import { seedReference, seedTestData } from './run';

config({ path: path.resolve(fileURLToPath(import.meta.url), '../../../../.env'), quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('DATABASE_URL belum diisi\n');
  process.exit(1);
}

const { db, pool } = createDb(url, { max: 1 });
try {
  await seedReference(db);
  if (!process.argv.includes('--reference-only')) await seedTestData(db);
  // --demo: faskes dan tarif fiktif tambahan untuk pengembangan lokal (seed/demo-data.ts).
  if (process.argv.includes('--demo')) {
    const r = await seedDemoData(db);
    process.stdout.write(`Demo: ${r.facilities} faskes, ${r.tariffs} tarif, ${r.versions} versi tarif baru\n`);
  }
  process.stdout.write('Seed selesai\n');
} finally {
  await pool.end();
}
