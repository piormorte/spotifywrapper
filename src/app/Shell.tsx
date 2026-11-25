import type { ReactNode } from 'react';
import { formatDate } from '../lib/format.ts';
import { useLibrary } from './library-context.ts';
import type { Route } from './routes.ts';
import { Wordmark } from './Wordmark.tsx';

/**
 * App shell: narrow text sidebar on wide screens, text tab bar on phones.
 * Destinations not built yet render as plain, non-interactive text — never
 * as controls that do nothing.
 */

interface Destination {
  readonly label: string;
  readonly short: string;
  readonly route?: Route;
}

const PRIMARY: readonly Destination[] = [
  { label: 'Visão geral', short: 'Início', route: 'visao-geral' },
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
  { label: 'Importar dados', short: 'Importar', route: 'importar' },
  { label: 'Ajustes', short: 'Ajustes', route: 'ajustes' },
];

const MOBILE: readonly Destination[] = [
  { label: 'Visão geral', short: 'Início', route: 'visao-geral' },
  { label: 'Faixas', short: 'Rankings' },
  { label: 'Linha do tempo', short: 'Tempo' },
  { label: 'Importar dados', short: 'Importar', route: 'importar' },
  { label: 'Ajustes', short: 'Ajustes', route: 'ajustes' },
];

function NavItem({
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
  const active = item.route === current;
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

function DataStatus() {
  const { summary } = useLibrary();
  if (!summary?.lastPlay) return null;
  return (
    <p className="text-footnote text-text-3">
      Dados até
      <span className="block text-text-2">{formatDate(summary.lastPlay)}</span>
    </p>
  );
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="hairline sticky top-0 hidden h-dvh flex-col border-r px-4 py-6 lg:flex">
        <a href="#visao-geral" className="px-3" aria-label="Liner">
          <Wordmark />
        </a>
        <nav aria-label="Principal" className="mt-10 space-y-0.5">
          {PRIMARY.map((item) => (
            <NavItem key={item.label} item={item} current={route} />
          ))}
        </nav>
        <nav aria-label="Ferramentas" className="hairline mt-6 space-y-0.5 border-t pt-6">
          {SECONDARY.map((item) => (
            <NavItem key={item.label} item={item} current={route} />
          ))}
        </nav>
        <div className="mt-auto px-3">
          <DataStatus />
        </div>
      </aside>

      <header className="hairline sticky top-0 z-20 flex items-center justify-between border-b bg-bg px-4 py-3 lg:hidden">
        <a href="#visao-geral" aria-label="Liner">
          <Wordmark className="text-callout" />
        </a>
      </header>

      <div className="min-w-0 pb-24 lg:pb-0">{children}</div>

      <nav
        aria-label="Principal"
        className="hairline fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-bg px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] text-center lg:hidden"
      >
        {MOBILE.map((item) => (
          <NavItem key={item.label} item={item} current={route} compact />
        ))}
      </nav>
    </div>
  );
}
