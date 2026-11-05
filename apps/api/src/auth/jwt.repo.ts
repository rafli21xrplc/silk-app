import { and, eq, gt } from 'drizzle-orm';
import { jwks, session, user, type DbOrTx } from '@silk/db';

/** Kunci publik JWKS berdasarkan `kid` (= jwks.id). Private key tidak pernah dibaca di sini. */
export async function findPublicKey(db: DbOrTx, kid: string) {
  const [row] = await db
    .select({ publicKey: jwks.publicKey, alg: jwks.alg, expiresAt: jwks.expiresAt })
    .from(jwks)
    .where(eq(jwks.id, kid))
    .limit(1);
  return row ?? null;
}

/** Sesi yang masih berlaku beserta penggunanya. JWT dianggap dicabut bila sesinya tidak ada lagi. */
export async function findLiveSession(db: DbOrTx, sessionId: string, userId: string, now: Date) {
  const [row] = await db
    .select({
      sessionId: session.id,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      banned: user.banned,
      banExpires: user.banExpires,
    })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .where(and(eq(session.id, sessionId), eq(session.userId, userId), gt(session.expiresAt, now)))
    .limit(1);
  return row ?? null;
}
