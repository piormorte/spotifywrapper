import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'plain' | 'destructive';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-text-1 text-bg hover:opacity-85',
  secondary: 'bg-fill-1 text-text-1 hover:bg-fill-2',
  plain: 'text-accent hover:underline px-0',
  destructive: 'bg-fill-1 text-critical hover:bg-fill-2',
};

const BASE =
  'pressable inline-flex items-center justify-center gap-1.5 rounded-control px-4 py-2 text-callout font-medium disabled:cursor-not-allowed disabled:opacity-40';

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

interface ExternalLinkButtonProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'target' | 'rel'
> {
  readonly href: string;
  readonly variant?: Variant;
}

/**
 * A link styled as a button that opens another site in a new tab. Navigation
 * only: no data from the app goes with it (no referrer, no opener).
 */
export function ExternalLinkButton({
  variant = 'secondary',
  className = '',
  children,
  ...rest
}: ExternalLinkButtonProps) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
      <span aria-hidden className="text-text-2">
        ↗
      </span>
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}
