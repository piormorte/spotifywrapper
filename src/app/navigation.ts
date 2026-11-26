import {
  ChartColumn,
  Disc3,
  Ellipsis,
  Fingerprint,
  History,
  House,
  Library,
  Mic2,
  Music2,
  Settings,
  Share,
  Sparkles,
  Upload,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { Route } from './routes.ts';

/** Navigation destinations. Entries without a route are not built yet. */

export interface Destination {
  readonly label: string;
  readonly short: string;
  readonly route?: Route;
  readonly icon: LucideIcon;
}

export interface NavGroup {
  /** Visible group heading; the first group has none. */
  readonly label: string | null;
  readonly items: readonly Destination[];
}

const D = {
  overview: { label: 'Visão geral', short: 'Início', route: 'visao-geral', icon: House },
  music: { label: 'Sua música', short: 'Música', route: 'sua-musica', icon: Library },
  artists: { label: 'Artistas', short: 'Artistas', route: 'artistas', icon: Mic2 },
  tracks: { label: 'Faixas', short: 'Faixas', route: 'faixas', icon: Music2 },
  albums: { label: 'Álbuns', short: 'Álbuns', route: 'albuns', icon: Disc3 },
  history: { label: 'Histórico', short: 'Histórico', route: 'historico', icon: History },
  timeline: { label: 'Linha do tempo', short: 'Tempo', route: 'linha-do-tempo', icon: ChartColumn },
  analytics: { label: 'Análises', short: 'Análises', route: 'analises', icon: Waves },
  profile: { label: 'Perfil de escuta', short: 'Perfil', route: 'perfil', icon: Fingerprint },
  wrapped: {
    label: 'Retrospectiva',
    short: 'Retrospectiva',
    route: 'retrospectiva',
    icon: Sparkles,
  },
  export: { label: 'Export Studio', short: 'Exportar', route: 'exportar', icon: Share },
  import: { label: 'Importar dados', short: 'Importar', route: 'importar', icon: Upload },
  settings: { label: 'Ajustes', short: 'Ajustes', route: 'ajustes', icon: Settings },
  more: { label: 'Mais', short: 'Mais', route: 'mais', icon: Ellipsis },
} as const satisfies Record<string, Destination>;

export const NAV_GROUPS: readonly NavGroup[] = [
  { label: null, items: [D.overview, D.music, D.artists, D.tracks, D.albums, D.history] },
  { label: 'Insights', items: [D.timeline, D.analytics, D.profile, D.wrapped] },
  { label: 'Biblioteca', items: [D.export, D.import, D.settings] },
];

export const MOBILE: readonly Destination[] = [D.overview, D.music, D.wrapped, D.history, D.more];

/** Destinations reached through "Mais" on phones. */
export const MORE_ROUTES: readonly Route[] = [
  'artistas',
  'faixas',
  'albuns',
  'linha-do-tempo',
  'analises',
  'perfil',
  'exportar',
  'importar',
  'ajustes',
  'mais',
];

/** Every destination, for the phone "Mais" screen. */
export const ALL_DESTINATIONS: readonly Destination[] = NAV_GROUPS.flatMap((g) => g.items);
