import pino from 'pino';

/** Log terstruktur ke stdout; tanpa data pribadi (bagian 3). */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { service: 'silk-api' },
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-csrf-token"]',
      'res.headers["set-cookie"]',
      '*.email',
      '*.password',
      '*.contactEmail',
    ],
    censor: '[disensor]',
  },
});
