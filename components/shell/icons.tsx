// components/shell/icons.tsx
//
// The three icons the A3 top bar needs, plus the close mark the
// hamburger becomes on a phone — drawn as Claude Design's A3TopBar
// card has them: 16px outline, 1.5px stroke, round joins, on a 16px
// grid inside a 44px target. Inline until DS6 gives the product an
// icon set; every other icon in the app is still an emoji in a nav
// label (lib/nav/*.ts).

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  'aria-hidden': true,
} as const;

export function IconMenu({ className }: { className?: string }) {
  return (
    <svg {...base} strokeLinecap="round" className={className}>
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  );
}

export function IconClose({ className }: { className?: string }) {
  return (
    <svg {...base} strokeLinecap="round" className={className}>
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}

export function IconEnvelope() {
  return (
    <svg {...base} strokeLinejoin="round">
      <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.5" />
      <path d="M2.25 4.25L8 8.75l5.75-4.5" />
    </svg>
  );
}

export function IconBell() {
  return (
    <svg {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.25V7a4 4 0 018 0v4.25l1.25 1.5H2.75L4 11.25z" />
      <path d="M6.5 14.25a1.6 1.6 0 003 0" />
    </svg>
  );
}
