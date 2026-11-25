import { useEffect, useRef, useState } from 'react';
import { easeOutExpo, formatCountFrame, parseCountTarget } from '../lib/countup.ts';

const DURATION_MS = 900;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animates a pre-formatted number from its previous value (0 on first show)
 * to the new one. Non-numeric text and reduced motion show the value at once.
 */
export function useCountUp(text: string): string {
  const [frame, setFrame] = useState(() =>
    parseCountTarget(text) && !prefersReducedMotion() ? '0' : text,
  );
  const from = useRef(0);

  useEffect(() => {
    const target = parseCountTarget(text);
    if (!target || prefersReducedMotion()) {
      setFrame(text);
      from.current = target?.value ?? 0;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / DURATION_MS, 1);
      const value = origin + (target.value - origin) * easeOutExpo(t);
      from.current = value;
      if (t < 1) {
        setFrame(formatCountFrame(target, value));
        raf = requestAnimationFrame(tick);
      } else {
        from.current = target.value;
        setFrame(text);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [text]);

  return frame;
}
