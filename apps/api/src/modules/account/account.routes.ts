import type { Request } from 'express';
import type { Router } from 'express';
import { meResponseSchema, profileUpdateSchema, type ProfileUpdateInput } from '@silk/shared';
import { z } from 'zod';
import { actorFrom } from '../../lib/context';
import { defineRoute, type HandlerResult } from '../../lib/route';
import { requirePermission } from '../../middleware/auth';
import { verifyCsrf } from '../../middleware/csrf';
import * as service from './account.service';

const tags = ['Autentikasi'];

async function getMe(_i: unknown, req: Request): Promise<HandlerResult> {
  return { data: await service.me(req.auth!.user) };
}

async function patchMe(i: { body: ProfileUpdateInput }, req: Request): Promise<HandlerResult> {
  return { data: await service.updateProfile(actorFrom(req), i.body) };
}

/** Router /v1/me: sudah melewati loadSession. */
export function accountRoutes(router: Router): void {
  const self = requirePermission('account.self');
  defineRoute(router, '/me', {
    method: 'get',
    path: '/',
    summary: 'Profil, keanggotaan faskes, dan data mitra pengguna yang masuk',
    tags,
    security: 'session',
    response: meResponseSchema,
    middleware: [self],
    handler: getMe,
  });
  defineRoute(router, '/me', {
    method: 'patch',
    path: '/',
    summary: 'Ubah nama dan nomor HP',
    tags,
    security: 'session',
    body: profileUpdateSchema,
    response: z.object({ name: z.string(), phone: z.string().nullable() }),
    middleware: [self, verifyCsrf],
    handler: patchMe,
  });
}
