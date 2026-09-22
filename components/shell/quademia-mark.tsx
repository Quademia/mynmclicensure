// components/shell/quademia-mark.tsx
//
// The Quademia Q as vector geometry — the small-size build from Sam's
// "The Quademia Q" artifact of 2026-08-12 (the redraw of the painted
// mark MyNclex carries as app/icon.png). This build is the one drawn
// for 16–48px: no thin mint ring, a thicker cream edge, a fatter Q. It
// keeps its own four colours; a logo is not retinted to match a page
// (10-design-system.md DS7, Sam 2026-09-22). Used by the name circle
// wherever Quademia itself is the speaker.

export function QuademiaMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label="Quademia"
    >
      <circle cx="256" cy="256" r="252" fill="#F6F1E3" />
      <circle cx="256" cy="256" r="222" fill="#0D6E6C" />
      <g fill="#F6F1E3" transform="translate(-23.8,-23.8) scale(1.10)">
        <path
          fillRule="evenodd"
          d="M 120 238 A 118 146 0 1 0 356 238 A 118 146 0 1 0 120 238 Z M 180 238 A 58 104 0 1 0 296 238 A 58 104 0 1 0 180 238 Z"
        />
        <path d="M 193.5 249.3 L 216.1 293.4 Q 228 306, 241.0 291.2 Q 264 240, 272 176 Q 255 220, 225.3 255.1 L 210.5 238.7 Z" />
        <path d="M 197 278 C 218 348, 264 378, 314 346 L 352 320 C 338 380, 244 410, 177 304 Z" />
        <path d="M 350 324 Q 357 337 350 350" fill="none" stroke="#F6F1E3" strokeWidth="8" strokeLinecap="round" />
        <ellipse cx="348" cy="360" rx="14" ry="12.5" />
        <path d="M 336 370 L 360 370 L 370 400 Q 348 410, 326 400 Z" />
      </g>
    </svg>
  );
}
