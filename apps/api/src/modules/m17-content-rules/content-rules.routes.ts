import { Router } from 'express';
import { contentRuleCreateSchema, contentRuleUpdateSchema } from '@silk/shared';
import { defineRoute } from '../../lib/route';
import * as c from './content-rules.controller';

/** Dipasang di bawah /v1/admin (sudah melewati requireAdmin + CSRF). */
export function contentRulesRoutes(router: Router): void {
  const base = '/admin';
  defineRoute(router, base, {
    method: 'get',
    path: '/content-rules',
    summary: 'Daftar aturan konten (M17)',
    tags: ['Admin'],
    security: 'session+mfa',
    handler: () => c.list(),
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/content-rules',
    summary: 'Tambah aturan konten tanpa deploy (M17)',
    tags: ['Admin'],
    security: 'session+mfa',
    body: contentRuleCreateSchema,
    handler: (input, req) => c.create(input, req),
  });
  defineRoute(router, base, {
    method: 'patch',
    path: '/content-rules/:id',
    summary: 'Aktifkan atau nonaktifkan aturan konten',
    tags: ['Admin'],
    security: 'session+mfa',
    params: c.idParams,
    body: contentRuleUpdateSchema,
    handler: (input, req) => c.update(input, req),
  });
}

/** Publik: aturan aktif, agar web dapat menjalankan filter yang sama pada konten CMS (M12/M17). */
export function publicContentRulesRoutes(router: Router): void {
  defineRoute(router, '', {
    method: 'get',
    path: '/content-rules/active',
    summary: 'Aturan konten aktif (publik)',
    tags: ['Publik'],
    handler: () => c.listActive(),
  });
}
