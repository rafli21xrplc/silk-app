import express, { Router } from 'express';
import { defineRoute } from '../../lib/route';
import { handleSanityWebhook } from './content.service';

export function contentRoutes(router: Router): void {
  defineRoute(router, '/webhooks', {
    method: 'post',
    path: '/sanity',
    summary: 'Webhook Sanity: filter konten M17 dan revalidate artikel (M12)',
    tags: ['Webhook'],
    security: 'signature',
    successStatus: 200,
    // Body mentah dibutuhkan untuk verifikasi tanda tangan.
    middleware: [express.text({ type: '*/*', limit: '1mb' })],
    handler: async (_input, req) => ({
      data: await handleSanityWebhook(typeof req.body === 'string' ? req.body : '', req.get('sanity-webhook-signature')),
    }),
  });
}
