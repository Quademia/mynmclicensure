// components/shell/page-header.tsx
//
// The row at the top of a page: the title and subtitle. Legacy's
// <div class="top-nav"> also carried the signed-in name and a Sign out
// button on the right; under A3 (10-design-system.md DS5) those live in
// the top bar, so the pages that render this keep only the left half.
//
// The title's look (Sam, 2026-10-17, 09.11; drawn as 4b): navy, one line
// across the page beneath it, teal at the start turning grey over a fixed
// length, the same for every title, short or on two lines; the subtitle, a
// count or a sentence, always below the line. Server Component.

export function PageHeader({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div className="page-header-row">
        <h1 className="page-header-title">{title}</h1>
      </div>
      {subtitle ? <p className="page-header-sub">{subtitle}</p> : null}
    </div>
  );
}

/** The display name every legacy page used: forename → name → email. */
export function displayNameOf(p: { forename: string | null; name: string | null; email: string }): string {
  return p.forename || p.name || p.email;
}
