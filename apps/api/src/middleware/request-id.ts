import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Setiap request punya `requestId` untuk log dan respons error. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[A-Za-z0-9._-]{8,100}$/.test(incoming) ? incoming : randomUUID();
  res.set('x-request-id', req.id);
  next();
};
