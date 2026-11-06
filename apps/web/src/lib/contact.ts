/** Tautan `tel:` dari nomor yang ditulis bebas ("0341-555 123" → "tel:0341555123"). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/**
 * Tautan WhatsApp hanya untuk nomor HP Indonesia (08…, +628…, 628…). Telepon rumah atau kantor (mis. 0341-…)
 * tidak bisa menerima WhatsApp, jadi `null`.
 */
export function whatsappUrl(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  const intl = digits.startsWith('08') ? `62${digits.slice(1)}` : digits.startsWith('628') ? digits : null;
  if (!intl || intl.length < 10 || intl.length > 15) return null;
  return `https://wa.me/${intl}`;
}
