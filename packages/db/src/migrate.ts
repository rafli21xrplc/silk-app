import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

config({ path: path.resolve(fileURLToPath(import.meta.url), '../../../../.env'), quiet: true });

const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('DATABASE_URL_UNPOOLED atau DATABASE_URL belum diisi\n');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await migrate(drizzle(client), {
    migrationsFolder: path.resolve(fileURLToPath(import.meta.url), '../../drizzle'),
  });
  process.stdout.write('Migrasi selesai\n');
} finally {
  await client.end();
}
