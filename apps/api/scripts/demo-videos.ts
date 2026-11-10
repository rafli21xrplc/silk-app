/**
 * Impor video perkenalan dokter untuk demo (evaluasi USP R7).
 *
 *   corepack pnpm --filter @silk/api demo-videos -- [--dir ../../demo-media] [--moderator moderator@contoh.id]
 *
 * Folder berisi `video-demo.json` (lihat docs/demo-video.md) beserta berkas MP4 dan formulir persetujuan
 * bertanda tangan. Folder `demo-media/` di-gitignore: video dan formulir memuat data pribadi, jangan di-commit.
 *
 * Tiap video diperiksa sama seperti unggahan portal (MP4 asli, 20–90 detik, maks. 50 MB; formulir PDF/JPEG/PNG
 * maks. 5 MB) lalu masuk antrean moderasi dengan persetujuannya. Dengan `--moderator`, video langsung disetujui
 * atas nama akun moderator/admin itu (cek persetujuan dan audit tetap berjalan). Aman diulang: profil yang
 * sudah punya video aktif dilewati. Di produksi wajib `--izinkan-produksi` dan persetujuan pemilik sistem.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { user } from '@silk/db';
import { demoVideoManifestSchema } from '@silk/shared';
import { closeDb, db } from '../src/lib/db';
import { isProduction } from '../src/lib/env';
import { importDemoVideo } from '../src/modules/profiles/media-import.service';
import { approveMedia } from '../src/modules/profiles/media.service';

const argv = process.argv.slice(2).filter((a, i) => !(i === 0 && a === '--'));
const { values } = parseArgs({
  args: argv,
  options: {
    // pnpm --filter menjalankan skrip dari apps/api; default menunjuk demo-media/ di akar repo.
    dir: { type: 'string', default: '../../demo-media' },
    moderator: { type: 'string' },
    'izinkan-produksi': { type: 'boolean', default: false },
  },
});

const out = (msg: string) => process.stdout.write(`${msg}\n`);

async function moderatorId(email: string) {
  const [row] = await db()
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.email, email.trim().toLowerCase()));
  if (!row || (row.role !== 'moderator' && row.role !== 'admin')) throw new Error(`Akun moderator/admin ${email} tidak ditemukan`);
  return { id: row.id, role: row.role as 'moderator' | 'admin' };
}

async function main() {
  if (isProduction() && !values['izinkan-produksi']) {
    out('Lingkungan produksi: tambahkan --izinkan-produksi setelah mendapat persetujuan pemilik sistem.');
    process.exitCode = 1;
    return;
  }
  const dir = path.resolve(values.dir);
  const manifest = demoVideoManifestSchema.parse(JSON.parse(await readFile(path.join(dir, 'video-demo.json'), 'utf8')));
  const approver = values.moderator ? await moderatorId(values.moderator) : null;

  let failed = 0;
  for (const item of manifest.videos) {
    try {
      const result = await importDemoVideo({
        practitionerSlug: item.practitionerSlug,
        video: { fileName: item.videoFile, bytes: await readFile(path.join(dir, item.videoFile)) },
        consent: {
          fileName: item.consentFile,
          bytes: await readFile(path.join(dir, item.consentFile)),
          subjectName: item.subjectName,
          socialMedia: item.socialMedia,
        },
        caption: item.caption ?? null,
      });
      if (result.status === 'dilewati') {
        out(`- ${item.practitionerSlug}: dilewati (${result.reason})`);
        continue;
      }
      if (approver) {
        await approveMedia({ actorId: approver.id, role: approver.role, ip: null, requestId: 'demo-videos' }, result.mediaId);
        out(`✓ ${item.practitionerSlug}: ${result.durationSec} detik, tayang`);
      } else {
        out(`✓ ${item.practitionerSlug}: ${result.durationSec} detik, menunggu moderasi di /admin/moderasi`);
      }
    } catch (err) {
      failed += 1;
      out(`✗ ${item.practitionerSlug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err: unknown) => {
    out(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(() => closeDb());
