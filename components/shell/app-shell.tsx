// components/shell/app-shell.tsx
//
// The frame every authenticated page sits in — legacy's
// <div class="dashboard-wrapper"> with the sidebar on the left and
// <main class="main-content"> on the right. Server Component. Each
// audience layout passes its own sidebar (AGENTS.md folder convention
// #6); the shell knows nothing about audiences.
//
// No footer: no legacy page has one.

export function AppShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="dashboard-wrapper">
      {sidebar}
      <main className="main-content">{children}</main>
    </div>
  );
}
