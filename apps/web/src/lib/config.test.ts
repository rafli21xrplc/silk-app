import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadConfig() {
  vi.resetModules();
  return import('./config');
}

describe('BROWSER_API_ORIGIN', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('jalur relatif lewat domain web bila NEXT_PUBLIC_API_PROXY=1', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_ORIGIN', 'https://api.contoh.id');
    vi.stubEnv('NEXT_PUBLIC_API_PROXY', '1');
    const c = await loadConfig();
    expect(c.BROWSER_API_ORIGIN).toBe('');
    expect(c.API_ORIGIN).toBe('https://api.contoh.id');
  });

  it.each([[''], ['0'], ['true']])('langsung ke API untuk NEXT_PUBLIC_API_PROXY=%j', async (value) => {
    vi.stubEnv('NEXT_PUBLIC_API_ORIGIN', 'https://api.contoh.id');
    vi.stubEnv('NEXT_PUBLIC_API_PROXY', value);
    const c = await loadConfig();
    expect(c.BROWSER_API_ORIGIN).toBe('https://api.contoh.id');
  });
});
