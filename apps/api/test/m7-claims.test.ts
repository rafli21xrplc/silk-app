import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditLogs, facilities, memberships } from '@silk/db';
import { FACILITY_IDS } from '@silk/db/seed';
import { db } from '../src/lib/db';
import { createUser, getApp, resetDb, send, testOutbox, uploadTo, type TestUser } from './helpers';

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(200, 32)]);
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 0)]);

describe('M7 Verifikasi dan klaim profil', () => {
  let applicant: TestUser;
  let other: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    await resetDb();
    applicant = await createUser();
    other = await createUser();
    admin = await createUser({ role: 'admin', mfa: true });
  });

  async function newClaim(u: TestUser, facilityId: string) {
    const res = await send(u, 'post', '/v1/portal/claims').send({ facilityId, note: 'Saya pengelola' });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body.data.id as string;
  }

  async function uploadDoc(u: TestUser, claimId: string, body: Buffer, mime = 'application/pdf') {
    const presign = await send(u, 'post', `/v1/portal/claims/${claimId}/documents/presign`).send({
      fileName: 'izin.pdf',
      mime,
      sizeBytes: body.length,
    });
    expect(presign.status, JSON.stringify(presign.body)).toBe(201);
    expect((await uploadTo(presign.body.data, body)).status).toBe(200);
    return send(u, 'post', `/v1/portal/claims/${claimId}/documents/${presign.body.data.documentId}/confirm`);
  }

  it('M7-1: berkas .exe atau di atas 5 MB ditolak', async () => {
    const claimId = await newClaim(applicant, FACILITY_IDS.labBelumKlaim);
    const exeMime = await send(applicant, 'post', `/v1/portal/claims/${claimId}/documents/presign`).send({
      fileName: 'izin.exe',
      mime: 'application/x-msdownload',
      sizeBytes: 1000,
    });
    expect(exeMime.status).toBe(400);
    const tooBig = await send(applicant, 'post', `/v1/portal/claims/${claimId}/documents/presign`).send({
      fileName: 'izin.pdf',
      mime: 'application/pdf',
      sizeBytes: 5 * 1024 * 1024 + 1,
    });
    expect(tooBig.status).toBe(400);
    // .exe yang mengaku PDF: ditolak saat konfirmasi (magic bytes)
    const disguised = await uploadDoc(applicant, claimId, EXE);
    expect(disguised.status).toBe(422);
    expect(disguised.body.error.code).toBe('DOCUMENT_INVALID');
  });

  it('klaim tanpa dokumen tidak dapat disetujui', async () => {
    const claimId = await newClaim(other, FACILITY_IDS.labMedika);
    const res = await send(admin, 'post', `/v1/admin/claims/${claimId}/approve`).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CLAIM_DOCUMENT_REQUIRED');
  });

  it('M7-2: dokumen tidak dapat diakses lewat URL publik; admin memakai signed URL singkat', async () => {
    const claims = await applicant.agent.get('/v1/portal/claims');
    const claimId = claims.body.data[0].id as string;
    const ok = await uploadDoc(applicant, claimId, PDF);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);

    const detail = await admin.agent.get(`/v1/admin/claims/${claimId}`);
    expect(detail.status).toBe(200);
    const doc = detail.body.data.documents[0];
    expect(doc.viewUrlExpiresInSec).toBeLessThanOrEqual(300);
    const signed = new URL(doc.viewUrl);
    expect((await request(getApp()).get(signed.pathname + signed.search)).status).toBe(200);

    const key = signed.searchParams.get('key')!;
    const unsigned = await request(getApp()).get(`/v1/dev/storage/file?key=${encodeURIComponent(key)}`);
    expect(unsigned.status).toBe(403);
    const tampered = new URLSearchParams(signed.search);
    tampered.set('sig', 'palsu');
    expect((await request(getApp()).get(`${signed.pathname}?${tampered}`)).status).toBe(403);
    // Pemohon lain tidak bisa melihat klaim ini
    expect((await send(other, 'post', `/v1/portal/claims/${claimId}/documents/presign`).send({ fileName: 'a.pdf', mime: 'application/pdf', sizeBytes: 10 })).status).toBe(404);
  });

  it('persetujuan menambah membership, menaikkan verifikasi, dan tercatat di audit dengan IP', async () => {
    const claims = await applicant.agent.get('/v1/portal/claims');
    const claimId = claims.body.data[0].id as string;
    const res = await send(admin, 'post', `/v1/admin/claims/${claimId}/approve`).send({});
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const m = await db()
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, applicant.id), eq(memberships.facilityId, FACILITY_IDS.labBelumKlaim)));
    expect(m).toHaveLength(1);
    const [f] = await db().select().from(facilities).where(eq(facilities.id, FACILITY_IDS.labBelumKlaim));
    expect(f!.verification).toBe('diverifikasi_admin');
    const [log] = await db().select().from(auditLogs).where(eq(auditLogs.action, 'claim.approve'));
    expect(log!.actorId).toBe(admin.id);
    expect(log!.ip).toBeTruthy();
    expect(testOutbox.some((x) => x.kind === 'claim-disetujui' && x.to === applicant.email)).toBe(true);
  });

  it('M7-3: klaim yang ditolak menyertakan alasan yang terkirim lewat email', async () => {
    const claims = await other.agent.get('/v1/portal/claims');
    const claimId = claims.body.data[0].id as string;
    const reason = 'Nama pada izin operasional tidak sesuai dengan faskes';
    const res = await send(admin, 'post', `/v1/admin/claims/${claimId}/reject`).send({ reason });
    expect(res.status).toBe(200);
    const mail = testOutbox.find((x) => x.kind === 'claim-ditolak' && x.to === other.email);
    expect(mail?.text).toContain(reason);
  });

  it('klaim ganda yang masih menunggu ditolak 409', async () => {
    const u = await createUser();
    await newClaim(u, FACILITY_IDS.klinikKepanjen);
    const dup = await send(u, 'post', '/v1/portal/claims').send({ facilityId: FACILITY_IDS.klinikKepanjen });
    expect(dup.status).toBe(409);
  });
});
