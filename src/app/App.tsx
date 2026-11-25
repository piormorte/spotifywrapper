import { useCallback, useEffect, useState } from 'react';
import { ReferencePage } from '../design/ReferencePage.tsx';
import { SampleOverview } from '../design/SampleOverview.tsx';
import { ImportPage } from '../features/import/ImportPage.tsx';
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

  switch (route) {
    case 'referencia':
      return <ReferencePage theme={theme} onThemeChange={setTheme} />;
    case 'exemplo':
      return (
        <Shell route={route}>
          <SampleOverview />
        </Shell>
      );
    case 'ajustes':
      return (
        <Shell route={route}>
          <SettingsPage theme={theme} onThemeChange={setTheme} />
        </Shell>
      );
    case 'importar':
      return (
        <Shell route={route}>
          <ImportPage />
        </Shell>
      );
  }
}
