'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY } from '@/lib/config';

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }) => string };
  }
}

/** Widget Cloudflare Turnstile. Tanpa site key (dev) tidak dirender; API melewati verifikasi di dev. */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ref.current) return;
    const el = ref.current;
    const render = () => window.turnstile?.render(el, { sitekey: TURNSTILE_SITE_KEY, callback: onToken });
    if (window.turnstile) {
      render();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [onToken]);
  return TURNSTILE_SITE_KEY ? <div ref={ref} /> : null;
}

/**
 * Turnstile untuk endpoint Better Auth yang dilindungi captcha (daftar, masuk, reset sandi, kirim OTP).
 * Token sekali pakai: panggil `reset()` setelah setiap percobaan agar widget membuat token baru.
 */
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const onToken = useCallback((value: string) => setToken(value), []);
  const reset = useCallback(() => {
    setToken(null);
    setRound((r) => r + 1);
  }, []);
  return {
    widget: <Turnstile key={round} onToken={onToken} />,
    /** Siap dikirim: tanpa site key (dev) selalu siap. */
    ready: !TURNSTILE_SITE_KEY || token !== null,
    headers: token ? { 'x-captcha-response': token } : ({} as Record<string, string>),
    reset,
  };
}
