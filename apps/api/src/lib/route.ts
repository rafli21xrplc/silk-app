import type { Request, RequestHandler, Response, Router } from 'express';
import { z, type ZodType } from 'zod';
import { AppError, zodDetails } from './errors';
import { errorSchema, registry } from './openapi';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface HandlerResult {
  data?: unknown;
  meta?: Record<string, unknown>;
  status?: number;
  /** `public` = respons publik boleh di-cache CDN (`s-maxage`). */
  cache?: 'public' | 'none';
}

export interface RouteDef<
  Q extends ZodType | undefined,
  B extends ZodType | undefined,
  P extends ZodType | undefined,
> {
  method: Method;
  /** Path relatif terhadap /v1, gaya Express (`/facilities/:slug`). */
  path: string;
  summary: string;
  tags: string[];
  /** Hanya untuk dokumentasi; penegakan lewat `middleware`. */
  security?: 'session' | 'session+mfa' | 'cron' | 'signature';
  query?: Q;
  body?: B;
  params?: P;
  response?: ZodType;
  successStatus?: number;
  middleware?: RequestHandler[];
  handler: (
    input: {
      query: Q extends ZodType ? z.output<Q> : undefined;
      body: B extends ZodType ? z.output<B> : undefined;
      params: P extends ZodType ? z.output<P> : undefined;
    },
    req: Request,
    res: Response,
  ) => Promise<HandlerResult>;
}

function parseOrThrow<T extends ZodType>(schema: T, value: unknown, where: string): z.output<T> {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new AppError('VALIDATION_FAILED', `Data ${where} tidak valid`, zodDetails(r.error));
  }
  return r.data;
}

/**
 * Daftarkan rute Express dan dokumen OpenAPI-nya sekaligus. Validasi Zod dilakukan di sini,
 * sehingga controller hanya menerima input yang sudah lolos skema.
 */
export function defineRoute<
  Q extends ZodType | undefined = undefined,
  B extends ZodType | undefined = undefined,
  P extends ZodType | undefined = undefined,
>(router: Router, basePath: string, def: RouteDef<Q, B, P>): void {
  const fullPath = `${basePath}${def.path}`.replace(/(.)\/$/, '$1');
  const status = def.successStatus ?? (def.method === 'post' ? 201 : 200);

  registry.registerPath({
    method: def.method,
    path: `/v1${fullPath}`.replace(/:([A-Za-z0-9_]+)/g, '{$1}'),
    summary: def.summary,
    tags: def.tags,
    ...(def.security ? { description: `Keamanan: ${def.security}` } : {}),
    request: {
      ...(def.query ? { query: def.query as never } : {}),
      ...(def.params ? { params: def.params as never } : {}),
      ...(def.body ? { body: { content: { 'application/json': { schema: def.body } } } } : {}),
    },
    responses: {
      [status]: def.response
        ? {
            description: 'Sukses',
            content: { 'application/json': { schema: z.object({ data: def.response, meta: z.record(z.string(), z.unknown()).optional() }) } },
          }
        : { description: 'Sukses' },
      400: { description: 'Validasi gagal', content: { 'application/json': { schema: errorSchema } } },
    },
  });

  const handler: RequestHandler = async (req, res) => {
    const input = {
      query: (def.query ? parseOrThrow(def.query, req.query, 'query') : undefined) as never,
      body: (def.body ? parseOrThrow(def.body, req.body ?? {}, 'body') : undefined) as never,
      params: (def.params ? parseOrThrow(def.params, req.params, 'path') : undefined) as never,
    };
    const result = await def.handler(input, req, res);
    if (res.headersSent) return;
    const code = result.status ?? status;
    if (result.cache === 'public' && def.method === 'get') {
      res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    } else if (!res.get('Cache-Control')) {
      res.set('Cache-Control', 'no-store');
    }
    if (code === 204) {
      res.status(204).end();
      return;
    }
    res.status(code).json({ data: result.data ?? null, ...(result.meta ? { meta: result.meta } : {}) });
  };

  router[def.method](def.path, ...(def.middleware ?? []), handler);
}
