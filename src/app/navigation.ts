import type { Route } from './routes.ts';

/** Navigation destinations. Entries without a route are not built yet. */

export interface Destination {
  readonly label: string;
  readonly short: string;
  readonly route?: Route;
}

export const PRIMARY: readonly Destination[] = [
  { label: 'Visão geral', short: 'Início', route: 'visao-geral' },
  { label: 'Histórico', short: 'Histórico', route: 'historico' },
  { label: 'Faixas', short: 'Rankings', route: 'faixas' },
  { label: 'Artistas', short: 'Artistas', route: 'artistas' },
  { label: 'Álbuns', short: 'Álbuns', route: 'albuns' },
  { label: 'Linha do tempo', short: 'Tempo', route: 'linha-do-tempo' },
  { label: 'Análises', short: 'Análises' },
  { label: 'Perfil de escuta', short: 'Perfil' },
];

export const SECONDARY: readonly Destination[] = [
  { label: 'Export Studio', short: 'Exportar' },
  { label: 'Importar dados', short: 'Importar', route: 'importar' },
  { label: 'Ajustes', short: 'Ajustes', route: 'ajustes' },
];

export const MOBILE: readonly Destination[] = [
  { label: 'Visão geral', short: 'Início', route: 'visao-geral' },
  { label: 'Faixas', short: 'Faixas', route: 'faixas' },
  { label: 'Artistas', short: 'Artistas', route: 'artistas' },
  { label: 'Histórico', short: 'Histórico', route: 'historico' },
  { label: 'Mais', short: 'Mais', route: 'mais' },
];

/** Destinations reached through "Mais" on phones. */
export const MORE_ROUTES: readonly Route[] = [
  'albuns',
  'linha-do-tempo',
  'importar',
  'ajustes',
  'mais',
];

/** Every destination, for the phone "Mais" screen. */
export const ALL_DESTINATIONS: readonly Destination[] = [...PRIMARY, ...SECONDARY];
