/**
 * Buat akun admin atau moderator pertama (bagian 8).
 *
 *   SILK_ADMIN_PASSWORD='kata-sandi-panjang' pnpm --filter @silk/api create-admin -- --email admin@contoh.id --name "Nama" [--role moderator]
 *
 * Tanpa SILK_ADMIN_PASSWORD, kata sandi acak dibuat dan ditampilkan sekali di terminal.
 * Pengguna wajib mengaktifkan TOTP di /admin/mfa saat pertama masuk.
 * Jangan jalankan terhadap produksi tanpa persetujuan pemilik sistem.
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { user } from '@silk/db';
import { getAuth } from '../src/auth/auth';
import { closeDb, db } from '../src/lib/db';

// `pnpm create-admin -- --email ...` meneruskan "--" apa adanya; buang agar opsi tetap terbaca.
const argv = process.argv.slice(2).filter((a, i) => !(i === 0 && a === '--'));
const { values } = parseArgs({
  args: argv,
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'admin' },
  },
});

const out = (msg: string) => process.stdout.write(`${msg}\n`);

async function main() {
  const email = values.email?.trim().toLowerCase();
  const name = values.name?.trim();
  const role = values.role;
  if (!email || !name || (role !== 'admin' && role !== 'moderator')) {
    out('Pemakaian: create-admin -- --email <email> --name <nama> [--role admin|moderator]');
    process.exitCode = 1;
    return;
  }
  const given = process.env.SILK_ADMIN_PASSWORD;
  if (given !== undefined && given.length < 12) throw new Error('SILK_ADMIN_PASSWORD minimal 12 karakter');
  const password = given ?? randomBytes(18).toString('base64url');

  const [existing] = await db().select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existing) {
    await db().update(user).set({ role, emailVerified: true }).where(eq(user.id, existing.id));
    out(`Pengguna ${email} sudah ada; peran diubah menjadi ${role}. Kata sandi tidak diubah.`);
    return;
  }
  const res = await getAuth().api.signUpEmail({ body: { email, password, name } });
  await db().update(user).set({ role, emailVerified: true }).where(eq(user.id, res.user.id));
  out(`Akun ${role} dibuat: ${email}`);
  if (given === undefined) out(`Kata sandi sementara (tampil sekali, segera ganti): ${password}`);
  out('Masuk di /masuk lalu aktifkan autentikasi dua langkah di /admin/mfa.');
}

main()
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
