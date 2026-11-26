import { Cover } from './Cover.tsx';

export interface RankItem {
  readonly key: string;
  readonly title: string;
  readonly subtitle?: string;
  /** Pre-formatted primary metric. */
  readonly metric: string;
  /** Pre-formatted secondary metric. */
  readonly secondary?: string;
  /** Name the generated artwork is drawn from (album, or artist). */
  readonly cover?: string;
}

interface RankListProps {
  readonly label: string;
  readonly items: readonly RankItem[];
  /** Artwork shape; omit to show no artwork. */
  readonly art?: 'square' | 'circle';
  /** Rank offset when a list continues another (second column). */
  readonly start?: number;
}

/** Ranked rows, library style: rank, artwork, title and subtitle, metric. */
export function RankList({ label, items, art, start = 0 }: RankListProps) {
  return (
    <ol aria-label={label} start={start + 1} className="-mx-2">
      {items.map((item, index) => (
        <li
          key={item.key}
          className="enter flex items-center gap-3 rounded-tile px-2 py-2 transition-colors hover:bg-fill-1/60"
          style={{ ['--i' as string]: index }}
        >
          <span className="numeric w-5 shrink-0 text-right text-footnote text-text-3">
            {start + index + 1}
          </span>
          {art && <Cover name={item.cover ?? item.title} shape={art} className="size-10" />}
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
