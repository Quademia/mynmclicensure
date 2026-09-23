// components/shell/wordmark.tsx
//
// The one wordmark, drawn by both top bars (10-design-system.md DS21,
// Sam 2026-09-23): the painted Q, then the product on top and "by
// Quademia" beneath — MyNclex's lockup. It replaces DS5's one-line
// "Quademia MyNMCLicensure" (brand first, product bold; Sam 2026-09-22):
// the product leads because it is what a student came for, and the
// parent still earns its line.
//
// The two bars stay two components — the signed-in bar and the public
// bar do different jobs (Sam, 2026-09-23) — and share this piece so they
// look the same. No hooks and no state, so either kind of component can
// render it. The look is `.wordmark` in styles/components.css, which
// loads on every page.
//
// The mark is a 64px copy of public/images/quademia-mark.png (the same
// picture as app/icon.png, 512px and 91 KB): drawn at 28px on every page,
// the full file would be most of the bar's weight on a phone's data.

const MARK_64 = '/images/quademia-mark-64.png';

export function Wordmark({ product = 'MyNMCLicensure' }: { product?: string }) {
  return (
    <span className="wordmark">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 64px static asset drawn at 28px; next/image adds nothing here */}
      <img className="wordmark-mark" src={MARK_64} alt="" width={28} height={28} />
      <span className="wordmark-text">
        <b>{product}</b>
        <span>by Quademia</span>
      </span>
    </span>
  );
}
