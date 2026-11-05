import express, { Router } from 'express';
import { AppError } from './errors';
import { isProduction } from './env';
import { LocalStorage, storage } from './storage';

/** Pengganti endpoint R2 untuk dev/test saja. Tidak dipasang di produksi. */
export function devStorageRouter(): Router | null {
  if (isProduction()) return null;
  const s = storage();
  if (!(s instanceof LocalStorage)) return null;
  const router = Router();
  router.put('/upload', express.raw({ type: '*/*', limit: '12mb' }), async (req, res) => {
    const q = req.query as Record<string, string>;
    if (!q.key || !q.ct || !q.size || !q.exp || !q.sig || !s.verifyUpload({ key: q.key, ct: q.ct, size: q.size, exp: q.exp, sig: q.sig })) {
      throw new AppError('FORBIDDEN', 'Tanda tangan unggahan tidak valid');
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (req.get('content-type') !== q.ct || body.length !== Number(q.size)) {
      throw new AppError('VALIDATION_FAILED', 'Tipe atau ukuran berkas tidak sesuai tanda tangan');
    }
    await s.put(q.key, body, q.ct);
    res.status(200).end();
  });
  router.get('/file', async (req, res) => {
    const q = req.query as Record<string, string>;
    if (!q.key || !q.exp || !q.sig || !s.verifyGet({ key: q.key, exp: q.exp, sig: q.sig })) {
      throw new AppError('FORBIDDEN', 'Tautan tidak valid atau kedaluwarsa');
    }
    const info = await s.head(q.key);
    if (!info) throw new AppError('NOT_FOUND', 'Berkas tidak ditemukan');
    res.set('Content-Type', info.contentType ?? 'application/octet-stream');
    res.set('Cache-Control', 'private, no-store');
    res.send(await s.readAll(q.key));
  });
  return router;
}
