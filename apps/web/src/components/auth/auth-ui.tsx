'use client';

import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock, type LucideIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

/** Judul halaman akun: penanda langkah (opsional), judul, dan subjudul. */
export function AuthHeading({ title, subtitle, step }: { title: string; subtitle?: string; step?: string }) {
  return (
    <header className="mb-7">
      {step && <p className="mb-2 text-sm font-semibold text-primary-700">{step}</p>}
      <h1 className="m-0 text-[1.75rem] sm:text-[2rem]">{title}</h1>
      {subtitle && <p className="mt-2 mb-0 text-muted">{subtitle}</p>}
    </header>
  );
}

/** Pesan sukses atau galat di atas form. */
export function AuthAlert({ tone, children }: { tone: 'ok' | 'error'; children: React.ReactNode }) {
  const Icon = tone === 'ok' ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-[0.95rem]',
        tone === 'ok' ? 'border-primary-200 bg-primary-50 text-ink-soft' : 'border-danger/25 bg-danger-soft text-danger',
      )}
    >
      <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'>;

interface AuthInputProps extends InputProps {
  label: string;
  icon: LucideIcon;
  hint?: string;
  /** Elemen di kanan label, mis. tautan "Lupa kata sandi?". */
  aside?: React.ReactNode;
  inputClassName?: string;
}

/** Kolom isian dengan ikon di kiri. Label dipisah dari input agar nama aksesibelnya bersih. */
export function AuthInput({ label, icon: Icon, hint, aside, inputClassName, ...props }: AuthInputProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.925rem] font-semibold text-ink-soft">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted" aria-hidden="true" />
        <input id={id} aria-describedby={hintId} {...props} className={cn('min-h-12 pl-11', inputClassName)} />
      </div>
      {hint && (
        <p id={hintId} className="m-0 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Kolom kata sandi dengan tombol tampilkan/sembunyikan. */
export function PasswordInput({ label, hint, aside, ...props }: Omit<AuthInputProps, 'icon' | 'type' | 'inputClassName'>) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.925rem] font-semibold text-ink-soft">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted" aria-hidden="true" />
        <input id={id} aria-describedby={hintId} {...props} type={visible ? 'text' : 'password'} className="min-h-12 pr-12 pl-11" />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          title={visible ? t.auth.hidePassword : t.auth.showPassword}
          className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {visible ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
          <span className="sr-only">{visible ? t.auth.hidePassword : t.auth.showPassword}</span>
        </button>
      </div>
      {hint && (
        <p id={hintId} className="m-0 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Tombol utama selebar form, dengan indikator memuat. */
export function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={busy} aria-busy={busy} className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'mt-1 w-full')}>
      {busy && <Loader2 className="size-[18px] animate-spin" aria-hidden="true" />}
      {busy ? t.common.loading : children}
    </button>
  );
}

/** Baris tautan di bawah form, dipisah garis tipis. */
export function AuthFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 border-t border-line pt-6 text-center text-[0.95rem] text-muted">{children}</div>;
}

export function BackToLogin() {
  return (
    <Link href="/masuk" className="inline-flex items-center gap-1.5 font-semibold no-underline hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t.auth.backToLogin}
    </Link>
  );
}
