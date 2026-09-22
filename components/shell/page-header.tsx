// components/shell/page-header.tsx
//
// The row at the top of a page: the title and subtitle. Legacy's
// <div class="top-nav"> also carried the signed-in name and a Sign out
// button on the right; under A3 (10-design-system.md DS5) those live in
// the top bar, so the 23 pages that render this keep only the left
// half. Server Component.

export function PageHeader({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}

/** The display name every legacy page used: forename → name → email. */
export function displayNameOf(p: { forename: string | null; name: string | null; email: string }): string {
  return p.forename || p.name || p.email;
}
