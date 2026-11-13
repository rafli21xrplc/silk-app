import {
  Activity,
  Ambulance,
  Apple,
  Bean,
  BedDouble,
  Bone,
  BriefcaseMedical,
  ClipboardCheck,
  Droplet,
  Droplets,
  Dumbbell,
  FlaskConical,
  Flower2,
  HeartPulse,
  Layers,
  MessagesSquare,
  Microscope,
  ScanLine,
  ShieldPlus,
  Smile,
  Stethoscope,
  Syringe,
  TestTube,
  TestTubes,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

/** Ikon dari kata kunci slug (urutan penting). Satu makna, satu ikon. */
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
  [/rawat-inap/, BedDouble],
  [/senam|latihan/, Dumbbell],
  [/gizi/, Apple],
  [/konseling/, MessagesSquare],
  [/gigi/, Smile],
  [/mobil-jenazah/, Ambulance],
  [/jenazah|persemayaman/, Flower2],
  [/dokter|konsultasi/, Stethoscope],
];
const CATEGORY_ICONS: [RegExp, LucideIcon][] = [
  [/lab/, Microscope],
  [/radiologi|penunjang/, ScanLine],
  [/mcu|check-up/, ClipboardCheck],
  [/konsultasi/, Stethoscope],
  [/rawat-inap/, BedDouble],
  [/gaya-hidup/, Dumbbell],
  [/duka/, Flower2],
];
export const serviceIcon = (slug: string): LucideIcon => SERVICE_ICONS.find(([re]) => re.test(slug))?.[1] ?? TestTube;
export const categoryIcon = (slug: string): LucideIcon => CATEGORY_ICONS.find(([re]) => re.test(slug))?.[1] ?? Layers;

/** Warna per kategori (latar + tinta lolos AA). */
const CATEGORY_TONE: Record<string, string> = {
  laboratorium: 'bg-mint text-mint-ink',
  konsultasi: 'bg-sky text-sky-ink',
  mcu: 'bg-peach text-peach-ink',
  'rawat-inap': 'bg-lilac text-lilac-ink',
  'radiologi-penunjang': 'bg-sky text-sky-ink',
  'gaya-hidup-sehat': 'bg-lemon text-lemon-ink',
  'rumah-duka': 'bg-surface text-ink-soft',
};
export const categoryTone = (slug: string) => CATEGORY_TONE[slug] ?? 'bg-surface text-ink-soft';

export function IconTile({ icon: Icon, tone, size = 'md' }: { icon: LucideIcon; tone: string; size?: 'sm' | 'md' }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-2xl', tone, size === 'sm' ? 'size-9' : 'size-11')} aria-hidden="true">
      <Icon className={size === 'sm' ? 'size-4' : 'size-5'} />
    </span>
  );
}
