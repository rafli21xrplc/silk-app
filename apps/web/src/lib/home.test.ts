import { describe, expect, it } from 'vitest';
import { pickHomeServices } from './home';

const svc = (slug: string, category: string) => ({ slug, category: { slug: category } });
// Urutan API: gaya hidup lebih dulu (alfabet kategori), seperti data demo.
const API = [
  svc('kelas-senam', 'gaya-hidup-sehat'),
  svc('konsultasi-gizi', 'gaya-hidup-sehat'),
  svc('konsultasi-dokter-umum', 'konsultasi'),
  svc('asam-urat', 'laboratorium'),
  svc('darah-lengkap', 'laboratorium'),
  svc('mcu-dasar', 'mcu'),
  svc('rawat-inap-kelas-3', 'rawat-inap'),
  svc('mobil-jenazah', 'rumah-duka'),
];

describe('pickHomeServices (beranda urut USP)', () => {
  it('slug pilihan dulu menurut urutan daftar, lalu sisanya menurut urutan kategori', () => {
    const out = pickHomeServices(API, ['darah-lengkap', 'konsultasi-dokter-umum', 'tidak-ada'], 5).map((s) => s.slug);
    expect(out).toEqual(['darah-lengkap', 'konsultasi-dokter-umum', 'asam-urat', 'mcu-dasar', 'rawat-inap-kelas-3']);
  });

  it('gaya hidup tidak membuka beranda dan rumah duka tidak ditampilkan', () => {
    const out = pickHomeServices(API, [], 10).map((s) => s.slug);
    expect(out[0]).toBe('asam-urat');
    expect(out).not.toContain('mobil-jenazah');
    expect(out.slice(-2)).toEqual(['kelas-senam', 'konsultasi-gizi']);
  });

  it('dibatasi n', () => {
    expect(pickHomeServices(API, [], 2)).toHaveLength(2);
  });
});
