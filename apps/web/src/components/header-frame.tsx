'use client';

import { useEffect, useRef } from 'react';

/** Header sticky: transparan di atas, berlatar putih + bayangan halus setelah halaman di-scroll. */
export function HeaderFrame({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      el.dataset.scrolled = String(window.scrollY > 8);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header
      ref={ref}
      data-scrolled="false"
      className="group/header sticky top-0 z-40 border-b border-transparent bg-canvas/70 backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300 ease-soft data-[scrolled=true]:border-line data-[scrolled=true]:bg-white/85 data-[scrolled=true]:shadow-soft"
    >
      {children}
    </header>
  );
}
