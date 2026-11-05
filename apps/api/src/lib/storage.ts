import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env, isProduction } from './env';

export interface PresignedUpload {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  objectKey: string;
  expiresInSec: number;
}

export interface ObjectInfo {
  sizeBytes: number;
  contentType: string | null;
}

/**
 * Penyimpanan objek privat. Unggahan selalu lewat signed URL langsung ke penyimpanan,
 * tidak melewati body fungsi (batas 4,5 MB; bagian 2, aturan 4).
 */
export interface Storage {
  presignPut(key: string, contentType: string, sizeBytes: number): Promise<PresignedUpload>;
  presignGet(key: string, expiresInSec: number): Promise<string>;
  head(key: string): Promise<ObjectInfo | null>;
  /** Byte awal objek (untuk cek magic bytes). */
  readStart(key: string, bytes: number): Promise<Buffer>;
  readAll(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const UPLOAD_TTL_SEC = 600;

class R2Storage implements Storage {
  private client: S3Client;
  constructor(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    private bucket: string,
  ) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async presignPut(key: string, contentType: string, sizeBytes: number): Promise<PresignedUpload> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    });
    const uploadUrl = await getSignedUrl(this.client, cmd, {
      expiresIn: UPLOAD_TTL_SEC,
      // Tipe dan ukuran ikut ditandatangani: klien tidak bisa mengganti berkas lain.
      signableHeaders: new Set(['content-type', 'content-length']),
    });
    return { uploadUrl, method: 'PUT', headers: { 'Content-Type': contentType }, objectKey: key, expiresInSec: UPLOAD_TTL_SEC };
  }

  presignGet(key: string, expiresInSec: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSec });
  }

  async head(key: string): Promise<ObjectInfo | null> {
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { sizeBytes: r.ContentLength ?? 0, contentType: r.ContentType ?? null };
    } catch (err) {
      if (err instanceof Error && (err.name === 'NotFound' || err.name === 'NoSuchKey')) return null;
      throw err;
    }
  }

  async readStart(key: string, bytes: number): Promise<Buffer> {
    const r = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }),
    );
    return Buffer.from(await r.Body!.transformToByteArray());
  }

  async readAll(key: string): Promise<Buffer> {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/**
 * Penyimpanan lokal untuk dev/test bila R2 belum dikonfigurasi. Menulis ke direktori temp
 * (satu-satunya lokasi tulis di Vercel) dan meniru signed URL dengan HMAC. Tidak aktif di produksi.
 */
export class LocalStorage implements Storage {
  readonly root = path.join(os.tmpdir(), 'silk-uploads');

  private sign(payload: string): string {
    return createHmac('sha256', env().BETTER_AUTH_SECRET).update(payload).digest('base64url');
  }

  private filePath(key: string): string {
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root + path.sep)) throw new Error('Kunci objek tidak valid');
    return resolved;
  }

  async presignPut(key: string, contentType: string, sizeBytes: number): Promise<PresignedUpload> {
    const exp = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SEC;
    const sig = this.sign(`PUT\n${key}\n${contentType}\n${sizeBytes}\n${exp}`);
    const qs = new URLSearchParams({ key, ct: contentType, size: String(sizeBytes), exp: String(exp), sig });
    return {
      uploadUrl: `${env().API_ORIGIN}/v1/dev/storage/upload?${qs}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      objectKey: key,
      expiresInSec: UPLOAD_TTL_SEC,
    };
  }

  /** Dipakai rute dev untuk memeriksa tanda tangan unggahan. */
  verifyUpload(q: { key: string; ct: string; size: string; exp: string; sig: string }): boolean {
    if (Number(q.exp) < Date.now() / 1000) return false;
    const expected = Buffer.from(this.sign(`PUT\n${q.key}\n${q.ct}\n${q.size}\n${q.exp}`));
    const given = Buffer.from(q.sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async presignGet(key: string, expiresInSec: number): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + expiresInSec;
    const sig = this.sign(`GET\n${key}\n${exp}`);
    return `${env().API_ORIGIN}/v1/dev/storage/file?${new URLSearchParams({ key, exp: String(exp), sig })}`;
  }

  verifyGet(q: { key: string; exp: string; sig: string }): boolean {
    if (Number(q.exp) < Date.now() / 1000) return false;
    const expected = Buffer.from(this.sign(`GET\n${q.key}\n${q.exp}`));
    const given = Buffer.from(q.sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const file = this.filePath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    await writeFile(`${file}.meta`, JSON.stringify({ contentType }));
  }

  async head(key: string): Promise<ObjectInfo | null> {
    try {
      const file = this.filePath(key);
      const s = await stat(file);
      const meta = JSON.parse(await readFile(`${file}.meta`, 'utf8')) as { contentType?: string };
      return { sizeBytes: s.size, contentType: meta.contentType ?? null };
    } catch {
      return null;
    }
  }

  async readStart(key: string, bytes: number): Promise<Buffer> {
    return (await readFile(this.filePath(key))).subarray(0, bytes);
  }

  readAll(key: string): Promise<Buffer> {
    return readFile(this.filePath(key));
  }

  async delete(key: string): Promise<void> {
    const file = this.filePath(key);
    await rm(file, { force: true });
    await rm(`${file}.meta`, { force: true });
  }
}

let instance: Storage | undefined;

export function storage(): Storage {
  if (instance) return instance;
  const e = env();
  if (e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET) {
    instance = new R2Storage(e.R2_ACCOUNT_ID, e.R2_ACCESS_KEY_ID, e.R2_SECRET_ACCESS_KEY, e.R2_BUCKET);
  } else if (isProduction()) {
    throw new Error('R2 belum dikonfigurasi; penyimpanan lokal tidak boleh dipakai di produksi');
  } else {
    instance = new LocalStorage();
  }
  return instance;
}

/** Cek magic bytes: tipe berkas sesungguhnya harus cocok dengan MIME yang dinyatakan. */
export function sniffMime(head: Buffer): string | null {
  if (head.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}
