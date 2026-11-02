import { useEffect, useRef, useState } from 'react';

/**
 * Valeur qui glisse en douceur vers `target` (décompte animé). Part de 0 au premier affichage.
 * Si la cible change en cours de route, l'animation repart de la valeur affichée à cet instant.
 */
export function useAnimatedNumber(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = target;
      setValue(target);
      return;
    }
    const origin = current.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // décélération douce
      current.current = origin + (target - origin) * eased;
      setValue(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
