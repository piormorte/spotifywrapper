export interface RankItem {
  readonly key: string;
  readonly title: string;
  readonly subtitle?: string;
  /** Pre-formatted primary metric. */
  readonly metric: string;
  /** Pre-formatted secondary metric. */
  readonly secondary?: string;
}

interface RankListProps {
  readonly label: string;
  readonly items: readonly RankItem[];
}

/** Ranked rows separated by hairlines; the rank is set in the tertiary color. */
export function RankList({ label, items }: RankListProps) {
  return (
    <ol aria-label={label} className="divide-y divide-separator">
      {items.map((item, index) => (
        <li key={item.key} className="flex items-baseline gap-4 py-3">
          <span className="numeric w-5 shrink-0 text-right text-footnote text-text-3">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-callout font-medium">{item.title}</span>
            {item.subtitle && (
              <span className="block truncate text-footnote text-text-2">{item.subtitle}</span>
            )}
          </span>
          <span className="shrink-0 text-right">
            <span className="numeric block text-callout">{item.metric}</span>
            {item.secondary && (
              <span className="numeric block text-footnote text-text-3">{item.secondary}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
