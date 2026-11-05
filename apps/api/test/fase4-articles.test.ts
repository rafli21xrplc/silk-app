import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { contentRules, partners } from '@silk/db';
import { ARTICLE_MAX_PENDING, publicArticleSchema, publicArticleSummarySchema } from '@silk/shared';
import { db } from '../src/lib/db';
import { createUser, getApp, resetDb, send, type TestUser } from './helpers';

/** `revalidate` asli tidak melakukan apa pun saat uji; di sini panggilannya direkam. */
const revalidateCalls = vi.hoisted(() => [] as string[][]);
vi.mock('../src/lib/revalidate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/revalidate')>();
  return {
    ...actual,
    revalidate: vi.fn(async (tagList: string[]) => {
      revalidateCalls.push(tagList);
    }),
  };
});

const BODY = [
  '## Sebelum pemeriksaan',
  'Puasa delapan sampai sepuluh jam biasanya diminta sebelum pemeriksaan gula darah puasa dan profil lemak.',
  'Minum air putih tetap diperbolehkan kecuali petugas laboratorium menyatakan lain.',
  '',
  '- Bawa kartu identitas',
  '- Catat obat yang sedang diminum',
  '',
  'Tanyakan kepada **petugas** bila ragu. Hasil pemeriksaan sebaiknya dibaca bersama tenaga medis.',
].join('\n');

const draft = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  summary: 'Persiapan sederhana sebelum pemeriksaan laboratorium agar hasilnya bisa dibaca dengan tepat.',
  body: BODY,
  ...extra,
});

async function create(u: TestUser, title: string, extra: Record<string, unknown> = {}) {
  const res = await send(u, 'post', '/v1/portal/articles').send(draft(title, extra));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data as { id: string; slug: string; status: string };
}
const submit = (u: TestUser, id: string) => send(u, 'post', `/v1/portal/articles/${id}/submit`).send({ declaration: true });
const pub = (slug: string) => request(getApp()).get(`/v1/articles/${slug}`);
const publicSlugs = async () => ((await request(getApp()).get('/v1/articles?limit=100')).body.data as { slug: string }[]).map((a) => a.slug);
const auditActions = async (id: string) =>
  (
    await db().execute<{ action: string }>(sql`SELECT action FROM audit_logs WHERE entity = 'partner_article' AND entity_id = ${id} ORDER BY created_at, id`)
  ).rows.map((r) => r.action);

