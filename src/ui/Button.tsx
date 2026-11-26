import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'plain' | 'destructive' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-text-1 text-bg hover:opacity-88 active:opacity-80',
  secondary: 'bg-fill-1 text-text-1 hover:bg-fill-2 active:opacity-80',
  ghost: 'text-text-2 hover:bg-fill-1 hover:text-text-1',
  plain: 'text-accent hover:underline px-0',
  destructive: 'bg-fill-1 text-critical hover:bg-fill-2',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-control px-4 py-2 text-callout font-medium whitespace-nowrap transition-[background-color,opacity,color] select-none disabled:cursor-not-allowed disabled:opacity-40';

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
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly variant?: Variant;
}

/** A link styled as a button, for navigation actions. */
export function LinkButton({ variant = 'secondary', className = '', ...rest }: LinkButtonProps) {
  return <a className={`${BASE} ${VARIANTS[variant]} ${className}`} {...rest} />;
}
