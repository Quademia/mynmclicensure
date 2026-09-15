// lib/access/index.ts
//
// Public API of lib/access. Pages and Server Actions import from
// '@/lib/access' (AGENTS.md folder convention #8): requireStudent() or
// requireAdmin(), never the internals. The TS gate is the UX; the SQL
// policies in db/rls.sql are the security.

export { requireStudent } from './require-student';
export { requireAdmin } from './require-admin';
export type { AuthGateResult, ServerSupabaseClient } from './types';
