import { cva, type VariantProps } from 'class-variance-authority';

/** Varian tombol; dipakai untuk <button> maupun <Link>. */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold no-underline transition-[background-color,border-color,box-shadow,transform,color] duration-200 ease-soft select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-55 hover:no-underline',
  {
    variants: {
      variant: {
        primary:
          'border border-primary-600 bg-primary-600 text-white shadow-[0_8px_20px_-8px_rgb(14_124_116/0.6)] hover:border-primary-700 hover:bg-primary-700 hover:text-white',
        secondary: 'border border-line-strong bg-white text-ink shadow-[0_1px_1px_rgb(28_40_38/0.04)] hover:border-primary-300 hover:bg-primary-50 hover:text-ink',
        soft: 'border border-transparent bg-primary-100 text-primary-800 hover:bg-primary-200 hover:text-primary-900',
        ghost: 'border border-transparent bg-transparent text-ink-soft hover:bg-surface-2 hover:text-ink',
      },
      size: {
        sm: 'min-h-9 px-3.5 text-sm',
        md: 'min-h-11 px-5 text-[0.95rem]',
        lg: 'min-h-[52px] px-6 text-base',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
