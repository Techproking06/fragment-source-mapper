import { useCallback, useEffect, useState } from 'react';

/* ------------------------------- theme ------------------------------- */

export type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || 'dark',
  );

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem('fsm-theme', next);
      } catch {
        /* storage unavailable — theme still applies for this session */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}

/* ------------------------------ keyboard ------------------------------ */

export function useKeydown(handler: (e: KeyboardEvent) => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const fn = (e: KeyboardEvent) => handler(e);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [handler, active]);
}
