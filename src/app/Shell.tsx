import type { ReactNode } from 'react';
import { Wordmark } from './Wordmark.tsx';

/**
 * App shell: narrow text sidebar on wide screens, text tab bar on phones.
 *
 * In Stage 1 only "Visão geral" (the sample screen) exists. The remaining
 * destinations are shown so the navigation can be reviewed, but rendered as
 * plain, non-interactive text — never as buttons that do nothing.
 */

interface Destination {
  readonly label: string;
  readonly short: string;
  readonly href?: string;
}

const PRIMARY: readonly Destination[] = [
  { label: 'Visão geral', short: 'Início', href: '#exemplo' },
  { label: 'Histórico', short: 'Histórico' },
  { label: 'Faixas', short: 'Rankings' },
  { label: 'Artistas', short: 'Artistas' },
  { label: 'Álbuns', short: 'Álbuns' },
  { label: 'Linha do tempo', short: 'Tempo' },
  { label: 'Análises', short: 'Análises' },
  { label: 'Perfil de escuta', short: 'Perfil' },
];

const SECONDARY: readonly Destination[] = [
  { label: 'Export Studio', short: 'Exportar' },
  { label: 'Importar dados', short: 'Importar' },
  { label: 'Ajustes', short: 'Ajustes' },
];

const MOBILE: readonly Destination[] = [
  PRIMARY[0],
  PRIMARY[2],
  PRIMARY[5],
  PRIMARY[6],
  SECONDARY[0],
].filter((d): d is Destination => d !== undefined);

function NavItem({
  item,
  active,
  compact,
}: {
  item: Destination;
  active: boolean;
  compact?: boolean;
}) {
  const text = compact ? item.short : item.label;
  const base = compact
    ? 'block px-1 py-2 text-caption tracking-normal normal-case'
    : 'block rounded-control px-3 py-1.5 text-callout';
  if (!item.href) {
    return (
      <span className={`${base} cursor-default text-text-3`} title="Disponível em uma etapa futura">
        {text}
      </span>
    );
  }
  return (
    <a
      href={item.href}
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

export function Shell({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="hairline sticky top-0 hidden h-dvh flex-col border-r px-4 py-6 lg:flex">
        <a href="#referencia" className="px-3" aria-label="Liner — referência visual">
          <Wordmark />
        </a>
        <nav aria-label="Principal" className="mt-10 space-y-0.5">
          {PRIMARY.map((item, i) => (
            <NavItem key={item.label} item={item} active={i === 0} />
          ))}
        </nav>
        <nav aria-label="Ferramentas" className="hairline mt-6 space-y-0.5 border-t pt-6">
          {SECONDARY.map((item) => (
            <NavItem key={item.label} item={item} active={false} />
          ))}
        </nav>
        <div className="mt-auto">{footer}</div>
      </aside>

      <header className="hairline sticky top-0 z-20 flex items-center justify-between border-b bg-bg px-4 py-3 lg:hidden">
        <a href="#referencia" aria-label="Liner — referência visual">
          <Wordmark className="text-callout" />
        </a>
      </header>

      <div className="min-w-0 pb-24 lg:pb-0">{children}</div>

      <nav
        aria-label="Principal"
        className="hairline fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-bg px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 text-center lg:hidden"
      >
        {MOBILE.map((item, i) => (
          <NavItem key={item.label} item={item} active={i === 0} compact />
        ))}
      </nav>
    </div>
  );
}
