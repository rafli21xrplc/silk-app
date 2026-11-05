import {
  Activity,
  Bean,
  Bone,
  BriefcaseMedical,
  ClipboardCheck,
  Droplet,
  Droplets,
  FlaskConical,
  HeartPulse,
  Layers,
  Microscope,
  ScanLine,
  ShieldPlus,
  Stethoscope,
  Syringe,
  TestTube,
  TestTubes,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { themeIndex } from '@/lib/article-meta';
import { cn } from '@/lib/cn';

/** Pasangan warna pastel per kategori (latar/tinta lolos AA), plus kelas gradien. */
export interface Tone {
  tile: string;
  bg: string;
  from: string;
}

const TONES = {
  mint: { tile: 'bg-mint text-mint-ink', bg: 'bg-mint', from: 'from-mint' },
  sky: { tile: 'bg-sky text-sky-ink', bg: 'bg-sky', from: 'from-sky' },
  peach: { tile: 'bg-peach text-peach-ink', bg: 'bg-peach', from: 'from-peach' },
  lilac: { tile: 'bg-lilac text-lilac-ink', bg: 'bg-lilac', from: 'from-lilac' },
  lemon: { tile: 'bg-lemon text-lemon-ink', bg: 'bg-lemon', from: 'from-lemon' },
} satisfies Record<string, Tone>;

const CATEGORY_TONE: Record<string, Tone> = {
  laboratorium: TONES.mint,
  'radiologi-penunjang': TONES.sky,
  mcu: TONES.peach,
};
const FALLBACK_TONES = [TONES.lilac, TONES.lemon, TONES.mint, TONES.sky, TONES.peach];

/** Warna kategori; kategori baru mendapat warna tetap dari slug-nya. */
export const categoryTone = (slug: string): Tone =>
  CATEGORY_TONE[slug] ?? FALLBACK_TONES[themeIndex(slug, FALLBACK_TONES.length)]!;

const CATEGORY_ICONS: [RegExp, LucideIcon][] = [
  [/lab/, Microscope],
  [/radiologi|penunjang/, ScanLine],
  [/mcu|check-up/, ClipboardCheck],
];
export const categoryIcon = (slug: string): LucideIcon =>
  CATEGORY_ICONS.find(([re]) => re.test(slug))?.[1] ?? Layers;

/** Ikon pemeriksaan dari kata kunci slug (urutan penting); selain itu tabung uji. */
const SERVICE_ICONS: [RegExp, LucideIcon][] = [
  [/pra-kerja/, BriefcaseMedical],
  [/check-up|mcu/, ClipboardCheck],
  [/gula|glukosa|hba1c/, Droplet],
  [/hemoglobin/, Droplets],
  [/darah|hematologi/, TestTubes],
  [/kolesterol|lipid|trigliserida/, Activity],
  [/urin/, FlaskConical],
  [/asam-urat/, Bone],
  [/ginjal/, Bean],
  [/hati|sgot|sgpt/, Syringe],
  [/hbsag|hepatitis/, ShieldPlus],
  [/ekg|jantung/, HeartPulse],
  [/rontgen|thorax|x-ray/, ScanLine],
  [/usg|ultrasonografi/, Waves],
  [/dokter|konsultasi/, Stethoscope],
];
export const serviceIcon = (slug: string): LucideIcon =>
  SERVICE_ICONS.find(([re]) => re.test(slug))?.[1] ?? TestTube;

/** Ubin ikon berwarna. Dekoratif: nama layanan selalu ada sebagai teks di sebelahnya. */
export function IconTile({
  icon: Icon,
  tone,
  size = 'md',
  className,
}: {
  icon: LucideIcon;
  tone: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center',
        tone.tile,
        size === 'sm' && 'size-9 rounded-xl',
        size === 'md' && 'size-12 rounded-2xl',
        size === 'lg' && 'size-16 rounded-[1.4rem] sm:size-20 sm:rounded-[1.6rem]',
        className,
      )}
    >
      <Icon
        className={cn(size === 'sm' && 'size-[18px]', size === 'md' && 'size-[22px]', size === 'lg' && 'size-8 sm:size-9')}
        strokeWidth={1.75}
      />
    </span>
  );
}
