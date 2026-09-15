// lib/users/types.ts
//
// The admin Users page and dashboard (slice 14a): the list row (legacy
// getUsers' eleven columns), the filters, the drawer's read (legacy
// getUserById — the row, the active subscription with its product, the
// full history — plus the school joined, which legacy looked up from a
// map it loaded on init), and the dashboard's four counts.
//
// Constants and types live here, not in the 'use server' module
// (AGENTS.md workaround).

import type { Profile } from '@/lib/auth/profile';

export const USERS_PAGE_SIZE = 50;

// The role filter's options. Teacher left with the April split (§9 #12).
export const USER_ROLE_OPTIONS = ['STUDENT', 'ADMIN'] as const;

export type UserFilters = {
  search: string;
  role: string;
  programId: string;
};

export const EMPTY_USER_FILTERS: UserFilters = { search: '', role: '', programId: '' };

export type UserListRow = {
  user_id: string;
  name: string | null;
  forename: string | null;
  surname: string | null;
  email: string;
  role: string;
  program_id: string | null;
  active: boolean;
  created_utc: string | null;
  level: string | null;
  cohort: string | null;
};

export type UsersPage = { users: UserListRow[]; total: number };

export type DrawerSubscription = {
  subscription_id: string;
  product_id: string;
  start_utc: string;
  expires_utc: string;
  status: string;
  source: string;
  products: { name: string; kind: string } | null;
};

export type UserDetail = Profile & {
  schools: { name: string; region: string } | null;
  activeSubscription: DrawerSubscription | null;
  subscriptionHistory: DrawerSubscription[];
};

export type DashboardCounts = {
  totalUsers: number;
  students: number;
  activeSubscriptions: number;
  expiringSoon: number;
};

export type ActionResult = { ok: true } | { ok: false; error: string };
