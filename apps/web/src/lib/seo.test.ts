import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteNoIndex } from './seo';

describe('siteNoIndex', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('menutup indeks hanya bila SILK_NOINDEX=1', () => {
    vi.stubEnv('SILK_NOINDEX', '1');
    expect(siteNoIndex()).toBe(true);
  });

  it.each([[''], ['0'], ['true']])('perilaku biasa untuk SILK_NOINDEX=%j', (value) => {
    vi.stubEnv('SILK_NOINDEX', value);
    expect(siteNoIndex()).toBe(false);
  });
});
