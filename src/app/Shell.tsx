import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { formatDate } from '../lib/format.ts';
import { useLibrary } from './library-context.ts';
import { ROUTE_TITLES } from './route-titles.ts';
import type { Route } from './routes.ts';
import { Wordmark } from './Wordmark.tsx';
import { MOBILE, PRIMARY, SECONDARY } from './navigation.ts';
import { NavItem } from './NavItem.tsx';

/**
 * App shell: narrow text sidebar on wide screens, text tab bar on phones.
 * Both phone bars use a translucent material; the top bar shows the screen's
 * title once its large heading scrolls away, as iOS navigation bars do.
 */

function DataStatus() {
  const { summary } = useLibrary();
  if (!summary?.lastPlay) return null;
  return (
    <p className="text-footnote text-text-3">
      Dados até
      <span className="block text-text-2">{formatDate(summary.lastPlay)}</span>
    </p>
  );
}

/** True once the page's h1 has scrolled under the top bar. */
function useHeadingScrolledAway(route: Route): boolean {
  const [away, setAway] = useState(false);
  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let frame = 0;
    let tries = 0;
    const attach = () => {
      const heading = document.querySelector('main h1');
      if (!heading) {
        // Lazy screens mount a moment later.
        if (tries++ < 60) frame = requestAnimationFrame(attach);
        return;
      }
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry) setAway(!entry.isIntersecting && entry.boundingClientRect.top < 0);
        },
        { rootMargin: '-52px 0px 0px 0px' },
      );
      observer.observe(heading);
    };
    attach();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [route]);
  return away;
}

/** Sidebar selection that glides between items instead of jumping. */
function useSelectionIndicator(route: Route) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  // The first placement is instant; later ones animate.
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const active = container.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active || active.offsetParent === null) {
        setBox(null);
        return;
      }
      const outer = container.getBoundingClientRect();
      const inner = active.getBoundingClientRect();
      setBox({ top: inner.top - outer.top, height: inner.height });
    };
    update();
    const frame = requestAnimationFrame(() => {
      setAnimate(true);
    });
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [route]);

  return { containerRef, box, animate };
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const scrolled = useHeadingScrolledAway(route);
  const { containerRef, box, animate } = useSelectionIndicator(route);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
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
      <aside className="hairline sticky top-0 hidden h-dvh flex-col border-r px-4 py-6 lg:flex">
        <a href="#visao-geral" className="px-3" aria-label="Liner">
          <Wordmark />
        </a>
        <div ref={containerRef} className="relative mt-10">
          {box && (
            <span
              aria-hidden
              className={`absolute inset-x-0 top-0 rounded-control bg-fill-1 ${
                animate ? 'transition-transform duration-500 ease-spring' : ''
              }`}
              style={{ height: box.height, transform: `translateY(${box.top}px)` }}
            />
          )}
          <nav aria-label="Principal" className="relative space-y-0.5">
            {PRIMARY.map((item) => (
              <NavItem key={item.label} item={item} current={route} />
            ))}
          </nav>
          <nav
            aria-label="Ferramentas"
            className="hairline relative mt-6 space-y-0.5 border-t pt-6"
          >
            {SECONDARY.map((item) => (
              <NavItem key={item.label} item={item} current={route} />
            ))}
          </nav>
        </div>
        <div className="mt-auto px-3">
          <DataStatus />
        </div>
      </aside>

      <header
        className={`material sticky top-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center border-b px-4 py-3 transition-[border-color] duration-200 lg:hidden ${
          scrolled ? 'border-separator' : 'border-transparent'
        }`}
      >
        <a href="#visao-geral" aria-label="Liner" className="justify-self-start">
          <Wordmark className="text-callout" />
        </a>
        <p
          aria-hidden
          className={`max-w-[50vw] truncate text-callout font-semibold transition-[opacity,transform] duration-300 ease-emphasized ${
            scrolled ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
          }`}
        >
          {ROUTE_TITLES[route]}
        </p>
      </header>

      <div id="conteudo" className="min-w-0 pb-24 lg:pb-0">
        {children}
      </div>

      <nav
        aria-label="Principal"
        className="material hairline fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] text-center lg:hidden"
      >
        {MOBILE.map((item) => (
          <NavItem key={item.label} item={item} current={route} compact />
        ))}
      </nav>
    </div>
  );
}
