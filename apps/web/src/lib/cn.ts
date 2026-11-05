import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Gabungkan kelas Tailwind; kelas terakhir menang bila bertabrakan. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
