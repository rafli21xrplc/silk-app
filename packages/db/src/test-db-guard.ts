/**
 * Pengaman uji integrasi: uji API MENGOSONGKAN database yang dipakai, jadi hanya boleh jalan ke database
 * yang jelas khusus uji. Aturan:
 * 1. `TEST_DATABASE_URL` wajib diisi (tidak ada lagi fallback ke `DATABASE_URL`).
 * 2. Host-nya localhost, ATAU nama database-nya diawali `test_`.
 * 3. Tidak boleh menunjuk database yang sama dengan `DATABASE_URL` (host + nama database).
 * Pesan galat tidak pernah memuat kata sandi atau URL lengkap.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export class UnsafeTestDatabaseError extends Error {
  override name = 'UnsafeTestDatabaseError';
}

interface DbTarget {
  host: string;
  database: string;
}

function parse(url: string, label: string): DbTarget {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new UnsafeTestDatabaseError(`${label} tidak valid sebagai URL Postgres.`);
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) {
    throw new UnsafeTestDatabaseError(`${label} harus berawalan postgres:// atau postgresql://.`);
  }
  return {
    // Neon memakai host "-pooler" untuk koneksi pooled ke endpoint yang sama.
    host: u.hostname.toLowerCase().replace('-pooler.', '.'),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
  };
}

/** Lempar `UnsafeTestDatabaseError` bila database uji tidak aman untuk dikosongkan. */
export function assertSafeTestDatabase(testUrl: string | undefined, devUrl?: string): DbTarget {
  if (!testUrl || testUrl.trim() === '') {
    throw new UnsafeTestDatabaseError(
      'TEST_DATABASE_URL wajib diisi untuk uji integrasi. Uji ini mengosongkan database; ' +
        'arahkan ke Postgres lokal atau database bernama test_* (mis. test_silk di branch Neon khusus uji).',
    );
  }
  const target = parse(testUrl, 'TEST_DATABASE_URL');
  const local = LOCAL_HOSTS.has(target.host);
  if (!local && !target.database.startsWith('test_')) {
    throw new UnsafeTestDatabaseError(
      `Database uji "${target.database}" ditolak: nama database non-lokal harus diawali "test_". ` +
        'Buat database baru (mis. test_silk) lalu perbarui TEST_DATABASE_URL.',
    );
  }
  if (devUrl && devUrl.trim() !== '') {
    const dev = parse(devUrl, 'DATABASE_URL');
    if (dev.host === target.host && dev.database === target.database) {
      throw new UnsafeTestDatabaseError(
        'TEST_DATABASE_URL menunjuk database yang sama dengan DATABASE_URL. Pakai database uji terpisah.',
      );
    }
  }
  return target;
}
