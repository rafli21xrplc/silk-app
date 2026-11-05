import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ErrorBody } from '@silk/shared';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ErrorBody = { error: { code: 'NOT_FOUND', message: 'Rute tidak ditemukan' }, requestId: String(req.id) };
  res.status(404).json(body);
};

/** Format error seragam: `{ error: { code, message, details }, requestId }`. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err, requestId: String(req.id) }, err.message);
    const body: ErrorBody = {
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      requestId: String(req.id),
    };
    res.status(err.status).json(body);
    return;
  }
  // Body JSON rusak atau terlalu besar dari express.json()
  const e = err as { type?: string; status?: number };
  if (e.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'JSON tidak valid' }, requestId: String(req.id) });
    return;
  }
  if (e.type === 'entity.too.large') {
    res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'Body terlalu besar' }, requestId: String(req.id) });
    return;
  }
  logger.error({ err, requestId: String(req.id) }, 'error tak tertangani');
  const body: ErrorBody = { error: { code: 'INTERNAL', message: 'Terjadi kesalahan pada server' }, requestId: String(req.id) };
  res.status(500).json(body);
};
