/** Tautan `tel:` dari nomor yang ditulis bebas ("0341-555 123" → "tel:0341555123"). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** WhatsApp hanya untuk nomor HP Indonesia (08…, +628…, 628…); telepon kantor (0341-…) → null. */
export function whatsappUrl(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  const intl = digits.startsWith('08') ? `62${digits.slice(1)}` : digits.startsWith('628') ? digits : null;
  if (!intl || intl.length < 10 || intl.length > 15) return null;
  return `https://wa.me/${intl}`;
}

/** Rute di Google Maps dari titik lokasi. */
export const directionsUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/** Situs web eksternal hanya bila http(s); selain itu tidak ditautkan. */
export function safeWebsite(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}
