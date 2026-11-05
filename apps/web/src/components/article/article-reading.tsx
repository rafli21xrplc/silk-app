'use client';

import { Check, Link2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import type { TocItem } from '@/lib/article-meta';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

/** Garis kemajuan baca di atas layar, mengikuti posisi gulir di dalam elemen `#{targetId}`. Dekoratif. */
export function ReadingProgress({ targetId }: { targetId: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || !bar.current) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = target.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.6;
      const done = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
      bar.current?.style.setProperty('transform', `scaleX(${done})`);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [targetId]);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div
        ref={bar}
        className="h-full origin-left scale-x-0 rounded-r-full bg-gradient-to-r from-primary-500 to-primary-700"
      />
    </div>
  );
}

/** Daftar isi dengan penanda bagian yang sedang dibaca. */
export function ArticleToc({ items, className }: { items: TocItem[]; className?: string }) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;
    // Bagian aktif = subjudul terakhir yang sudah melewati sepertiga atas layar.
    const observer = new IntersectionObserver(
      () => {
        const line = window.innerHeight * 0.33;
        const passed = headings.filter((h) => h.getBoundingClientRect().top <= line);
        setActive((passed.at(-1) ?? headings[0])!.id);
      },
      { rootMargin: '0px 0px -60% 0px', threshold: [0, 1] },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  return (
    <ol className={cn('m-0 grid list-none gap-0.5 border-l-2 border-line p-0', className)}>
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            aria-current={active === item.id ? 'location' : undefined}
            className="-ml-0.5 block border-l-2 border-transparent py-1.5 pr-2 pl-4 text-[0.92rem] leading-snug text-muted no-underline transition-colors duration-200 hover:text-ink hover:no-underline aria-[current=location]:border-primary-600 aria-[current=location]:font-semibold aria-[current=location]:text-primary-800"
          >
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Salin tautan artikel ke papan klip. */
export function CopyLinkButton({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <button
      type="button"
      className={buttonVariants({ variant: 'secondary', size: 'sm', className })}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(window.location.href.split('#')[0]!)
          .then(() => setCopied(true));
      }}
    >
      {copied ? (
        <Check className="size-4 text-ok" aria-hidden="true" />
      ) : (
        <Link2 className="size-4" aria-hidden="true" />
      )}
      <span aria-live="polite">{copied ? t.articles.copied : t.articles.copyLink}</span>
    </button>
  );
}
