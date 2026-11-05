'use client';

import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { loadGsap, prefersReducedMotion } from '@/lib/gsap';
import { t } from '@/messages/id';

/** Menu ponsel: panel turun dengan animasi halus; Esc atau pindah halaman menutupnya. */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const first = useRef(true);
  const id = useId();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      return;
    }
    // Tampil/sembunyi langsung; animasi hanya hiasan bila GSAP sudah siap.
    if (open) el.style.display = 'block';
    if (prefersReducedMotion()) {
      if (!open) el.style.display = 'none';
      return;
    }
    let cancelled = false;
    void loadGsap().then(({ gsap }) => {
      if (cancelled) return;
      if (open) {
        gsap.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.45, ease: 'power3.out', overwrite: true });
        gsap.fromTo(el.querySelectorAll('a'), { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out', stagger: 0.04, delay: 0.08 });
      } else {
        gsap.to(el, {
          height: 0,
          opacity: 0,
          duration: 0.28,
          ease: 'power2.in',
          overwrite: true,
          onComplete: () => {
            el.style.display = 'none';
            gsap.set(el, { clearProps: 'height,opacity' });
          },
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={button}
        type="button"
        className="grid size-11 place-items-center rounded-full border border-line bg-white text-ink shadow-soft transition-colors hover:bg-surface-2"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
        onPointerEnter={() => void loadGsap()}
        onFocus={() => void loadGsap()}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>
      <div ref={panel} id={id} className="absolute inset-x-0 top-full hidden overflow-hidden border-b border-line bg-white/95 shadow-lift backdrop-blur-md">
        <nav aria-label={t.nav.main} className="container flex flex-col gap-1 py-4" onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}>
          {children}
        </nav>
      </div>
    </div>
  );
}
