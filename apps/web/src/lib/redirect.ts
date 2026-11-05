/** Hanya path internal yang boleh jadi tujuan setelah masuk (cegah open redirect). */
export function safeReturnPath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  try {
    // Tolak apa pun yang setelah dinormalisasi berpindah origin (mis. "/\t/evil.example").
    const base = 'http://silk.invalid';
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
