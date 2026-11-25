import type { ReactNode } from 'react';

interface SectionProps {
  readonly title: string;
  /** Short line beside the title (desktop) or under it (phone). */
  readonly caption?: string | undefined;
  readonly children: ReactNode;
}

/** Page section: hairline rule, title, optional caption. No container. */
export function Section({ title, caption, children }: SectionProps) {
  return (
    <section className="hairline border-t pt-6">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-title-3 font-semibold">{title}</h2>
        {caption && <p className="text-footnote text-text-2">{caption}</p>}
      </div>
      {children}
    </section>
  );
}
