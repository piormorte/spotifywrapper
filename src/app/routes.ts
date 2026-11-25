/**
 * Hash routes. Plain names only ("#importar"), which survive being shared and
 * embedded. Unknown or empty hashes fall back to the import screen.
 */
export const ROUTES = ['importar', 'ajustes', 'exemplo', 'referencia'] as const;
export type Route = (typeof ROUTES)[number];

export const DEFAULT_ROUTE: Route = 'importar';

export function parseRoute(hash: string): Route {
  const name = hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : DEFAULT_ROUTE;
}
