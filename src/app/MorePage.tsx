import { NAV_GROUPS } from './navigation.ts';
import { NavItem } from './NavItem.tsx';
import type { Route } from './routes.ts';

/** Phone-only list of every destination (the "Mais" tab), grouped like iOS Settings. */
export function MorePage({ route }: { route: Route }) {
  return (
    <main className="px-4 pt-4 pb-16">
      <h1 className="font-display text-display font-semibold">Mais</h1>
      <nav aria-label="Todas as seções" className="mt-6 space-y-6">
        {NAV_GROUPS.map((group) => (
          <section key={group.label ?? 'main'}>
            {group.label && <h2 className="eyebrow mb-2 px-4">{group.label}</h2>}
            <div className="card divide-y divide-separator overflow-hidden">
              {group.items.map((item) => (
                <NavItem key={item.label} item={item} current={route} layout="list" />
              ))}
            </div>
          </section>
        ))}
      </nav>
    </main>
  );
}
