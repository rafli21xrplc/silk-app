import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { Express } from 'express';
import { memberships, partners, user } from '@silk/db';
import { seedReference, seedTestData, truncateAll } from '@silk/db/seed/run';
import { createApp } from '../src/app';
import { getAuth } from '../src/auth/auth';
import { db } from '../src/lib/db';
import { testOutbox } from '../src/lib/email';
import type { FacilityType, PartnerStatus, PartnerType, UserRole } from '@silk/shared';

export const ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'kata-sandi-uji-panjang-123';

let app: Express | undefined;
export function getApp(): Express {
  app ??= createApp();
  return app;
}

/** Kosongkan database lalu isi taksonomi dan data uji fiktif. */
export async function resetDb(now = new Date()): Promise<void> {
  await truncateAll(db());
  await seedReference(db());
  await seedTestData(db(), now);
  testOutbox.length = 0;
}

/* ---------- TOTP (RFC 6238) untuk menguji MFA ---------- */

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const ch of clean) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totp(base32Secret: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const h = createHmac('sha1', base32Decode(base32Secret)).update(counter).digest();
  const offset = h[h.length - 1]! & 0x0f;
  const bin = (h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(bin).padStart(6, '0');
}

/* ---------- Pengguna dan sesi ---------- */

export interface TestUser {
  id: string;
  email: string;
  agent: ReturnType<typeof request.agent>;
  csrf: string;
}

let seq = 0;

/** Data mitra uji; atribut wajib per jenis diisi otomatis. Status bawaan `verified`. */
export interface TestPartner {
  type: PartnerType;
  status?: PartnerStatus;
  facilityKind?: FacilityType;
}

const PARTNER_ROLE: Record<PartnerType, UserRole> = {
  fasilitas: 'faskes',
  tenaga_medis: 'tenaga_medis',
  gaya_hidup: 'gaya_hidup',
  apotek: 'apotek',
};

/**
 * Buat pengguna lewat Better Auth, tandai email terverifikasi, atur peran, lalu masuk.
 * `mfa: true` mengaktifkan TOTP lewat alur Better Auth sungguhan. `partner` membuat baris mitra
 * (Fase 2: profil, revisi, harga, dan media mensyaratkan mitra terverifikasi).
 */
export async function createUser(
  opts: { role?: UserRole; mfa?: boolean; facilityIds?: string[]; partner?: TestPartner } = {},
): Promise<TestUser> {
  const email = `uji${++seq}-${Date.now()}@contoh.test`;
  const signUp = await getAuth().api.signUpEmail({ body: { email, password: PASSWORD, name: `Pengguna Uji ${seq}` } });
  const id = signUp.user.id;
  const role = opts.role ?? (opts.partner ? PARTNER_ROLE[opts.partner.type] : 'faskes');
  await db().update(user).set({ emailVerified: true, role }).where(eq(user.id, id));
  if (opts.partner) {
    const t = opts.partner.type;
    const status = opts.partner.status ?? 'verified';
    await db()
      .insert(partners)
      .values({
        userId: id,
        partnerType: t,
        businessName: `Mitra Uji ${seq}`,
        status,
        verifiedAt: status === 'verified' ? new Date() : null,
        strNo: t === 'tenaga_medis' ? `STR-UJI-${seq}` : null,
        specialty: t === 'tenaga_medis' ? 'Dokter umum' : null,
        facilityKind: t === 'fasilitas' ? (opts.partner.facilityKind ?? 'klinik') : null,
        field: t === 'gaya_hidup' ? 'Kebugaran' : null,
        siaNo: t === 'apotek' ? `SIA-UJI-${seq}` : null,
      });
  }
  for (const facilityId of opts.facilityIds ?? []) {
    await db().insert(memberships).values({ userId: id, facilityId });
  }

  const agent = request.agent(getApp());
  const login = await agent.post('/v1/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password: PASSWORD });
  if (login.status !== 200) throw new Error(`Login gagal: ${login.status} ${JSON.stringify(login.body)}`);

  if (opts.mfa) {
    const enable = await agent.post('/v1/auth/two-factor/enable').set('Origin', ORIGIN).send({ password: PASSWORD });
    if (enable.status !== 200) throw new Error(`Gagal mengaktifkan 2FA: ${JSON.stringify(enable.body)}`);
    const secret = new URL(String(enable.body.totpURI)).searchParams.get('secret')!;
    const verify = await agent.post('/v1/auth/two-factor/verify-totp').set('Origin', ORIGIN).send({ code: totp(secret) });
    if (verify.status !== 200) throw new Error(`Gagal verifikasi TOTP: ${JSON.stringify(verify.body)}`);
  }

  const csrfRes = await agent.get('/v1/csrf');
  return { id, email, agent, csrf: String(csrfRes.body.data.token) };
}

/** Request non-GET dengan header CSRF dan Origin tepercaya. */
export function send(u: TestUser, method: 'post' | 'put' | 'patch' | 'delete', path: string) {
  return u.agent[method](path).set('Origin', ORIGIN).set('x-csrf-token', u.csrf);
}

/** Unggah berkas ke signed URL penyimpanan lokal (pengganti R2 di uji). */
export async function uploadTo(upload: { uploadUrl: string; headers: Record<string, string> }, body: Buffer) {
  const url = new URL(upload.uploadUrl);
  return request(getApp())
    .put(url.pathname + url.search)
    .set(upload.headers)
    .send(body);
}

export { testOutbox };

/* ---------- Berkas uji (Fase 2) ---------- */

export const PDF_BYTES = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(400, 32)]);
export const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]);

