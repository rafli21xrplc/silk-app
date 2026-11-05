'use client';

import { useEffect, useRef } from 'react';
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
