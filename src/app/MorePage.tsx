import { ALL_DESTINATIONS } from './navigation.ts';
import { NavItem } from './NavItem.tsx';
import type { Route } from './routes.ts';

/** Phone-only list of every destination (the "Mais" tab). */
export function MorePage({ route }: { route: Route }) {
  return (
    <main className="px-4 pt-8 pb-16">
      <h1 className="font-display text-display font-semibold">Mais</h1>
      <nav aria-label="Todas as seções" className="mt-8 divide-y divide-separator">
        {ALL_DESTINATIONS.map((item) => (
          <NavItem key={item.label} item={item} current={route} />
        ))}
      </nav>
    </main>
  );
}
