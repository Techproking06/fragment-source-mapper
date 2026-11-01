import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base = (p: P) => ({
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
});

export const Sun = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const Moon = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export const Play = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 4.5 19 12 6 19.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const ArrowRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const ArrowLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

export const Check = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 12.5 9 17.5 20 6.5" />
  </svg>
);

export const Close = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const Pencil = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20h4l10-10a2.8 2.8 0 1 0-4-4L4 16z" />
  </svg>
);

/** Four squares in the source palette — the “patchwork” mark. */
export const Mark = (p: P) => (
  <svg width={26} height={26} viewBox="0 0 26 26" aria-hidden {...p}>
    <rect x="1" y="1" width="11" height="7" rx="2" fill="var(--src-a)" />
    <rect x="14" y="1" width="11" height="11" rx="2" fill="var(--src-c)" />
    <rect x="1" y="10" width="11" height="15" rx="2" fill="var(--src-b)" />
    <rect x="14" y="14" width="11" height="11" rx="2" fill="var(--src-d)" />
  </svg>
);
