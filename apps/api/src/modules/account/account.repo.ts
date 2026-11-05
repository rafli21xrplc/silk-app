import { eq } from 'drizzle-orm';
import { user, type DbOrTx } from '@silk/db';

export async function findProfile(db: DbOrTx, userId: string) {
  const [row] = await db.select({ name: user.name, phone: user.phone }).from(user).where(eq(user.id, userId)).limit(1);
  return row ?? null;
}

/** Hanya nama dan telepon; email, role, dan status blokir diubah lewat alur Better Auth. */
export async function updateProfile(db: DbOrTx, userId: string, data: { name: string; phone: string | null }) {
  const [row] = await db
    .update(user)
    .set({ name: data.name, phone: data.phone, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning({ name: user.name, phone: user.phone });
  return row ?? null;
}
