import { describe, expect, it } from 'vitest';
import { telHref, whatsappUrl } from './contact';

describe('kontak dokter (Fase 4b)', () => {
  it('tautan telepon membuang pemisah', () => {
    expect(telHref('0341-555 123')).toBe('tel:0341555123');
    expect(telHref('+62 812-3456-7890')).toBe('tel:+6281234567890');
  });

  it('WhatsApp hanya untuk nomor HP Indonesia', () => {
    expect(whatsappUrl('0812-3456-7890')).toBe('https://wa.me/6281234567890');
    expect(whatsappUrl('+62 812 3456 7890')).toBe('https://wa.me/6281234567890');
    expect(whatsappUrl('6281234567890')).toBe('https://wa.me/6281234567890');
    expect(whatsappUrl('0341-555123')).toBeNull();
    expect(whatsappUrl('0812')).toBeNull();
    expect(whatsappUrl(null)).toBeNull();
  });
});
