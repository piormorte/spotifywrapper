import type { ReactNode } from 'react';

interface SectionProps {
  readonly title: string;
  /** Short line under the title. */
  readonly caption?: string | undefined;
  /** Optional trailing control, e.g. a "Ver todos" link. */
  readonly action?: ReactNode;
  /** Wrap the content in a card surface (default) or leave it on the page. */
  readonly surface?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

/** Page section: title row (title, caption, action) above a card surface. */
export function Section({
  title,
  caption,
  action,
  surface = true,
  className = '',
  children,
}: SectionProps) {
  return (
    <section className={`min-w-0 ${className}`}>
      <div className="mb-4 flex items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <h2 className="text-title-3 font-semibold">{title}</h2>
          {caption && <p className="mt-0.5 text-footnote text-text-2">{caption}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {surface ? <div className="card p-5 sm:p-6">{children}</div> : children}
    </section>
  );
}
