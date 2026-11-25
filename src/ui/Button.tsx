import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'plain' | 'destructive';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-text-1 text-bg hover:opacity-85',
  secondary: 'bg-fill-1 text-text-1 hover:bg-fill-2',
  plain: 'text-accent hover:underline px-0',
  destructive: 'bg-fill-1 text-critical hover:bg-fill-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
}

/**
 * Text button. Primary is monochrome (the accent is reserved for data);
 * destructive uses the system red, never the accent.
 */
export function Button({ variant = 'secondary', className = '', type, ...rest }: ButtonProps) {
  return (
    <button
      type={type === 'submit' ? 'submit' : 'button'}
      className={`inline-flex items-center justify-center rounded-control px-4 py-2 text-callout font-medium transition-[background-color,opacity] disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
