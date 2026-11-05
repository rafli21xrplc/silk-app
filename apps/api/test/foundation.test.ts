import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApp, resetDb } from './helpers';

describe('Fondasi API (T2)', () => {
  beforeAll(() => resetDb());

  it('GET /v1/health mengembalikan status dan versi', async () => {
    const res = await request(getApp()).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ok', database: 'ok' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('rute tidak dikenal memakai format error seragam dengan requestId', async () => {
    const res = await request(getApp()).get('/v1/tidak-ada');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('query tidak valid = 400 VALIDATION_FAILED dengan detail', async () => {
    const res = await request(getApp()).get('/v1/facilities?radius=5000');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('header keamanan dari helmet terpasang', async () => {
    const res = await request(getApp()).get('/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeTruthy();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('dokumen OpenAPI dihasilkan dari skema Zod', async () => {
    const res = await request(getApp()).get('/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(['/v1/facilities', '/v1/compare', '/v1/portal/tariffs/{id}', '/v1/admin/imports/{id}/publish']),
    );
  });

  it('pengurutan berbasis pembayaran tidak tersedia (prinsip 1)', async () => {
    const res = await request(getApp()).get('/v1/facilities?sort=sponsored');
    expect(res.status).toBe(400);
  });
});
