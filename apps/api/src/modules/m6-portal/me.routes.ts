import { Router } from 'express';
import { db } from '../../lib/db';
import { defineRoute } from '../../lib/route';
import { requireAuth } from '../../middleware/auth';
import { myFacilities } from './portal.repo';

export function meRoutes(router: Router): void {
  defineRoute(router, '/me', {
    method: 'get',
    path: '/',
    summary: 'Profil dan keanggotaan faskes pengguna yang masuk',
    tags: ['Autentikasi'],
    security: 'session',
    middleware: [requireAuth],
    handler: async (_i, req) => {
      const u = req.auth!.user;
      return {
        data: {
          user: {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            emailVerified: u.emailVerified,
            twoFactorEnabled: u.twoFactorEnabled,
          },
          memberships: await myFacilities(db(), u.id),
        },
      };
    },
  });
}
