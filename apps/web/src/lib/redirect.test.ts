import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './redirect';

describe('safeReturnPath', () => {
  it('mengizinkan path internal beserta query', () => {
    expect(safeReturnPath('/portal/faskes/abc?tab=1', '/portal')).toBe('/portal/faskes/abc?tab=1');
  });
  it.each([
    ['https://jahat.example/x'],
    ['//jahat.example'],
    ['/\\jahat.example'],
    ['/\t/jahat.example'],
    ['javascript:alert(1)'],
    [''],
    [null],
  ])('menolak %s', (value) => {
    expect(safeReturnPath(value, '/portal')).toBe('/portal');
  });
});
