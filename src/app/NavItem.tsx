import { MORE_ROUTES, type Destination } from './navigation.ts';
import type { Route } from './routes.ts';

/** `sidebar`: rail below lg, full row from lg. `rail`: icon only at every width. */
type Layout = 'sidebar' | 'rail' | 'tab' | 'list';

/** Unbuilt destinations render as plain text — never as controls that do nothing. */
export function NavItem({
  item,
  current,
  layout = 'sidebar',
}: {
  item: Destination;
  current: Route;
  layout?: Layout;
}) {
  const Icon = item.icon;
  if (!item.route) {
    return (
      <span
        className="block px-3 py-1.5 text-callout text-text-3"
        title="Disponível em uma etapa futura"
      >
        {item.label}
      </span>
    );
  }
  const active =
    item.route === current ||
    (layout === 'tab' && item.route === 'mais' && MORE_ROUTES.includes(current));

  if (layout === 'tab') {
    return (
      <a
        href={`#${item.route}`}
        aria-current={active ? 'page' : undefined}
        className={`flex flex-col items-center gap-0.5 px-1 pt-1.5 pb-1 text-[0.625rem] leading-tight font-medium transition-colors ${
          active ? 'text-text-1' : 'text-text-3 hover:text-text-2'
        }`}
      >
        <Icon aria-hidden size={22} strokeWidth={active ? 2.1 : 1.7} />
        <span>{item.short}</span>
      </a>
    );
  }

  if (layout === 'list') {
    return (
      <a
        href={`#${item.route}`}
        aria-current={active ? 'page' : undefined}
        className="flex items-center gap-3.5 px-4 py-3 text-body transition-colors hover:bg-fill-1/60"
      >
        <span className="grid size-8 place-items-center rounded-[9px] bg-fill-1 text-text-1">
          <Icon aria-hidden size={17} strokeWidth={1.9} />
        </span>
        <span className="flex-1">{item.label}</span>
        <span aria-hidden className="text-text-3">
          ›
        </span>
      </a>
    );
  }

  const rail = layout === 'rail';
  return (
    <a
      href={`#${item.route}`}
      aria-current={active ? 'page' : undefined}
      title={rail ? item.label : undefined}
      className={`group flex items-center gap-3 rounded-control text-callout transition-colors ${
        rail
          ? 'size-10 justify-center'
          : 'size-10 justify-center lg:size-auto lg:justify-start lg:px-2.5 lg:py-[7px]'
      } ${
        active
          ? 'bg-fill-1 font-medium text-text-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]'
          : 'text-text-2 hover:bg-fill-1/55 hover:text-text-1'
      }`}
    >
      <Icon
        aria-hidden
        size={18}
        strokeWidth={active ? 2.1 : 1.8}
        className={active ? 'text-text-1' : 'text-text-3 transition-colors group-hover:text-text-2'}
      />
      <span className={rail ? 'sr-only' : 'sr-only lg:not-sr-only lg:truncate'}>{item.label}</span>
    </a>
  );
}
