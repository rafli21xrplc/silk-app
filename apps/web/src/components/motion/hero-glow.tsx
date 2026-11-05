'use client';

import { useEffect, useRef } from 'react';
import { loadGsap, prefersReducedMotion } from '@/lib/gsap';

/** Cahaya latar hero yang bergerak sangat pelan. Dekoratif saja; diam bila gerak dikurangi. */
export function HeroGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    let cancelled = false;
    let revert = () => {};
    // Mulai setelah browser senggang agar tidak bersaing dengan render awal.
    const start = () =>
      void loadGsap().then(({ gsap }) => {
        if (cancelled) return;
        const ctx = gsap.context(() => {
          gsap.to('[data-glow="a"]', { xPercent: 12, yPercent: 8, duration: 14, ease: 'sine.inOut', repeat: -1, yoyo: true });
          gsap.to('[data-glow="b"]', { xPercent: -10, yPercent: 12, duration: 17, ease: 'sine.inOut', repeat: -1, yoyo: true });
        }, root);
        revert = () => ctx.revert();
      });
    // Safari lama belum punya requestIdleCallback.
    const ric = window.requestIdleCallback as typeof window.requestIdleCallback | undefined;
    const id = ric ? ric(start, { timeout: 2000 }) : window.setTimeout(start, 600);
    return () => {
      cancelled = true;
      if (ric) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
      revert();
    };
  }, []);
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div data-glow="a" className="absolute -top-24 -left-20 size-[28rem] rounded-full bg-primary-200/50 blur-3xl" />
      <div data-glow="b" className="absolute -top-10 right-[-6rem] size-[24rem] rounded-full bg-sand-200/60 blur-3xl" />
    </div>
  );
}
