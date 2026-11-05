/**
 * Pemeriksaan berkas video tanpa ffprobe (tidak tersedia di Vercel). Dipakai API saat konfirmasi
 * unggahan (Fase 2, K8). Bekerja dengan pembaca rentang byte agar tidak memuat seluruh video.
 */

const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len));

/** Tipe video sesungguhnya dari byte awal: MP4 (kotak `ftyp`) atau WebM (header EBML). */
export function sniffVideo(head: Uint8Array): 'video/mp4' | 'video/webm' | null {
  if (head.length >= 8 && ascii(head, 4, 4) === 'ftyp') return 'video/mp4';
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'video/webm';
  return null;
}

export type RangeReader = (start: number, length: number) => Promise<Uint8Array>;

/** Batas ukuran kotak `moov` yang mau dibaca (metadata; video 2 menit jauh di bawah ini). */
const MOOV_MAX_BYTES = 8 * 1024 * 1024;

function boxHeader(b: Uint8Array, offset = 0): { size: number; type: string; headerLen: number } | null {
  if (b.length < offset + 8) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let size = view.getUint32(offset);
  const type = ascii(b, offset + 4, 4);
  let headerLen = 8;
  if (size === 1) {
    if (b.length < offset + 16) return null;
    size = Number(view.getBigUint64(offset + 8));
    headerLen = 16;
  }
  return { size, type, headerLen };
}

/** Durasi dari kotak `mvhd` di dalam isi `moov`. */
function durationFromMoov(moov: Uint8Array): number | null {
  let offset = 0;
  while (offset + 8 <= moov.length) {
    const h = boxHeader(moov, offset);
    if (!h || h.size < 8) return null;
    if (h.type === 'mvhd') {
      const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
      const body = offset + h.headerLen;
      const version = moov[body];
      if (version === 1) {
        const timescale = view.getUint32(body + 4 + 16);
        const duration = Number(view.getBigUint64(body + 4 + 20));
        return timescale > 0 ? duration / timescale : null;
      }
      const timescale = view.getUint32(body + 4 + 8);
      const duration = view.getUint32(body + 4 + 12);
      return timescale > 0 ? duration / timescale : null;
    }
    offset += h.size;
  }
  return null;
}

/**
 * Durasi video MP4 dalam detik, atau `null` bila tidak terbaca (berkas rusak, `moov` terlalu besar).
 * Menyusuri kotak level atas (kotak `mdat` yang besar dilompati), lalu membaca `moov` saja.
 */
export async function mp4DurationSeconds(read: RangeReader, totalSize: number): Promise<number | null> {
  let offset = 0;
  for (let guard = 0; guard < 64 && offset + 8 <= totalSize; guard++) {
    const head = await read(offset, Math.min(16, totalSize - offset));
    const h = boxHeader(head);
    if (!h) return null;
    const size = h.size === 0 ? totalSize - offset : h.size;
    if (size < h.headerLen) return null;
    if (h.type === 'moov') {
      const bodyLen = size - h.headerLen;
      if (bodyLen > MOOV_MAX_BYTES) return null;
      return durationFromMoov(await read(offset + h.headerLen, bodyLen));
    }
    offset += size;
  }
  return null;
}
