/** Provisional wordmark: the name set in the display face, nothing else. */
export function Wordmark({ className = '' }: { readonly className?: string }) {
  return (
    <span className={`font-display text-title-3 font-semibold tracking-[-0.03em] ${className}`}>
      Liner
    </span>
  );
}
