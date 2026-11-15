import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAMPAIGN_ARTS } from '@silk/shared';
import { CAMPAIGN_PHOTOS, PHOTOS, photoSrc, type PhotoKey } from './photos';

const pub = (src: string) => join(process.cwd(), 'public', src);

describe('foto beranda web', () => {
  it('setiap foto punya berkas kotak dan lebar', () => {
    for (const key of Object.keys(PHOTOS) as PhotoKey[]) {
      expect(existsSync(pub(photoSrc(key, 'sq'))), key).toBe(true);
      expect(existsSync(pub(photoSrc(key, 'wide'))), key).toBe(true);
    }
  });

  it('setiap foto tercantum di CREDITS.md dengan sumbernya', () => {
    const credits = readFileSync(pub('/photos/CREDITS.md'), 'utf8');
    for (const [key, p] of Object.entries(PHOTOS)) {
      expect(credits, key).toContain(`| ${key} | ${p.photographer} | ${p.page} |`);
    }
  });

  it('setiap jenis ilustrasi campaign punya foto', () => {
    for (const art of CAMPAIGN_ARTS) expect(CAMPAIGN_PHOTOS[art]).toBeTruthy();
  });
});
