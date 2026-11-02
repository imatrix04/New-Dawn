import { useEffect, useRef, type ReactNode } from 'react';
import { useLayout } from './layout';

/** Le « tableau » : fond sur lequel flottent les cartes. */
export function Board({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reset = useLayout((s) => s.reset);
  const fit = useLayout((s) => s.fit);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!useLayout.getState().saved) reset(width); // première ouverture : disposition adaptée à la fenêtre
      fit(width, height);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [reset, fit]);

  return <div className="board" ref={ref}>{children}</div>;
}
