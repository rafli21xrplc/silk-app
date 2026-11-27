export const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';
/**
 * `NEXT_PUBLIC_API_PROXY=1`: browser memanggil `/v1/*` di domain web, lalu web meneruskannya ke API (rewrites di
 * next.config.ts). Dipakai bila web dan API beda situs (mis. dua subdomain vercel.app): cookie sesi SameSite=Lax
 * hanya terkirim bila browser dan API satu situs. Server tetap memanggil API_ORIGIN langsung.
 */
export const API_PROXY = process.env.NEXT_PUBLIC_API_PROXY === '1';
export const BROWSER_API_ORIGIN = API_PROXY ? '' : API_ORIGIN;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? '';
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
