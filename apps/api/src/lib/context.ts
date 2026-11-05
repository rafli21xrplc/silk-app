import type { Request } from 'express';
import type { UserRole } from '@silk/shared';

/** Konteks pelaku yang diteruskan ke service (service tidak memakai `req`). */
export interface ActorContext {
  actorId: string | null;
  role: UserRole | null;
  ip: string | null;
  requestId: string;
}

export function actorFrom(req: Request): ActorContext {
  return {
    actorId: req.auth?.user.id ?? null,
    role: (req.auth?.user.role as UserRole | undefined) ?? null,
    ip: req.ip ?? null,
    requestId: String(req.id),
  };
}

export function requireActorId(ctx: ActorContext): string {
  if (!ctx.actorId) throw new Error('actorId wajib pada konteks terautentikasi');
  return ctx.actorId;
}
