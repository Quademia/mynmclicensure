// lib/auth/is-navigation.ts — is this "error" Next moving the page?
//
// A Server Action that calls redirect() does not return: Next settles the
// call by rejecting it with a redirect signal while it moves (AGENTS.md).
// A page that catches a dropped connection asks this first, so a sign-in,
// a registration or a reset that WORKED is not reported as a failure.
// Used by the sign-in pages' cards (01.12, 01.15).

import { unstable_rethrow } from 'next/navigation';

export function isNavigation(err: unknown): boolean {
  try {
    unstable_rethrow(err);
    return false;
  } catch {
    return true;
  }
}
