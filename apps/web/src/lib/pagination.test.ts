import { describe, expect, it } from 'vitest';
import { mergeCursors, pagePath, pageWindow } from './pagination';

describe('pagePath', () => {
  it('menambah limit dan kursor tanpa membuang filter', () => {
    expect(pagePath('/admin/claims?status=menunggu', 10, null)).toBe(
      '/admin/claims?status=menunggu&limit=10',
    );
    expect(pagePath('/admin/claims?status=menunggu', 20, 'abc')).toBe(
      '/admin/claims?status=menunggu&limit=20&cursor=abc',
    );
  });

  it('menangani path tanpa query atau dengan "?" kosong', () => {
    expect(pagePath('/admin/imports', 10, null)).toBe('/admin/imports?limit=10');
    expect(pagePath('/admin/facilities?', 10, 'x')).toBe('/admin/facilities?limit=10&cursor=x');
  });
});

describe('mergeCursors', () => {
  it('belum dimuat: tidak berubah', () => {
    expect(mergeCursors([null], 0, undefined)).toEqual([null]);
  });

  it('mencatat kursor halaman berikutnya', () => {
    expect(mergeCursors([null], 0, 'b')).toEqual([null, 'b']);
    expect(mergeCursors([null, 'b'], 1, 'c')).toEqual([null, 'b', 'c']);
  });

  it('mempertahankan halaman di depan saat kembali ke halaman sebelumnya', () => {
    expect(mergeCursors([null, 'b', 'c'], 0, 'b')).toEqual([null, 'b', 'c']);
  });

  it('halaman terakhir memotong halaman sesudahnya', () => {
    expect(mergeCursors([null, 'b', 'c'], 1, null)).toEqual([null, 'b']);
  });

  it('kursor bergeser: halaman sesudahnya dihitung ulang', () => {
    expect(mergeCursors([null, 'b', 'c'], 0, 'b2')).toEqual([null, 'b2']);
  });
});

describe('pageWindow', () => {
  it('semua halaman bila sedikit', () => {
    expect(pageWindow(0, 1)).toEqual([0]);
    expect(pageWindow(3, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('memberi celah bila banyak', () => {
    expect(pageWindow(0, 12)).toEqual([0, 1, 2, 3, 4, 'gap', 11]);
    expect(pageWindow(6, 12)).toEqual([0, 'gap', 5, 6, 7, 'gap', 11]);
    expect(pageWindow(11, 12)).toEqual([0, 'gap', 7, 8, 9, 10, 11]);
  });
});
