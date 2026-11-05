import {
  BookOpen,
  ClipboardCheck,
  FlaskConical,
  ListChecks,
  Receipt,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { themeIndex } from '@/lib/article-meta';
import { cn } from '@/lib/cn';

/** Pasangan latar/tinta pastel (lolos AA) yang sama dengan ubin beranda. */
const THEMES = [
  { bg: 'bg-mint', ink: 'text-mint-ink', glow: 'from-white/70' },
  { bg: 'bg-sky', ink: 'text-sky-ink', glow: 'from-white/60' },
  { bg: 'bg-peach', ink: 'text-peach-ink', glow: 'from-white/60' },
  { bg: 'bg-lilac', ink: 'text-lilac-ink', glow: 'from-white/60' },
  { bg: 'bg-lemon', ink: 'text-lemon-ink', glow: 'from-white/70' },
] as const;

/** Ikon dari kata kunci slug; selain itu buku. */
const ICONS: [RegExp, LucideIcon][] = [
  [/check-up|mcu/, ClipboardCheck],
  [/checklist|pertanyaan/, ListChecks],
  [/verifikasi/, ShieldCheck],
  [/beda|banding/, Scale],
  [/paket|satuan|tarif|biaya/, Receipt],
  [/lab|tes|darah|gula/, FlaskConical],
];

export const articleTheme = (slug: string) => THEMES[themeIndex(slug, THEMES.length)]!;

/**
 * Sampul dekoratif otomatis (artikel belum punya gambar): warna pastel + ikon topik + pola titik.
 * Warna dan ikon ditentukan dari slug, jadi selalu sama untuk artikel yang sama.
 */
export function ArticleCover({
  slug,
  size = 'card',
  className,
}: {
  slug: string;
  size?: 'card' | 'feature' | 'hero';
  className?: string;
}) {
  const theme = articleTheme(slug);
  const Icon = ICONS.find(([re]) => re.test(slug))?.[1] ?? BookOpen;
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative isolate grid place-items-center overflow-hidden',
        theme.bg,
        theme.ink,
        className,
      )}
    >
      {/* Pola titik halus + cahaya + lingkaran besar sebagai "ilustrasi" abstrak. */}
      <span className="absolute inset-0 -z-10 bg-[radial-gradient(currentColor_1px,transparent_1.5px)] [background-size:18px_18px] opacity-[0.09]" />
      <span
        className={cn(
          'absolute -top-1/3 -left-1/4 -z-10 aspect-square w-3/4 rounded-full bg-radial to-transparent to-70%',
          theme.glow,
        )}
      />
      <span className="absolute -right-[12%] -bottom-[30%] -z-10 aspect-square w-1/2 rounded-full border-[18px] border-current opacity-[0.07]" />
      <span className="absolute top-[14%] right-[16%] -z-10 size-3 rounded-full bg-current opacity-20" />
      <span className="absolute bottom-[18%] left-[14%] -z-10 size-2 rounded-full bg-current opacity-25" />
      <span
        className={cn(
          'grid place-items-center bg-white/85 shadow-soft backdrop-blur transition-transform duration-500 ease-soft group-hover:scale-110 group-hover:-rotate-3',
          size === 'card' && 'size-14 rounded-2xl',
          size === 'feature' && 'size-20 rounded-[1.6rem]',
          size === 'hero' && 'size-16 rounded-[1.4rem] sm:size-20 sm:rounded-[1.6rem]',
        )}
      >
        <Icon className={size === 'card' ? 'size-6' : 'size-8 sm:size-9'} strokeWidth={1.75} />
      </span>
    </div>
  );
}
