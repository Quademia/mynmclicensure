// lib/access/require-admin.ts
//
// guardPage('ADMIN'), as rebuilt: ADMIN only. A student who types an
// /admin address goes back through /router to their own dashboard, as
// legacy did.

import { redirect } from 'next/navigation';
import { loadGate } from './internal';
import type { AuthGateResult } from './types';

export async function requireAdmin(): Promise<AuthGateResult> {
  const ctx = await loadGate();
  if ((ctx.profile.role ?? '').toUpperCase() !== 'ADMIN') redirect('/router');
  return ctx;
}
