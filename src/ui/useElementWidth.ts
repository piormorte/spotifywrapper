import { useLayoutEffect, useRef, useState } from 'react';

/** Tracks an element's content width so charts can draw in real pixels. */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, width] as const;
}