/** MP4 minimal: ftyp + moov/mvhd (timescale 1000) dengan durasi tertentu. */
export function mp4Bytes(seconds: number): Buffer {
  const box = (type: string, body: Buffer) => {
    const h = Buffer.alloc(8);
    h.writeUInt32BE(8 + body.length, 0);
    h.write(type, 4, 'latin1');
    return Buffer.concat([h, body]);
  };
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 16);
  return Buffer.concat([box('ftyp', Buffer.from('isom\0\0\x02\0isomiso2mp41', 'latin1')), box('free', Buffer.alloc(64)), box('moov', box('mvhd', mvhd))]);
}

/* ---------- Persetujuan video (evaluasi USP R6) ---------- */

/** Dokter tampil sendiri dan mengunggah dari akun tenaga medisnya. */
export const CONSENT_SELF = { method: 'pernyataan_akun', subjectName: 'dr. Uji Tampil', scopes: ['profil_web'], declaration: true } as const;
/** Formulir bertanda tangan (wajib untuk akun selain tenaga medis); unggah `PDF_BYTES` ke `consentUpload`. */
export const CONSENT_DOC = {
  method: 'dokumen',
  subjectName: 'Pelatih Uji Tampil',
  scopes: ['profil_web', 'media_sosial'],
  declaration: true,
  document: { fileName: 'persetujuan.pdf', mime: 'application/pdf', sizeBytes: PDF_BYTES.length },
} as const;

/**
 * Presign → PUT berkas (dan formulir persetujuan bila ada `consentUpload`) → konfirmasi. Mengembalikan respons
 * konfirmasi tanpa assert agar uji penolakan bisa memakainya.
 */
export async function uploadMediaWithConsent(u: TestUser, facilityId: string, body: Record<string, unknown>, bytes: Buffer, consentBytes: Buffer = PDF_BYTES) {
  const presign = await send(u, 'post', `/v1/portal/facilities/${facilityId}/media/presign`).send(body);
  if (presign.status !== 201) return presign;
  const put = await uploadTo(presign.body.data, bytes);
  if (put.status !== 200) throw new Error(`unggah media gagal: ${put.status}`);
  if (presign.body.data.consentUpload) {
    const doc = await uploadTo(presign.body.data.consentUpload, consentBytes);
    if (doc.status !== 200) throw new Error(`unggah formulir persetujuan gagal: ${doc.status}`);
  }
  return send(u, 'post', `/v1/portal/facilities/${facilityId}/media/${presign.body.data.mediaId}/confirm`);
}

/** Unggah dan konfirmasi satu dokumen bukti PDF untuk permintaan harga. */
export async function attachProof(u: TestUser, requestId: string) {
  const presign = await send(u, 'post', `/v1/portal/tariff-requests/${requestId}/documents/presign`).send({
    fileName: 'bukti.pdf',
    mime: 'application/pdf',
    sizeBytes: PDF_BYTES.length,
  });
  if (presign.status !== 201) throw new Error(`presign dokumen gagal: ${JSON.stringify(presign.body)}`);
  await uploadTo(presign.body.data, PDF_BYTES);
  const confirm = await send(u, 'post', `/v1/portal/tariff-requests/${requestId}/documents/${presign.body.data.documentId}/confirm`);
  if (confirm.status !== 200) throw new Error(`konfirmasi dokumen gagal: ${JSON.stringify(confirm.body)}`);
}

/** Buang kata kunci SQL `ORDER BY` dan identifier `orderBy` sebelum uji statis kata "order/pesanan". */
export const withoutSqlOrder = (source: string) => source.replace(/\bORDER\s+BY\b/gi, '').replace(/\borderBy\b/g, '');
