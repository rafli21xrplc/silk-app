import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditLogs, importRows, tariffs, tariffVersions } from '@silk/db';
import { db } from '../src/lib/db';
import { createUser, getApp, resetDb, send, uploadTo, type TestUser } from './helpers';

const HEADER = 'facility_name,city,service_slug,price_type,price_min,price_max,effective_from,source_title,source_url';
const FACILITIES = [
  ['Klinik Pratama Sehat Contoh', 'Kota Malang'],
  ['Laboratorium Klinik Contoh Medika', 'Kota Malang'],
  ['Klinik Utama Contoh Kepanjen', 'Kabupaten Malang'],
  ['Laboratorium Contoh Belum Diklaim', 'Kota Malang'],
] as const;
const SERVICES = ['hemoglobin', 'darah-lengkap', 'gula-darah-puasa', 'kolesterol-total', 'asam-urat', 'urin-lengkap'];

/** 500 baris: 480 valid unik + 20 galat (berbagai jenis kesalahan). */
function buildCsv(): string {
  const lines = [HEADER];
  let n = 0;
  outer: for (const [name, city] of FACILITIES) {
    for (const svc of SERVICES) {
      for (let month = 1; month <= 20; month++) {
        if (n >= 480) break outer;
        const day = String(month).padStart(2, '0');
        lines.push(`${name},${city},${svc},tetap,${10000 + n * 10},,2025-${month <= 12 ? day : '12'}-${month <= 12 ? '01' : String(month).padStart(2, '0')},Perda Uji No. 1/2025,https://contoh.test/perda`);
        n++;
      }
    }
  }
  const bad = [
    'Klinik Pratama Sehat Contoh,Kota Malang,layanan-tidak-ada,tetap,1000,,2025-01-01,Perda Uji,',
    'Klinik Pratama Sehat Contoh,Kota Malang,hemoglobin,rentang,5000,1000,2025-02-02,Perda Uji,',
    'Klinik Pratama Sehat Contoh,Kota Malang,hemoglobin,tetap,abc,,2025-02-03,Perda Uji,',
    'Klinik Pratama Sehat Contoh,Kota Malang,hemoglobin,tetap,1000,,03/02/2025,Perda Uji,',
    'Faskes Fiktif Tidak Ada Sama Sekali,Kota Malang,hemoglobin,tetap,1000,,2025-02-04,Perda Uji,',
  ];
  for (let i = 0; i < 20; i++) lines.push(bad[i % bad.length]!);
  return lines.join('\n') + '\n';
}

