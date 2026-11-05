import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index';

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;
/** Transaksi Drizzle; repo menerima `Database | Tx` agar bisa dipakai di dalam transaksi. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbOrTx = Database | Tx;

// node-postgres mengembalikan `date` sebagai objek Date di zona lokal; simpan sebagai string YYYY-MM-DD.
pg.types.setTypeParser(pg.types.builtins.DATE, (v: string) => v);
// bigint (int8) sebagai number; nominal rupiah jauh di bawah Number.MAX_SAFE_INTEGER.
pg.types.setTypeParser(pg.types.builtins.INT8, (v: string) => Number(v));

export interface CreateDbOptions {
  /** Koneksi per instance fungsi dibuat kecil (bagian 2, aturan 5). */
  max?: number;
}

export function createDb(connectionString: string, opts: CreateDbOptions = {}) {
  const pool = new pg.Pool({
    connectionString,
    max: opts.max ?? 3,
    // Membuka koneksi baru (TLS + SCRAM) butuh beberapa round-trip; ke database lintas benua bisa >1 detik.
    // Simpan koneksi menganggur lebih lama agar request berikutnya tidak membayar handshake lagi.
    idleTimeoutMillis: 120_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
  });
  // Koneksi menganggur bisa diputus server/jaringan (mis. instance fungsi dibekukan). Tanpa listener,
  // event 'error' dari pool mematikan proses; pool sudah membuang klien yang rusak dengan sendirinya.
  pool.on('error', (err) => {
    process.stderr.write(`[db] koneksi menganggur terputus: ${err.message}\n`);
  });
  const db = drizzle(pool, { schema, casing: undefined });
  return { db, pool };
}
