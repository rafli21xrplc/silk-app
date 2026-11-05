/**
 * Tulis dokumen OpenAPI 3.1 ke docs/openapi.json (bagian 6). Tidak butuh database:
 * rute didaftarkan saat createApp() dipanggil, koneksi DB baru dibuat saat ada query.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL ??= 'postgres://openapi:openapi@localhost:5432/openapi';
process.env.NODE_ENV ??= 'development';

const { createApp } = await import('../src/app');
const { generateOpenApiDocument } = await import('../src/lib/openapi');
const { env } = await import('../src/lib/env');

createApp();
const doc = generateOpenApiDocument(env().API_ORIGIN);
const out = path.resolve(fileURLToPath(import.meta.url), '../../../../docs/openapi.json');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
process.stdout.write(`OpenAPI ditulis ke ${out} (${Object.keys(doc.paths ?? {}).length} path)\n`);
