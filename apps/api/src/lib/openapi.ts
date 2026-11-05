import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Tambahkan `.openapi()` ke prototipe Zod (dipakai registry untuk skema bernama).
extendZodWithOpenApi(z);

/** Registri OpenAPI: diisi otomatis oleh `defineRoute` saat modul dimuat (A6). */
export const registry = new OpenAPIRegistry();

const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ path: z.string().optional(), message: z.string() })).optional(),
  }),
  requestId: z.string().optional(),
});
registry.register('Error', errorSchema);

export { errorSchema };

export function generateOpenApiDocument(serverUrl: string) {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'SILK API',
      version: '1.0.0',
      description:
        'API transparansi tarif layanan kesehatan. Endpoint autentikasi dilayani Better Auth di /v1/auth/* (lihat dokumentasi Better Auth).',
    },
    servers: [{ url: serverUrl }],
  });
}
