/** The app mark (same drawing as public/icons/icon.svg), sized by font-size. */
export function Mark({ className = '' }: { readonly className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 512 512" className={`size-[1.6em] shrink-0 ${className}`}>
      <rect width="512" height="512" rx="120" fill="#1c1c20" />
      <rect
        width="512"
        height="512"
        rx="120"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.14"
        strokeWidth="12"
      />
      <rect x="120" y="168" width="272" height="36" rx="18" fill="#f5f5f7" />
      <rect x="120" y="238" width="200" height="36" rx="18" fill="#f5f5f7" />
      <rect x="120" y="308" width="128" height="36" rx="18" fill="#47d7a0" />
    </svg>
  );
}

/** Wordmark: the mark plus the name set in the display face. */
export function Wordmark({
  className = '',
  showName = true,
}: {
  readonly className?: string;
  readonly showName?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 font-display text-title-3 font-semibold tracking-[-0.03em] ${className}`}
    >
      <Mark />
      {showName && <span>Liner</span>}
    </span>
  );
}
