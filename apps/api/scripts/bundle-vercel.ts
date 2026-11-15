/**
 * Bundel API untuk Vercel Functions: src/vercel.ts → dist/vercel.js (ESM).
 *
 * Kenapa perlu: paket workspace (@silk/shared, @silk/db) mengekspor berkas .ts, dan Vercel mengompilasi
 * berkas satu per satu tanpa menambah ekstensi impor, sehingga Node gagal memuatnya saat runtime.
 * Kode SILK sendiri dibundel; paket npm tetap eksternal dan dilacak Vercel dari node_modules
 * (termasuk modul native @node-rs/argon2).
 */
import { build, type Plugin } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');

/** Impor bare selain @silk/* dibiarkan eksternal. */
const externalNpm: Plugin = {
  name: 'external-npm',
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith('@silk/') || args.kind === 'entry-point') return undefined;
      return { path: args.path, external: true };
    });
  },
};

await build({
  entryPoints: [path.join(root, 'src/vercel.ts')],
  outfile: path.join(root, 'dist/vercel.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  plugins: [externalNpm],
});

// Vercel mewajibkan folder output statis yang tidak kosong. API cukup punya robots.txt (jangan diindeks).
mkdirSync(path.join(root, 'public'), { recursive: true });
writeFileSync(path.join(root, 'public/robots.txt'), 'User-agent: *\nDisallow: /\n');
