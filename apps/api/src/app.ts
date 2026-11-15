import { sql } from 'drizzle-orm';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { toNodeHandler } from 'better-auth/node';
import { getAuth } from './auth/auth';
import { jobsRoutes } from './jobs/jobs.routes';
import { db } from './lib/db';
import { devStorageRouter } from './lib/dev-storage.routes';
import { env, isProduction } from './lib/env';
import { logger } from './lib/logger';
import { generateOpenApiDocument } from './lib/openapi';
import { loadSession, requireAdmin, requireAuth, requireFlag, requirePermission } from './middleware/auth';
import { issueCsrf, verifyCsrf } from './middleware/csrf';
import { errorHandler, notFoundHandler } from './middleware/error';
import { requestId } from './middleware/request-id';
import { directoryRoutes } from './modules/m1-directory/directory.routes';
import { contentRoutes } from './modules/m12-content/content.routes';
import { publicContentRulesRoutes } from './modules/m17-content-rules/content-rules.routes';
import { reportsRoutes } from './modules/m14-reports/reports.routes';
import { adminRoutes } from './modules/m15-admin/admin.routes';
import { tariffsRoutes } from './modules/m2-tariffs/tariffs.routes';
import { compareRoutes } from './modules/m3-compare/compare.routes';
import { trustRoutes } from './modules/m4-trust/trust.routes';
import { portalRoutes } from './modules/m6-portal/portal.routes';
import { adminArticleRoutes, portalArticleRoutes, publicArticleRoutes } from './modules/articles/articles.routes';
import { accountRoutes } from './modules/account/account.routes';
import { partnerRoutes } from './modules/partners/partners.routes';
import { adminReviewRoutes, publicReviewRoutes, reviewWriteRoutes } from './modules/reviews/reviews.routes';
import { devDuitkuSimulator, partnerSubscriptionRoutes, paymentWebhookRoutes } from './modules/subscriptions/subscriptions.routes';

const VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.npm_package_version ?? 'dev';

function router(register: (r: Router) => void): Router {
  const r = Router();
  register(r);
  return r;
}

export function createApp(): Express {
  const e = env();
  const app = express();
  app.set('trust proxy', true); // di belakang proxy Vercel/Cloudflare
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id,
      autoLogging: { ignore: (req) => req.url === '/v1/health' },
      serializers: {
        req: (req: { method: string; url: string; id: string }) => ({ method: req.method, url: req.url?.split('?')[0], id: req.id }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: [e.WEB_ORIGIN],
      credentials: true,
      // x-captcha-response: token Turnstile untuk daftar/masuk Better Auth.
      allowedHeaders: ['content-type', 'x-csrf-token', 'x-request-id', 'x-captcha-response'],
      exposedHeaders: ['x-request-id'],
    }),
  );

  // Better Auth: endpoint admin-nya juga wajib MFA (M15). Dipasang sebelum express.json.
  app.use('/v1/auth/admin', loadSession, requireAdmin);
  // JWT hanya untuk pasien dan mitra; staf memakai sesi cookie + TOTP (matriks auth.token).
  app.get('/v1/auth/token', loadSession, requireAuth, requirePermission('auth.token'), (_req, _res, next) => next());
  app.all('/v1/auth/*splat', toNodeHandler(getAuth()));

  // Rute yang membutuhkan body mentah dipasang sebelum parser JSON.
  app.use('/v1/webhooks', router(contentRoutes));
  // Fase 11: callback Duitku (form-urlencoded, tanda tangan HMAC). Flag dicek di rute.
  app.use('/v1/payments', router(paymentWebhookRoutes));
  // Halaman bayar tiruan saat kunci Duitku kosong; tidak pernah dipasang di produksi.
  if (!isProduction()) app.use('/v1/dev/duitku', devDuitkuSimulator());
  const devStorage = devStorageRouter();
  if (devStorage) app.use('/v1/dev/storage', devStorage);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/v1/health', async (_req, res) => {
    let database = 'ok';
    try {
      await db().execute(sql`select 1`);
    } catch {
      database = 'error';
    }
    res.set('Cache-Control', 'no-store');
    res.status(database === 'ok' ? 200 : 503).json({ data: { status: database === 'ok' ? 'ok' : 'degraded', version: VERSION, database, time: new Date().toISOString() } });
  });
  app.get('/v1/openapi.json', (_req, res) => {
    res.json(generateOpenApiDocument(e.API_ORIGIN));
  });
  app.get('/v1/csrf', issueCsrf);

  app.use(
    '/v1',
    router((r) => {
      directoryRoutes(r);
      tariffsRoutes(r);
      compareRoutes(r);
      trustRoutes(r);
      reportsRoutes(r);
      publicContentRulesRoutes(r);
      publicArticleRoutes(r);
      publicReviewRoutes(r);
    }),
  );
  app.use('/v1/internal', router(jobsRoutes));
  app.use('/v1/me', loadSession, router(accountRoutes));
  // Fase 6 ramping (evaluasi USP R8): flag dicek sebelum sesi agar saat OFF semua rute 404 tanpa kerja lain.
  app.use('/v1/reviews', requireFlag('reviews_enabled'), loadSession, requirePermission('review.write'), verifyCsrf, router(reviewWriteRoutes));
  app.use('/v1/partners', loadSession, requirePermission('partner.self'), verifyCsrf, router((r) => {
      partnerRoutes(r);
      partnerSubscriptionRoutes(r);
    }));
  app.use('/v1/portal', loadSession, requirePermission('portal.facility'), verifyCsrf, router((r) => {
      portalRoutes(r);
      portalArticleRoutes(r);
    }));
  app.use('/v1/admin', loadSession, requireAdmin, verifyCsrf, router((r) => {
      adminRoutes(r);
      adminArticleRoutes(r);
      adminReviewRoutes(r);
    }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
