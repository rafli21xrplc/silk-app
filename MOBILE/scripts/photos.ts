/**
 * Unduh foto ilustrasi data demo (src/demo/photos.ts) ke public/demo/photos dan tulis CREDITS.md.
 *   corepack pnpm --filter @silk/mobile photos
 * Ukuran sudah dipotong di server Unsplash (imgix), jadi tidak perlu pemroses gambar lokal.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PHOTO_SIZES, PHOTOS, type PhotoKey } from '../src/demo/photos';

const OUT = path.resolve(import.meta.dirname, '../public/demo/photos');

function url(id: string, [w, h]: readonly [number, number], faces: boolean): string {
  const crop = faces ? 'faces,center' : 'entropy';
  return `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&crop=${crop}&q=72&fm=jpg&auto=format`;
}

async function download(src: string, file: string): Promise<number> {
  const res = await fetch(src);
  if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) throw new Error(`${res.status} ${src}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(OUT, file), buf);
  return buf.length;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  let total = 0;
  for (const [key, p] of Object.entries(PHOTOS) as [PhotoKey, (typeof PHOTOS)[PhotoKey]][]) {
    const sizes = PHOTO_SIZES[p.kind];
    const faces = p.kind === 'portrait';
    total += await download(url(p.unsplash, sizes.sq, faces), `${key}-sq.jpg`);
    total += await download(url(p.unsplash, sizes.wide, faces), `${key}-wide.jpg`);
    console.log(`ok ${key}`);
  }
  const credits = [
    '# Kredit foto ilustrasi (data demo)',
    '',
    'Semua foto dari [Unsplash](https://unsplash.com) dengan [Unsplash License](https://unsplash.com/license).',
    'Dipakai hanya sebagai ilustrasi untuk dokter dan faskes fiktif di data demo, dan selalu diberi keterangan',
    '"Foto ilustrasi" di aplikasi. Orang di foto bukan dokter yang namanya tertulis.',
    '',
    '| Berkas | Fotografer | Sumber |',
    '| --- | --- | --- |',
    ...Object.entries(PHOTOS).map(([key, p]) => `| ${key} | ${p.photographer} | ${p.page} |`),
    '',
  ].join('\n');
  await writeFile(path.join(OUT, 'CREDITS.md'), credits);
  console.log(`selesai: ${Object.keys(PHOTOS).length} foto, ${(total / 1024).toFixed(0)} KB`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