describe('Fase 4: artikel oleh mitra (F-05)', () => {
  let faskes: TestUser;
  let gaya: TestUser;
  let medis: TestUser;
  let apotek: TestUser;
  let pendingPartner: TestUser;
  let pasien: TestUser;
  let moderator: TestUser;

  const approve = (id: string) => send(moderator, 'post', `/v1/admin/articles/${id}/approve`);
  async function publish(u: TestUser, title: string) {
    const a = await create(u, title);
    expect((await submit(u, a.id)).status).toBe(200);
    const res = await approve(a.id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return a;
  }

  beforeAll(async () => {
    await resetDb();
    faskes = await createUser({ partner: { type: 'fasilitas' } });
    gaya = await createUser({ partner: { type: 'gaya_hidup' } });
    medis = await createUser({ partner: { type: 'tenaga_medis' } });
    apotek = await createUser({ partner: { type: 'apotek' } });
    pendingPartner = await createUser({ partner: { type: 'gaya_hidup', status: 'pending' } });
    pasien = await createUser({ role: 'pasien' });
    moderator = await createUser({ role: 'moderator', mfa: true });
  });

  beforeEach(() => {
    revalidateCalls.length = 0;
  });

  describe('otorisasi', () => {
    it('anonim 401, pasien dan apotek 403, mitra belum terverifikasi PARTNER_NOT_VERIFIED', async () => {
      expect((await request(getApp()).get('/v1/portal/articles')).status).toBe(401);
      expect((await pasien.agent.get('/v1/portal/articles')).status).toBe(403);
      const ap = await send(apotek, 'post', '/v1/portal/articles').send(draft('Artikel dari apotek uji'));
      expect(ap.status).toBe(403);
      const pend = await send(pendingPartner, 'post', '/v1/portal/articles').send(draft('Artikel mitra menunggu'));
      expect(pend.status).toBe(403);
      expect(pend.body.error.code).toBe('PARTNER_NOT_VERIFIED');
    });

    it('non-staf tidak bisa membuka antrean admin', async () => {
      expect((await faskes.agent.get('/v1/admin/articles')).status).toBe(403);
      expect((await send(faskes, 'post', '/v1/admin/articles/00000000-0000-4000-8000-000000000000/approve')).status).toBe(403);
    });

    it('mitra lain mendapat 404 untuk semua aksi atas artikel yang bukan miliknya', async () => {
      const a = await create(gaya, 'Artikel milik mitra gaya hidup');
      const responses = await Promise.all([
        faskes.agent.get(`/v1/portal/articles/${a.id}`),
        send(faskes, 'put', `/v1/portal/articles/${a.id}`).send(draft('Diubah oleh mitra lain')),
        submit(faskes, a.id),
        send(faskes, 'post', `/v1/portal/articles/${a.id}/withdraw`).send({}),
        send(faskes, 'delete', `/v1/portal/articles/${a.id}`),
      ]);
      for (const r of responses) {
        expect(r.status).toBe(404);
        expect(r.body.error.code).toBe('ARTICLE_NOT_FOUND');
      }
      const mine = (await faskes.agent.get('/v1/portal/articles')).body.data as { id: string }[];
      expect(mine.map((x) => x.id)).not.toContain(a.id);
    });
  });

  describe('alur draf → menunggu → terbit', () => {
    it('draf dan menunggu tidak bocor; terbit tampil dengan penulis dan isi blok', async () => {
      const a = await create(gaya, 'Persiapan cek darah untuk pemula');
      expect(a.status).toBe('draft');
      expect(a.slug).toMatch(/^persiapan-cek-darah-untuk-pemula-[a-z2-9]{4}$/);
      expect((await pub(a.slug)).status).toBe(404);
      expect(await publicSlugs()).not.toContain(a.slug);

      expect((await send(gaya, 'post', `/v1/portal/articles/${a.id}/submit`).send({})).status).toBe(400);
      const sub = await submit(gaya, a.id);
      expect(sub.status).toBe(200);
      expect(sub.body.data.status).toBe('pending');
      expect((await pub(a.slug)).status).toBe(404);
      expect(await publicSlugs()).not.toContain(a.slug);
      expect((await submit(gaya, a.id)).body.error.code).toBe('ARTICLE_NOT_EDITABLE');

      const ok = await approve(a.id);
      expect(ok.status).toBe(200);
      expect(ok.body.data.status).toBe('published');
      expect(revalidateCalls).toEqual([['articles', `article:${a.slug}`, 'sitemap']]);

      const res = await pub(a.slug);
      expect(res.status).toBe(200);
      const body = publicArticleSchema.parse(res.body.data);
      expect(body.title).toBe('Persiapan cek darah untuk pemula');
      expect(body.author).toMatchObject({ partnerType: 'gaya_hidup', profilePath: null });
      expect(body.author.name).toMatch(/^Mitra Uji/);
      expect(body.body[0]).toMatchObject({ style: 'h2' });
      expect(body.body.some((b) => b.listItem === 'bullet')).toBe(true);
      const list = (await request(getApp()).get('/v1/articles')).body.data as unknown[];
      expect(list.map((x) => publicArticleSummarySchema.parse(x).slug)).toContain(a.slug);
      expect(await auditActions(a.id)).toEqual(['article.create', 'article.submit', 'article.approve']);
    });

    it('isi belum lengkap tidak bisa diajukan', async () => {
      const a = await create(gaya, 'Artikel terlalu pendek', { body: 'Isi singkat.' });
      const res = await submit(gaya, a.id);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain('body');
    });

    it('transisi yang tidak sah ditolak 409; tolak wajib beralasan', async () => {
      const a = await create(faskes, 'Draf yang belum diajukan uji');
      expect((await approve(a.id)).body.error.code).toBe('ARTICLE_NOT_EDITABLE');
      expect((await send(moderator, 'post', `/v1/admin/articles/${a.id}/reject`).send({ reason: 'Belum diajukan' })).status).toBe(409);
      expect((await send(faskes, 'post', `/v1/portal/articles/${a.id}/withdraw`).send({})).status).toBe(409);
      await submit(faskes, a.id);
      expect((await send(moderator, 'post', `/v1/admin/articles/${a.id}/reject`).send({})).status).toBe(400);
      const rej = await send(moderator, 'post', `/v1/admin/articles/${a.id}/reject`).send({ reason: 'Sumber rujukan belum jelas' });
      expect(rej.status).toBe(200);
      expect(rej.body.data).toMatchObject({ status: 'rejected', rejectionReason: 'Sumber rujukan belum jelas', live: false });
      expect(revalidateCalls).toEqual([]);
      // Diubah lalu diajukan lagi.
      const edit = await send(faskes, 'put', `/v1/portal/articles/${a.id}`).send(draft('Draf yang sudah diperbaiki uji'));
      expect(edit.body.data.status).toBe('draft');
      expect((await submit(faskes, a.id)).body.data).toMatchObject({ status: 'pending', rejectionReason: null });
    });
  });

  describe('artikel terbit yang diubah', () => {
    it('kembali menunggu; versi terbit tetap tampil sampai disetujui', async () => {
      const a = await publish(medis, 'Mengenal tekanan darah tinggi');
      const noDecl = await send(medis, 'put', `/v1/portal/articles/${a.id}`).send(draft('Mengenal hipertensi sejak dini'));
      expect(noDecl.status).toBe(400);
      const edit = await send(medis, 'put', `/v1/portal/articles/${a.id}`).send(draft('Mengenal hipertensi sejak dini', { declaration: true }));
      expect(edit.status).toBe(200);
      expect(edit.body.data).toMatchObject({ status: 'pending', live: true, published: { title: 'Mengenal tekanan darah tinggi' } });
      expect((await pub(a.slug)).body.data.title).toBe('Mengenal tekanan darah tinggi');

      const before = (await pub(a.slug)).body.data as { publishedAt: string; updatedAt: string };
      const queue = (await moderator.agent.get('/v1/admin/articles')).body.data as { id: string; revision: boolean }[];
      expect(queue.find((x) => x.id === a.id)?.revision).toBe(true);
      await approve(a.id);
      const after = (await pub(a.slug)).body.data as { title: string; publishedAt: string; updatedAt: string };
      expect(after.title).toBe('Mengenal hipertensi sejak dini');
      expect(after.publishedAt).toBe(before.publishedAt);
      expect(after.updatedAt >= before.updatedAt).toBe(true);
    });

    it('revisi ditolak: versi terbit sebelumnya tetap tampil', async () => {
      const a = await publish(medis, 'Cara membaca hasil kolesterol');
      await send(medis, 'put', `/v1/portal/articles/${a.id}`).send(draft('Judul revisi yang akan ditolak', { declaration: true }));
      await send(moderator, 'post', `/v1/admin/articles/${a.id}/reject`).send({ reason: 'Judul tidak sesuai isi' });
      expect((await pub(a.slug)).body.data.title).toBe('Cara membaca hasil kolesterol');
    });
  });

  describe('tarik dan hapus', () => {
    it('ditarik mitra: hilang dari publik dan tidak muncul lagi sebelum disetujui ulang', async () => {
      const a = await publish(gaya, 'Tips tidur cukup untuk pekerja');
      revalidateCalls.length = 0;
      const w = await send(gaya, 'post', `/v1/portal/articles/${a.id}/withdraw`).send({ reason: 'Akan diperbarui' });
      expect(w.status).toBe(200);
      expect(w.body.data).toMatchObject({ status: 'withdrawn', live: false });
      expect(revalidateCalls).toEqual([['articles', `article:${a.slug}`, 'sitemap']]);
      expect((await pub(a.slug)).status).toBe(404);

      const edit = await send(gaya, 'put', `/v1/portal/articles/${a.id}`).send(draft('Tips tidur cukup, versi baru'));
      expect(edit.body.data).toMatchObject({ status: 'draft', live: false });
      expect((await pub(a.slug)).status).toBe(404);
      expect((await submit(gaya, a.id)).body.data).toMatchObject({ status: 'pending', live: false });
      expect((await pub(a.slug)).status).toBe(404);
      await approve(a.id);
      expect((await pub(a.slug)).body.data.title).toBe('Tips tidur cukup, versi baru');
    });

    it('moderator menurunkan dengan alasan wajib', async () => {
      const a = await publish(faskes, 'Artikel yang akan diturunkan');
      expect((await send(moderator, 'post', `/v1/admin/articles/${a.id}/withdraw`).send({})).status).toBe(400);
      const res = await send(moderator, 'post', `/v1/admin/articles/${a.id}/withdraw`).send({ reason: 'Klaim tidak didukung rujukan' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'withdrawn', withdrawnReason: 'Klaim tidak didukung rujukan' });
      expect((await pub(a.slug)).status).toBe(404);
      expect(await auditActions(a.id)).toContain('article.staff_withdraw');
    });

    it('hanya artikel yang belum pernah terbit yang bisa dihapus', async () => {
      const published = await publish(faskes, 'Artikel terbit tidak bisa dihapus');
      expect((await send(faskes, 'delete', `/v1/portal/articles/${published.id}`)).body.error.code).toBe('ARTICLE_NOT_EDITABLE');
      const d = await create(faskes, 'Draf yang akan dihapus uji');
      expect((await send(faskes, 'delete', `/v1/portal/articles/${d.id}`)).status).toBe(200);
      expect((await faskes.agent.get(`/v1/portal/articles/${d.id}`)).status).toBe(404);
      expect(await auditActions(d.id)).toEqual(['article.create', 'article.delete']);
    });
  });

  describe('filter konten M17', () => {
    it('klaim kesembuhan ditolak saat diajukan; status tetap draf', async () => {
      const a = await create(gaya, 'Ramuan herbal untuk diabetes', { body: `${BODY}\n\nDengan ramuan ini Anda pasti sembuh dalam seminggu.` });
      const res = await submit(gaya, a.id);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('CONTENT_RULE_VIOLATION');
      expect((await gaya.agent.get(`/v1/portal/articles/${a.id}`)).body.data.status).toBe('draft');
    });

    it('aturan tinjau menandai artikel untuk moderator', async () => {
      const a = await create(faskes, 'Paket pemeriksaan untuk keluarga', { body: `${BODY}\n\nAda promo pemeriksaan keluarga bulan ini.` });
      expect((await submit(faskes, a.id)).body.data.needsReview).toBe(true);
      const detail = await moderator.agent.get(`/v1/admin/articles/${a.id}`);
      expect(detail.body.data.violations).toContainEqual({ field: 'body', match: 'promo', level: 'tinjau' });
    });

    it('aturan blokir baru menyembunyikan artikel yang sudah terbit', async () => {
      const a = await publish(medis, 'Artikel dengan kata zzlaranganbaru');
      expect((await pub(a.slug)).status).toBe(200);
      const [rule] = await db().insert(contentRules).values({ pattern: 'zzlaranganbaru', kind: 'kata', level: 'blokir' }).returning();
      try {
        expect((await pub(a.slug)).status).toBe(404);
        expect(await publicSlugs()).not.toContain(a.slug);
      } finally {
        await db().delete(contentRules).where(eq(contentRules.id, rule!.id));
      }
      expect((await pub(a.slug)).status).toBe(200);
    });
  });

  it('mitra yang tidak lagi terverifikasi: artikelnya tersembunyi', async () => {
    const owner = await createUser({ partner: { type: 'gaya_hidup' } });
    const a = await publish(owner, 'Artikel mitra yang dicabut');
    await db().update(partners).set({ status: 'rejected' }).where(eq(partners.userId, owner.id));
    expect((await pub(a.slug)).status).toBe(404);
    expect(await publicSlugs()).not.toContain(a.slug);
  });

  it(`maksimal ${ARTICLE_MAX_PENDING} artikel menunggu per mitra`, async () => {
    const owner = await createUser({ partner: { type: 'tenaga_medis' } });
    for (let i = 0; i < ARTICLE_MAX_PENDING; i++) {
      const a = await create(owner, `Artikel antrean nomor ${i + 1}`);
      expect((await submit(owner, a.id)).status).toBe(200);
    }
    const extra = await create(owner, 'Artikel antrean berlebih');
    const res = await submit(owner, extra.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ARTICLE_PENDING_LIMIT');
  });

  it('ringkasan admin menghitung artikel menunggu', async () => {
    const res = await moderator.agent.get('/v1/admin/overview');
    expect(res.body.data.articles).toBeGreaterThan(0);
  });

  it('menerbitkan artikel tidak mengubah urutan pencarian profil', async () => {
    const order = async (q: string) => ((await request(getApp()).get(`/v1/facilities?limit=100${q}`)).body.data as { id: string }[]).map((f) => f.id);
    const queries = ['', '&sort=name', '&q=lab', '&lat=-7.98&lng=112.63'];
    const before = await Promise.all(queries.map(order));
    const owner = await createUser({ partner: { type: 'fasilitas' } });
    await publish(owner, 'Artikel tidak memengaruhi urutan');
    await publish(owner, 'Artikel kedua dari mitra yang sama');
    expect(await Promise.all(queries.map(order))).toEqual(before);
  });
});
