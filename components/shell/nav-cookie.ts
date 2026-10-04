// components/shell/nav-cookie.ts
//
// The shell's two remembered choices, each a cookie read on the server so
// the first paint is already right and nothing jumps on load, and written
// in the browser by the control that changes it. A plain module, so both
// a Server Component and a Client Component can import the names.
//
//   NAV_COOKIE         whether the desktop sidebar is open (10-design-system
//                      DS5): absent or 'open' = open, 'closed' = closed by
//                      the student; written by the hamburger.
//   MENU_FOLD_COOKIE   the student menu's groups folded away (00 The menu,
//                      Sam 2026-10-04: b): the headings' keys, joined by
//                      '.'; absent = every group open; written by a heading.
//                      On this device only — a new device starts all open.

export const NAV_COOKIE = 'nmc_nav';
export const NAV_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const MENU_FOLD_COOKIE = 'nmc_menu_folded';

/** The folded headings' keys from the cookie's value; anything else is dropped. */
export function parseFolded(value: string | undefined): string[] {
  return (value ?? '').split('.').filter((k) => /^[a-z0-9-]{1,40}$/.test(k));
}
