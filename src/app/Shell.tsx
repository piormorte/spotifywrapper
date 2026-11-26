import { CalendarDays, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { formatDate } from '../lib/format.ts';
import type { PeriodSpec } from '../stats/period.ts';
import { periodLabel } from '../features/export/period-label.ts';
import { initialsOf } from '../ui/cover-art.ts';
import { greeting } from './greeting.ts';
import { useLibrary } from './library-context.ts';
import { MOBILE, NAV_GROUPS } from './navigation.ts';
import { NavItem } from './NavItem.tsx';
import { ROUTE_TITLES } from './route-titles.ts';
import type { Route } from './routes.ts';
import { Wordmark } from './Wordmark.tsx';

/**
 * App shell, in the manner of a native desktop app: a translucent sidebar with
 * grouped, iconified destinations (collapsible to a rail), a quiet top bar
 * with greeting, period and profile, and an iOS-style tab bar on phones.
 */

/** Routes whose figures depend on the shared period. */
const PERIOD_ROUTES: readonly Route[] = [
  'visao-geral',
  'sua-musica',
  'faixas',
  'artistas',
  'albuns',
  'linha-do-tempo',
  'analises',
  'perfil',
  'exportar',
];

function DataStatus({ compact }: { compact: boolean }) {
  const { summary } = useLibrary();
  if (!summary?.lastPlay || compact) return null;
  return (
    <p className="px-2.5 text-footnote text-text-3">
      Dados até
      <span className="numeric block text-text-2">{formatDate(summary.lastPlay)}</span>
    </p>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <a
      href="#ajustes"
      aria-label={name ? `Perfil: ${name}` : 'Perfil e ajustes'}
      className="grid size-8 shrink-0 place-items-center rounded-full bg-fill-1 text-footnote font-semibold text-text-1 shadow-[inset_0_0_0_1px_var(--border)] transition-colors hover:bg-fill-2"
    >
      {name ? (
        initialsOf(name).slice(0, 2)
      ) : (
        <svg aria-hidden viewBox="0 0 24 24" className="size-4 text-text-2" fill="currentColor">
          <circle cx="12" cy="8.5" r="4" />
          <path d="M4 20.5c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
        </svg>
      )}
    </a>
  );
}

function TopBar({
  route,
  period,
  displayName,
}: {
  route: Route;
  period: PeriodSpec;
  displayName: string;
}) {
  const { summary } = useLibrary();
  const [scrolled, setScrolled] = useState(false);
  const [hour] = useState(() => new Date().getHours());

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 72);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const lastYear = summary?.lastPlay ? new Date(summary.lastPlay).getFullYear() : null;
  const showPeriod = PERIOD_ROUTES.includes(route) && summary?.lastPlay;
  const label = periodLabel(period, lastYear ? `${String(lastYear)}-12-31` : '');
  const hello = `${greeting(hour)}${displayName ? `, ${displayName.split(/\s+/)[0] ?? ''}` : ''}`;

  return (
    <header
      className={`chrome sticky top-0 z-30 flex h-14 items-center gap-3 px-4 transition-[box-shadow] duration-200 sm:px-6 lg:px-10 ${
        scrolled ? 'shadow-[0_1px_0_var(--separator)]' : ''
      }`}
    >
      <a href="#visao-geral" aria-label="Liner" className="md:hidden">
        <Wordmark className="text-callout" />
      </a>
      <div className="relative hidden h-10 min-w-0 flex-1 md:block">
        <p
          className={`absolute inset-0 flex items-center text-callout text-text-2 transition-opacity duration-200 ${
            scrolled ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {hello}
        </p>
        <p
          aria-hidden
          className={`absolute inset-0 flex items-center truncate text-callout font-semibold transition-opacity duration-200 ${
            scrolled ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {ROUTE_TITLES[route]}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {showPeriod && label && (
          <span className="numeric hidden items-center gap-1.5 rounded-pill bg-fill-1 px-3 py-1 text-footnote text-text-2 sm:inline-flex">
            <CalendarDays aria-hidden size={13} strokeWidth={2} />
            <span className="sr-only">Período:</span>
            {label}
          </span>
        )}
        <a
          href="#ajustes"
          aria-label="Ajustes"
          className="grid size-8 place-items-center rounded-full text-text-2 transition-colors hover:bg-fill-1 hover:text-text-1"
        >
          <Settings aria-hidden size={17} strokeWidth={1.9} />
        </a>
        <Avatar name={displayName} />
      </div>
    </header>
  );
}

export function Shell({
  route,
  period,
  displayName,
  collapsed,
  onCollapsedChange,
  children,
}: {
  route: Route;
  period: PeriodSpec;
  displayName: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  children: ReactNode;
}) {
  // Tablets always get the rail; desktops follow the preference.
  const rail = collapsed;
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[auto_minmax(0,1fr)]">
      <button
        type="button"
        onClick={() => {
          const target =
            document.querySelector<HTMLElement>('main h1') ?? document.getElementById('conteudo');
          if (target) {
            target.tabIndex = -1;
            target.focus();
          }
        }}
        className="sr-only z-50 rounded-control bg-text-1 px-4 py-2 text-callout text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </button>

      <aside
        className={`hairline motion-move sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r bg-bg-2 py-5 transition-[width] duration-300 ease-emphasized md:flex ${
          rail
            ? 'w-[72px] items-center px-3'
            : 'w-[72px] items-center px-3 lg:w-[248px] lg:items-stretch lg:px-3.5'
        }`}
      >
        <a href="#visao-geral" className={rail ? '' : 'lg:px-2.5'} aria-label="Liner">
          <Wordmark showName={false} className={rail ? '' : 'lg:hidden'} />
          {!rail && <Wordmark className="hidden lg:inline-flex" />}
        </a>

        {NAV_GROUPS.map((group, gi) => (
          <nav
            key={group.label ?? 'main'}
            aria-label={gi === 0 ? 'Principal' : (group.label ?? '')}
            className={gi === 0 ? 'mt-8 w-full' : 'mt-6 w-full'}
          >
            {group.label && (
              <h2
                className={`mb-1.5 px-2.5 text-caption font-semibold tracking-[0.04em] text-text-3 ${
                  rail ? 'sr-only' : 'sr-only lg:not-sr-only'
                }`}
              >
                {group.label}
              </h2>
            )}
            {group.label && (
              <div
                aria-hidden
                className={`hairline mx-auto mb-3 w-6 border-t ${rail ? '' : 'lg:hidden'}`}
              />
            )}
            <div
              className={`flex flex-col gap-0.5 ${rail ? 'items-center' : 'items-center lg:items-stretch'}`}
            >
              {group.items.map((item) => (
                <NavItem
                  key={item.label}
                  item={item}
                  current={route}
                  layout={rail ? 'rail' : 'sidebar'}
                />
              ))}
            </div>
          </nav>
        ))}

        <div
          className={`mt-auto flex w-full flex-col gap-4 pt-6 ${rail ? 'items-center' : 'items-center lg:items-stretch'}`}
        >
          <span className={rail ? 'hidden' : 'hidden lg:block'}>
            <DataStatus compact={rail} />
          </span>
          <button
            type="button"
            onClick={() => {
              onCollapsedChange(!collapsed);
            }}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            title={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            className={`hidden size-9 place-items-center rounded-control text-text-3 transition-colors hover:bg-fill-1 hover:text-text-1 lg:grid ${
              rail ? '' : 'lg:ml-1'
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden size={18} strokeWidth={1.8} />
            ) : (
              <PanelLeftClose aria-hidden size={18} strokeWidth={1.8} />
            )}
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <TopBar route={route} period={period} displayName={displayName} />
        <div id="conteudo" className="min-w-0 pb-28 md:pb-0">
          {children}
        </div>
      </div>

      <nav
        aria-label="Principal"
        className="chrome fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 shadow-[0_-1px_0_var(--separator)] px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] md:hidden"
      >
        {MOBILE.map((item) => (
          <NavItem key={item.label} item={item} current={route} layout="tab" />
        ))}
      </nav>
    </div>
  );
}
