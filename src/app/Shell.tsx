import type { ReactNode } from 'react';
import { formatDate } from '../lib/format.ts';
import { useLibrary } from './library-context.ts';
import type { Route } from './routes.ts';
import { Wordmark } from './Wordmark.tsx';
import { MOBILE, PRIMARY, SECONDARY } from './navigation.ts';
import { NavItem } from './NavItem.tsx';

/**
 * App shell: narrow text sidebar on wide screens, text tab bar on phones.
 * Destinations not built yet render as plain, non-interactive text — never
 * as controls that do nothing.
 */

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
