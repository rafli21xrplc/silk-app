import { describe, expect, it } from 'vitest';
import { mp4DurationSeconds, sniffVideo } from './media';

function box(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + body.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set([...type].map((c) => c.charCodeAt(0)), 4);
  out.set(body, 8);
  return out;
}

function mvhdV0(timescale: number, duration: number): Uint8Array {
  const body = new Uint8Array(100);
  const v = new DataView(body.buffer);
  v.setUint8(0, 0);
  v.setUint32(12, timescale);
  v.setUint32(16, duration);
  return box('mvhd', body);
}

function mvhdV1(timescale: number, duration: number): Uint8Array {
  const body = new Uint8Array(112);
  const v = new DataView(body.buffer);
  v.setUint8(0, 1);
  v.setUint32(20, timescale);
  v.setBigUint64(24, BigInt(duration));
  return box('mvhd', body);
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

const reader = (file: Uint8Array) => async (start: number, length: number) => file.subarray(start, start + length);
const ftyp = box('ftyp', new Uint8Array([105, 115, 111, 109, 0, 0, 2, 0]));

describe('video: magic bytes', () => {
  it('MP4 dan WebM dikenali, lainnya tidak', () => {
    expect(sniffVideo(ftyp)).toBe('video/mp4');
    expect(sniffVideo(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]))).toBe('video/webm');
    expect(sniffVideo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBeNull();
  });
});

describe('video: durasi MP4 dari mvhd', () => {
  it('moov di depan (faststart)', async () => {
    const file = concat(ftyp, box('moov', mvhdV0(1000, 95_500)), box('mdat', new Uint8Array(4096)));
    expect(await mp4DurationSeconds(reader(file), file.length)).toBeCloseTo(95.5);
  });
  it('moov di belakang mdat (mdat dilompati)', async () => {
    const file = concat(ftyp, box('mdat', new Uint8Array(50_000)), box('moov', mvhdV1(600, 600 * 130)));
    expect(await mp4DurationSeconds(reader(file), file.length)).toBe(130);
  });
  it('berkas tanpa moov atau rusak = null', async () => {
    const noMoov = concat(ftyp, box('mdat', new Uint8Array(100)));
    expect(await mp4DurationSeconds(reader(noMoov), noMoov.length)).toBeNull();
    const garbage = new Uint8Array(64);
    expect(await mp4DurationSeconds(reader(garbage), garbage.length)).toBeNull();
  });
});
