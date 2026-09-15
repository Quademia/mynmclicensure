// lib/access/require-student.ts
//
// guardPage('STUDENT'), as rebuilt. ADMIN passes every student gate, as
// today (rebuild.md §10). The TEACHER admission legacy had here is gone
// with the April split (§9 #12): the roles are STUDENT and ADMIN, and
// anything else goes back through /router, which refuses it.

import { redirect } from 'next/navigation';
import { loadGate } from './internal';
import type { AuthGateResult } from './types';

export async function requireStudent(): Promise<AuthGateResult> {
  const ctx = await loadGate();
  const role = (ctx.profile.role ?? '').toUpperCase();
  if (role !== 'STUDENT' && role !== 'ADMIN') redirect('/router');
  return ctx;
}
