import { useCallback, useEffect, useState } from 'react';
import { ReferencePage } from '../design/ReferencePage.tsx';
import { ImportPage } from '../features/import/ImportPage.tsx';
import { AnalyticsPage } from '../features/analytics/AnalyticsPage.tsx';
import { PersonalityPage } from '../features/analytics/PersonalityPage.tsx';
import { ExportStudioPage } from '../features/export/ExportStudioPage.tsx';
import { HistoryPage } from '../features/history/HistoryPage.tsx';
import { OverviewPage } from '../features/overview/OverviewPage.tsx';
import { RankingsPage } from '../features/rankings/RankingsPage.tsx';
import { TimelinePage } from '../features/timeline/TimelinePage.tsx';
import type { PeriodSpec } from '../stats/period.ts';
import { MorePage } from './MorePage.tsx';
import { SettingsPage } from '../features/settings/SettingsPage.tsx';
import { useLibrary } from './library-context.ts';
import { parseRoute, type Route } from './routes.ts';
import { Shell } from './Shell.tsx';
import { applyTheme, type ThemePreference } from './theme.ts';

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export function App() {
  const { client, status } = useLibrary();
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [theme, setThemeState] = useState<ThemePreference>('system');
  // The period is shared by the overview and the rankings.
  const [period, setPeriod] = useState<PeriodSpec>({ preset: 'all' });

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

  if (route === 'referencia') return <ReferencePage theme={theme} onThemeChange={setTheme} />;

  const page = (() => {
    switch (route) {
      case 'visao-geral':
        return <OverviewPage period={period} onPeriodChange={setPeriod} />;
      case 'historico':
        return <HistoryPage />;
      case 'faixas':
        return <RankingsPage kind="tracks" period={period} onPeriodChange={setPeriod} />;
      case 'artistas':
        return <RankingsPage kind="artists" period={period} onPeriodChange={setPeriod} />;
      case 'albuns':
        return <RankingsPage kind="albums" period={period} onPeriodChange={setPeriod} />;
      case 'linha-do-tempo':
        return <TimelinePage period={period} onPeriodChange={setPeriod} />;
      case 'analises':
        return <AnalyticsPage period={period} onPeriodChange={setPeriod} />;
      case 'perfil':
        return <PersonalityPage period={period} onPeriodChange={setPeriod} />;
      case 'exportar':
        return <ExportStudioPage period={period} onPeriodChange={setPeriod} />;
      case 'importar':
        return <ImportPage />;
      case 'ajustes':
        return <SettingsPage theme={theme} onThemeChange={setTheme} />;
      case 'mais':
        return <MorePage route={route} />;
    }
  })();

  return <Shell route={route}>{page}</Shell>;
}
