// lib/auth/email-typo.ts — "Did you mean ama@gmail.com?" (01.17; Sam,
// 2026-10-31). A misspelt email is not noticed at registration: the
// account works until the student needs the email — a forgotten password
// — and then the reset goes nowhere and the student messages the admin.
// This catches the common slips (gmial.com, gmail.con, yaho.com, the
// ending left off) as the student leaves the box. It never changes the
// address by itself and never refuses one: a school or work address far
// from every big provider gets no suggestion. Confirming the email for
// real is the six-digit code (01.8, with 01.13).
//
// Plain code, no server: the register card runs it in the browser.

const KNOWN_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'mail.com',
  'gmx.com',
  'protonmail.com',
  'proton.me',
];

/** The address with its domain corrected, or null when nothing looks off. */
export function suggestEmail(raw: string): string | null {
  const email = raw.trim();
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (KNOWN_DOMAINS.includes(domain)) return null;

  // "ama@gmail": the ending left off.
  const bare = KNOWN_DOMAINS.find((d) => d.split('.')[0] === domain);
  if (bare) return `${local}@${bare}`;

  // Otherwise the nearest big provider, if it is one or two slips away.
  let best: string | null = null;
  let bestDistance = 3;
  for (const known of KNOWN_DOMAINS) {
    const d = distance(domain, known);
    if (d < bestDistance) {
      best = known;
      bestDistance = d;
    }
  }
  return best ? `${local}@${best}` : null;
}

/** How many letters to add, drop or change to turn one word into the other. */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const change = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + change);
    }
    previous = current;
  }
  return previous[b.length];
}
