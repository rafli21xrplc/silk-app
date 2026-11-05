'use client';

import { useRef } from 'react';
import { t } from '@/messages/id';

/**
 * Input OTP 6 kotak. Mendukung tempel kode utuh, Backspace ke kotak sebelumnya, dan isi otomatis
 * `one-time-code` (kotak pertama menerima seluruh kode lalu disebar).
 */
export function OtpInput({ value, onChange, length = 6, disabled }: { value: string; onChange: (v: string) => void; length?: number; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  function fill(from: number, raw: string) {
    const clean = raw.replace(/\D/g, '');
    if (!clean) return;
    const next = (value.slice(0, from) + clean).slice(0, length);
    onChange(next);
    refs.current[Math.min(next.length, length - 1)]?.focus();
  }

  return (
    <div role="group" aria-label={t.auth.otpLabel} className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={t.auth.otpDigit(i + 1)}
          maxLength={i === 0 ? length : 1}
          className="h-14 w-full min-w-0 rounded-xl text-center font-mono text-2xl"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(value.slice(0, i));
              return;
            }
            fill(i, raw.length > 1 ? raw.slice(d ? 1 : 0) : raw);
          }}
          onPaste={(e) => {
            e.preventDefault();
            fill(i, e.clipboardData.getData('text'));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i > 0) {
              onChange(value.slice(0, i - 1));
              refs.current[i - 1]?.focus();
            } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}
