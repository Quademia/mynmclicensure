// components/shell/wordmark.tsx
//
// The one wordmark, drawn by both top bars (10-design-system.md DS21,
// Sam 2026-09-23; the order settled 2026-09-26): the painted Q, then
// QUADEMIA as a small line on top and the product bold beneath. Brand
// first, weight on the product — Sam's rule of 2026-09-22 ("the order
// says whose product it is, the weight says which one you are in").
// DS21's first cut had it the other way up (the product on top, "by
// Quademia" beneath, recorded as MyNclex's lockup — MyNclex's bar is in
// fact text only, "MyNclex-RN", with the Q nowhere on the page). Chosen
// on 2026-09-26 from six lockups measured on the real bar: UWorld's
// parent-first family idea in the shape a 360px phone holds (166px, the
// same as before; the one-line "QUADEMIA | MyNMCLicensure" overflows a
// 360px bar by 24px).
//
// The small line is typed "Quademia" and set in capitals by the style,
// so a screen reader says the word rather than spelling it.
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
        <span>Quademia</span>
        <b>{product}</b>
      </span>
    </span>
  );
}
