import { createDb, type Database } from '@silk/db';
import { env } from './env';

let instance: { db: Database; close: () => Promise<void> } | undefined;

/** Satu pool kecil per instance fungsi, dibuat saat pertama dipakai. */
export function db(): Database {
  if (!instance) {
    const { db: database, pool } = createDb(env().DATABASE_URL, { max: env().NODE_ENV === 'test' ? 5 : 3 });
    instance = { db: database, close: () => pool.end() };
  }
  return instance.db;
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = undefined;
  }
}
