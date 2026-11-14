import type { NextConfig } from 'next';

/**
 * SILK Mobile hanya memanggil API SILK dari server (route handler dan server component), jadi peramban
 * cukup terhubung ke origin sendiri. Gambar/video profil boleh dari https (R2) dan origin API saat dev.
 */
const apiOrigin = process.env.SILK_API_ORIGIN || 'http://127.0.0.1:4000';
const isProd = process.env.NODE_ENV === 'production';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${apiOrigin}`,
  `media-src 'self' blob: https: ${apiOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self'${isProd ? '' : ' ws:'}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  transpilePackages: ['@silk/shared'],
  poweredByHeader: false,
  reactStrictMode: true,
  // Akses dari ponsel di jaringan yang sama saat demo (mis. http://192.168.x.x:3002).
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.16.*.*'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
