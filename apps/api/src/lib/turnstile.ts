import { AppError } from './errors';
import { env, isProduction } from './env';
import { logger } from './logger';

/** Verifikasi token Cloudflare Turnstile di server. Tanpa secret: lewati di dev/test, tolak di produksi. */
export async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<void> {
  const secret = env().TURNSTILE_SECRET;
  if (!secret) {
    if (isProduction()) throw new AppError('TURNSTILE_FAILED', 'Verifikasi anti-bot tidak tersedia');
    return;
  }
  if (!token) throw new AppError('TURNSTILE_FAILED', 'Verifikasi anti-bot wajib');
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const json = (await res.json()) as { success?: boolean };
    if (json.success) return;
  } catch (err) {
    logger.warn({ err }, 'turnstile tidak dapat dihubungi');
  }
  throw new AppError('TURNSTILE_FAILED', 'Verifikasi anti-bot gagal');
}
