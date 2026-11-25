import { MORE_ROUTES, type Destination } from './navigation.ts';
import type { Route } from './routes.ts';

/** Unbuilt destinations render as plain text — never as controls that do nothing. */
export function NavItem({
  item,
  current,
  compact = false,
}: {
  item: Destination;
  current: Route;
  compact?: boolean;
}) {
  const text = compact ? item.short : item.label;
  const base = compact
    ? 'block px-1 py-2 text-caption tracking-normal normal-case'
    : 'block rounded-control px-3 py-1.5 text-callout';
  if (!item.route) {
    return (
      <span className={`${base} cursor-default text-text-3`} title="Disponível em uma etapa futura">
        {text}
      </span>
    );
  }
  const active =
    item.route === current || (compact && item.route === 'mais' && MORE_ROUTES.includes(current));
  return (
    <a
      href={`#${item.route}`}
      aria-current={active ? 'page' : undefined}
      className={`${base} transition-colors ${
        active
          ? compact
            ? 'font-semibold text-text-1'
            : 'bg-fill-1 font-medium text-text-1'
          : 'text-text-2 hover:text-text-1'
      }`}
    >
      {text}
    </a>
  );
}
