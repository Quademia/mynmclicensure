// components/shell/page-header.tsx
//
// The row at the top of every legacy page (23 of them carry it):
// <div class="top-nav"> — the page title and subtitle on the left, the
// signed-in name and the Sign out button on the right. Server
// Component. Sign out is a form POST to /logout, so no link prefetch
// can ever sign someone out.

export function PageHeader({
  title,
  subtitle,
  userName,
}: {
  title: string;
  subtitle?: React.ReactNode;
  /** forename → name → email, as every legacy page filled #userName. */
  userName: string;
}) {
  return (
    <div className="top-nav">
      <div className="page-header page-header-inline">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="user-menu">
        <span className="user-name">{userName}</span>
        <form method="post" action="/logout">
          <button type="submit" className="logout-btn">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

/** The display name every legacy page used: forename → name → email. */
export function displayNameOf(p: { forename: string | null; name: string | null; email: string }): string {
  return p.forename || p.name || p.email;
}
