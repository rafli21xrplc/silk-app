import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAMPAIGNS } from '@silk/shared';
import { campaignSlides } from './campaigns';

describe('campaign beranda SILK Mobile', () => {
  it('memakai tujuan mobile dan menyaring rentang tayang', () => {
    const during = campaignSlides(new Date('2026-11-14T03:00:00Z'));
    const after = campaignSlides(new Date('2026-12-15T03:00:00Z'));
    expect(during.map((s) => s.id)).toContain('hari-diabetes-2026');
    expect(after.map((s) => s.id)).not.toContain('hari-diabetes-2026');
    const guide = during.find((s) => s.id === 'cara-baca-angka');
    expect(guide?.href).toBe(CAMPAIGNS.find((c) => c.id === 'cara-baca-angka')?.href.mobile);
  });

  it('setiap foto ilustrasi ada di public/', () => {
    for (const s of campaignSlides(new Date('2026-11-14T03:00:00Z'))) {
      if (s.image) expect(existsSync(join(process.cwd(), 'public', s.image)), s.image).toBe(true);
    }
  });

  it('tujuan mobile adalah rute yang ada di aplikasi', () => {
    const routes = ['/layanan', '/dokter', '/info', '/mitra', '/cari', '/artikel'];
    for (const c of CAMPAIGNS) expect(routes.some((r) => c.href.mobile === r || c.href.mobile.startsWith(`${r}/`) || c.href.mobile.startsWith(`${r}?`)), c.href.mobile).toBe(true);
  });
});
