/** Loading placeholder block. Purely visual; pair it with an aria-live status. */
export function Skeleton({ className = '' }: { readonly className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/** A loading layout shaped like a typical screen: title, a row of tiles, a panel. */
export function ScreenSkeleton({ label = 'Carregando…' }: { readonly label?: string }) {
  return (
    <div className="fade mt-8" aria-busy>
      <p aria-live="polite" className="sr-only">
        {label}
      </p>
      <Skeleton className="h-44 rounded-panel sm:h-56" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-card sm:h-32" />
        ))}
      </div>
      <Skeleton className="mt-4 h-64 rounded-card" />
    </div>
  );
}
