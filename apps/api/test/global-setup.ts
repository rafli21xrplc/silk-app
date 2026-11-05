import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { loadTestEnv } from './load-env';

/** Jalankan migrasi sekali sebelum semua uji. */
export default async function setup(): Promise<void> {
  loadTestEnv();
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error('Uji integrasi butuh DATABASE_URL atau TEST_DATABASE_URL di .env root');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await migrate(drizzle(client), {
      migrationsFolder: path.resolve(fileURLToPath(import.meta.url), '../../../../packages/db/drizzle'),
    });
  } finally {
    await client.end();
  }
}