describe('M5 Data awal publik', () => {
  let admin: TestUser;
  const csv = buildCsv();

  beforeAll(async () => {
    await resetDb();
    admin = await createUser({ role: 'admin', mfa: true });
  });

  async function importCsv(content: string) {
    const presign = await send(admin, 'post', '/v1/admin/imports/presign').send({ fileName: 'perda.csv', sizeBytes: Buffer.byteLength(content) });
    expect(presign.status, JSON.stringify(presign.body)).toBe(201);
    expect((await uploadTo(presign.body.data, Buffer.from(content))).status).toBe(200);
    const created = await send(admin, 'post', '/v1/admin/imports').send({ objectKey: presign.body.data.objectKey, sourceKind: 'perda' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    return created.body.data.batch as { id: string; status: string; counts: Record<string, number> };
  }

  let firstBatchId = '';

  it('M5-1: 500 baris dengan 20 galat → laporan galat per baris tanpa menggagalkan baris valid', async () => {
    expect(csv.trim().split('\n')).toHaveLength(501);
    const batch = await importCsv(csv);
    firstBatchId = batch.id;
    expect(batch.status).toBe('divalidasi');
    expect(batch.counts).toMatchObject({ valid: 480, galat: 20, ambigu: 0, pending: 0 });
    const detail = await admin.agent.get(`/v1/admin/imports/${batch.id}`);
    expect(detail.body.data.problemRows.length).toBe(20);
    for (const r of detail.body.data.problemRows) {
      expect(r.rowNo).toBeGreaterThan(1);
      expect(r.errors.length).toBeGreaterThan(0);
    }
    const codes = new Set(detail.body.data.problemRows.flatMap((r: { errors: { code: string }[] }) => r.errors.map((e) => e.code)));
    expect(codes).toEqual(new Set(['SERVICE_NOT_FOUND', 'IMPORT_ROW_INVALID', 'FACILITY_NOT_FOUND']));
  });

  it('terbitkan: tarif hasil impor memakai verifikasi dari_dokumen_publik dan sumber dokumen', async () => {
    const res = await send(admin, 'post', `/v1/admin/imports/${firstBatchId}/publish`).send({});
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.created + res.body.data.skipped).toBe(480);
    const pub = await request(getApp()).get('/v1/facilities/laboratorium-contoh-belum-diklaim');
    const hb = pub.body.data.tariffs.find((t: { service: { slug: string } }) => t.service.slug === 'hemoglobin');
    expect(hb.trust.verification).toBe('dari_dokumen_publik');
    expect(hb.trust.source).toMatchObject({ kind: 'perda', title: 'Perda Uji No. 1/2025' });
  });

  it('M5-3: mengunggah ulang berkas yang sama tidak menggandakan tarif', async () => {
    const before = await db().select({ n: sql<number>`count(*)::int` }).from(tariffVersions);
    const batch = await importCsv(csv);
    const res = await send(admin, 'post', `/v1/admin/imports/${batch.id}/publish`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ created: 0, skipped: 480 });
    const after = await db().select({ n: sql<number>`count(*)::int` }).from(tariffVersions);
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it('M5-2: penerbitan transaksional — gagal sebagian berarti tidak ada yang terbit', async () => {
    const content = [
      HEADER,
      'Klinik Pratama Sehat Contoh,Kota Malang,urin-lengkap,tetap,20000,,2026-03-01,Perda Uji 2,',
      'Klinik Utama Contoh Kepanjen,Kabupaten Malang,urin-lengkap,tetap,22000,,2026-03-01,Perda Uji 2,',
    ].join('\n');
    const batch = await importCsv(content);
    expect(batch.counts.valid).toBe(2);
    // Rusak satu baris valid agar INSERT melanggar CHECK database saat terbit.
    const [last] = await db().select().from(importRows).where(eq(importRows.batchId, batch.id)).orderBy(sql`row_no DESC`).limit(1);
    await db().update(importRows).set({ parsed: { ...last!.parsed, priceType: 'rentang', priceMin: 5000, priceMax: 1 } }).where(eq(importRows.id, last!.id));
    const before = await db().select({ n: sql<number>`count(*)::int` }).from(tariffVersions);
    const res = await send(admin, 'post', `/v1/admin/imports/${batch.id}/publish`).send({});
    expect(res.status).toBe(500);
    const after = await db().select({ n: sql<number>`count(*)::int` }).from(tariffVersions);
    expect(after[0]!.n).toBe(before[0]!.n);
    const detail = await admin.agent.get(`/v1/admin/imports/${batch.id}`);
    expect(detail.body.data.batch.status).toBe('divalidasi');
  });

  it('kecocokan ambigu masuk antrean dan dapat diputuskan admin', async () => {
    const content = [HEADER, 'Laboratorium Klinik Contoh,Kota Malang,asam-urat,tetap,30000,,2026-04-01,Perda Uji 3,'].join('\n');
    const batch = await importCsv(content);
    expect(batch.counts.ambigu).toBe(1);
    const detail = await admin.agent.get(`/v1/admin/imports/${batch.id}`);
    const row = detail.body.data.problemRows[0];
    expect(row.candidates.length).toBeGreaterThan(0);
    const resolved = await send(admin, 'patch', `/v1/admin/imports/${batch.id}/rows/${row.id}`).send({ facilityId: row.candidates[0].id });
    expect(resolved.status, JSON.stringify(resolved.body)).toBe(200);
    expect(resolved.body.data.status).toBe('valid');
    const pub = await send(admin, 'post', `/v1/admin/imports/${batch.id}/publish`).send({});
    expect(pub.body.data.created).toBe(1);
  });

  it('beberapa tanggal berlaku untuk satu tarif dalam satu berkas: versi berurutan, versi terakhir menjadi saat ini', async () => {
    const content = [
      HEADER,
      'Klinik Pratama Sehat Contoh,Kota Malang,kolesterol-total,tetap,40000,,2024-01-01,Perda Uji 4,',
      'Klinik Pratama Sehat Contoh,Kota Malang,kolesterol-total,tetap,45000,,2024-06-01,Perda Uji 4,',
      'Klinik Pratama Sehat Contoh,Kota Malang,kolesterol-total,tetap,47000,,2024-09-01,Perda Uji 4,',
    ].join('\n');
    const batch = await importCsv(content);
    expect(batch.counts.valid).toBe(3);
    const pub = await send(admin, 'post', `/v1/admin/imports/${batch.id}/publish`).send({});
    expect(pub.status, JSON.stringify(pub.body)).toBe(200);

    const versions = await db()
      .select({ id: tariffVersions.id, tariffId: tariffVersions.tariffId, versionNo: tariffVersions.versionNo, priceMin: tariffVersions.priceMin })
      .from(tariffVersions)
      .innerJoin(tariffs, eq(tariffs.id, tariffVersions.tariffId))
      .where(sql`${tariffVersions.effectiveFrom} IN ('2024-01-01','2024-06-01','2024-09-01') AND ${tariffVersions.priceMin} IN (40000, 45000, 47000)`)
      .orderBy(tariffVersions.versionNo);
    expect(versions).toHaveLength(3);
    expect(new Set(versions.map((v) => v.tariffId)).size).toBe(1);
    const nos = versions.map((v) => v.versionNo);
    expect(nos).toEqual([nos[0], nos[0]! + 1, nos[0]! + 2]);
    const [t] = await db().select().from(tariffs).where(eq(tariffs.id, versions[0]!.tariffId));
    expect(t!.currentVersionId).toBe(versions[2]!.id);
    expect(t!.status).toBe('terbit');
    // Setiap versi dari batch ini tercatat di audit log.
    const audits = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(
        sql`${auditLogs.action} = 'tariff.version.import' AND ${auditLogs.entityId} = ${t!.id} AND ${auditLogs.after}->>'importBatchId' = ${batch.id}`,
      );
    expect(audits[0]!.n).toBe(3);

    // Unggah ulang berkas yang sama: semua dilewati.
    const again = await importCsv(content);
    const pub2 = await send(admin, 'post', `/v1/admin/imports/${again.id}/publish`).send({});
    expect(pub2.body.data).toMatchObject({ created: 0, skipped: 3 });
  });

  it('header CSV salah → batch ditolak dengan pesan jelas', async () => {
    const batch = await importCsv('nama,harga\nA,1\n');
    expect(batch.status).toBe('ditolak');
    const detail = await admin.agent.get(`/v1/admin/imports/${batch.id}`);
    expect(detail.body.data.batch.error).toContain('Kolom wajib tidak ada');
  });
});
