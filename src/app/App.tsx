import { useEffect, useState } from 'react';
import { ReferencePage } from '../design/ReferencePage.tsx';
import { SampleOverview } from '../design/SampleOverview.tsx';
import { Shell } from './Shell.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';
import { applyTheme, THEME_SEGMENTS, type ThemePreference } from './theme.ts';

/**
 * Stage 1: only the visual reference (#referencia, default) and the sample screen (#exemplo).
 * Functional screens are built after visual approval (docs/PLANNING.md §13).
 */

type Route = 'reference' | 'sample';

function readRoute(): Route {
  return window.location.hash === '#exemplo' ? 'sample' : 'reference';
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [theme, setTheme] = useState<ThemePreference>('system');

  useEffect(() => {
    const onHashChange = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  if (route === 'sample') {
    return (
      <Shell
        footer={
          <SegmentedControl
            label="Tema"
            segments={THEME_SEGMENTS}
            value={theme}
            onChange={setTheme}
            fullWidth
          />
        }
      >
        <SampleOverview />
      </Shell>
    );
  }
  return <ReferencePage theme={theme} onThemeChange={setTheme} />;
}
