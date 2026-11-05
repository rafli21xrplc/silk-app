'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { loadGsap, prefersReducedMotion } from '@/lib/gsap';

/**
 * Munculkan elemen bertanda `data-reveal` di dalamnya saat di-scroll ke layar (berurutan, halus).
 * - Konten tetap ada di HTML server; tanpa JS semuanya langsung tampil.
 * - Elemen yang sudah terlihat tidak disembunyikan (tanpa kedip, tidak mengganggu LCP).
 * - Hanya opacity/transform: elemen tetap bisa difokus keyboard.
 */
export function Reveal({ children, className, y = 18 }: { children: React.ReactNode; className?: string; y?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    let cancelled = false;
    let cleanup = () => {};
    void loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return;
      const marked = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
      const targets = marked.length ? marked : [root];
      const fold = window.innerHeight * 0.92;
      const below = targets.filter((el) => el.getBoundingClientRect().top > fold);
      if (below.length === 0) return;
      const ctx = gsap.context(() => {
        gsap.set(below, { opacity: 0, y });
        ScrollTrigger.batch(below, {
          start: 'top 92%',
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.07, overwrite: true }),
        });
      }, root);
      // Fokus keyboard ke elemen yang belum muncul: tampilkan segera.
      const onFocus = (e: FocusEvent) => {
        const hit = below.find((el) => el.contains(e.target as Node));
        if (hit) gsap.to(hit, { opacity: 1, y: 0, duration: 0.2, overwrite: true });
      };
      root.addEventListener('focusin', onFocus);
      cleanup = () => {
        root.removeEventListener('focusin', onFocus);
        ctx.revert();
      };
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [y]);
  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}
