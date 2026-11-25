import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ImportPage } from '../features/import/ImportPage.tsx';
import { OverviewPage } from '../features/overview/OverviewPage.tsx';
import type { PeriodSpec } from '../stats/period.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { useLibrary } from './library-context.ts';
import { MorePage } from './MorePage.tsx';
import { ROUTE_TITLES } from './route-titles.ts';
import { parseRoute, type Route } from './routes.ts';
import { Shell } from './Shell.tsx';
import { applyTheme, type ThemePreference } from './theme.ts';

// Screens beyond the first visit load on demand (all are precached for offline use).
const HistoryPage = lazy(() =>
  import('../features/history/HistoryPage.tsx').then((m) => ({ default: m.HistoryPage })),
);
const RankingsPage = lazy(() =>
  import('../features/rankings/RankingsPage.tsx').then((m) => ({ default: m.RankingsPage })),
);
const TimelinePage = lazy(() =>
  import('../features/timeline/TimelinePage.tsx').then((m) => ({ default: m.TimelinePage })),
);
const AnalyticsPage = lazy(() =>
  import('../features/analytics/AnalyticsPage.tsx').then((m) => ({ default: m.AnalyticsPage })),
);
const PersonalityPage = lazy(() =>
  import('../features/analytics/PersonalityPage.tsx').then((m) => ({
    default: m.PersonalityPage,
  })),
);
const ExportStudioPage = lazy(() =>
  import('../features/export/ExportStudioPage.tsx').then((m) => ({
    default: m.ExportStudioPage,
  })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage.tsx').then((m) => ({ default: m.SettingsPage })),
);
const ReferencePage = lazy(() =>
  import('../design/ReferencePage.tsx').then((m) => ({ default: m.ReferencePage })),
);

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

function Loading() {
  return (
    <p aria-live="polite" className="px-4 pt-14 text-callout text-text-2 sm:px-8 lg:px-14">
      Carregando…
    </p>
  );
}

export function App() {
  const { client, status } = useLibrary();
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [theme, setThemeState] = useState<ThemePreference>('system');
  // The period is shared by the overview, rankings, timeline, analytics and exports.
  const [period, setPeriod] = useState<PeriodSpec>({ preset: 'all' });
  const firstRoute = useRef(true);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  // Title per screen; after navigation, move focus to the new heading so
  // keyboard and screen-reader users land on the content.
  useEffect(() => {
    document.title = `${ROUTE_TITLES[route]} · Liner`;
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    let tries = 0;
    const focusHeading = () => {
      const heading = document.querySelector<HTMLElement>('main h1');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      } else if (tries++ < 20) {
        requestAnimationFrame(focusHeading);
      }
    };
    requestAnimationFrame(focusHeading);
  }, [route]);

  // The theme preference is stored in the local database, not browser storage.
  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    void client.call('getSetting', 'theme').then((value) => {
      if (lifecycle.active && value && (THEMES as readonly string[]).includes(value)) {
        setThemeState(value as ThemePreference);
      }
    });
    return () => {
      lifecycle.active = false;
    };
  }, [client, status]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      setThemeState(next);
      void client.call('setSetting', { key: 'theme', value: next });
    },
    [client],
  );

  const screen = (node: ReactNode) => (
    <ErrorBoundary key={route}>
      <Suspense fallback={<Loading />}>
        <div className="route-enter">{node}</div>
      </Suspense>
    </ErrorBoundary>
  );

  if (route === 'referencia') {
    return screen(<ReferencePage theme={theme} onThemeChange={setTheme} />);
  }

  const page = (() => {
    const periodProps = { period, onPeriodChange: setPeriod };
    switch (route) {
      case 'visao-geral':
        return <OverviewPage {...periodProps} />;
      case 'historico':
        return <HistoryPage />;
      case 'faixas':
        return <RankingsPage kind="tracks" {...periodProps} />;
      case 'artistas':
        return <RankingsPage kind="artists" {...periodProps} />;
      case 'albuns':
        return <RankingsPage kind="albums" {...periodProps} />;
      case 'linha-do-tempo':
        return <TimelinePage {...periodProps} />;
      case 'analises':
        return <AnalyticsPage {...periodProps} />;
      case 'perfil':
        return <PersonalityPage {...periodProps} />;
      case 'exportar':
        return <ExportStudioPage {...periodProps} />;
      case 'importar':
        return <ImportPage />;
      case 'ajustes':
        return <SettingsPage theme={theme} onThemeChange={setTheme} />;
      case 'mais':
        return <MorePage route={route} />;
    }
  })();

  return <Shell route={route}>{screen(page)}</Shell>;
}
