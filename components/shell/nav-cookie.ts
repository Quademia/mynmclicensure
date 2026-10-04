// components/shell/nav-cookie.ts
//
// The one cookie the A3 shell keeps (10-design-system.md DS5): whether
// the desktop sidebar is open. Absent or 'open' means open — the desktop
// default; 'closed' means the student closed it. Read on the server by
// AppShell so the first paint is already right and the page does not
// jump; written in the browser by the hamburger. A plain module, so
// both a Server Component and a Client Component can import the name.

export const NAV_COOKIE = 'nmc_nav';
export const NAV_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
