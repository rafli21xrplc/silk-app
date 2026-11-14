import { activeCampaigns, CAMPAIGNS, checkContent } from '@silk/shared';
import { describe, expect, it } from 'vitest';
import { CONTENT_RULES, SERVICES } from './data';

/** Campaign beranda adalah teks publik: wajib lolos filter M17 dan menautkan ke halaman yang ada. */
const rules = CONTENT_RULES.map((r, i) => ({ ...r, id: i + 1 }));

describe('campaign beranda', () => {
  it.each(CAMPAIGNS.map((c) => [c.id, c] as const))('%s lolos filter konten M17 tanpa tinjauan', (_id, c) => {
    const r = checkContent({ eyebrow: c.eyebrow, title: c.title, body: c.body, cta: c.cta }, rules);
    expect(r.violations).toEqual([]);
  });

  it('ID unik, tautan internal, dan layanan yang ditautkan ada di katalog', () => {
    expect(new Set(CAMPAIGNS.map((c) => c.id)).size).toBe(CAMPAIGNS.length);
    const slugs = new Set(SERVICES.map((s) => s.slug));
    for (const c of CAMPAIGNS) {
      for (const href of [c.href.web, c.href.mobile]) {
        expect(href).toMatch(/^\/(?!\/)/);
        const m = href.match(/^\/layanan\/([a-z0-9-]+)/);
        if (m) expect(slugs.has(m[1]!), `${c.id}: ${href}`).toBe(true);
      }
    }
  });

  it('jadwal tayang: campaign bertanggal hanya tayang di rentangnya', () => {
    const ids = (iso: string) => activeCampaigns(new Date(iso)).map((c) => c.id);
    expect(ids('2026-11-14T03:00:00Z')).toContain('hari-diabetes-2026');
    expect(ids('2026-12-15T03:00:00Z')).not.toContain('hari-diabetes-2026');
    expect(ids('2026-12-15T03:00:00Z')).toContain('mcu-sebelum-datang');
  });
});
