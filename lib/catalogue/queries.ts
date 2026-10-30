// lib/catalogue/queries.ts
//
// The catalogue reads, transcribed one for one from legacy
// js/mynmclicensure-api.js: getPrograms, getProducts (active only),
// getAllProducts, getCourses (active only), getAllCourses, getConfig.
// Each takes the caller's per-request client (a page's gate client, or
// the anon server client on a public page) and, as legacy, fails open:
// an error is logged and an empty result returned.
//
// RLS is the floor, not the filter (AGENTS.md): the "active only" reads
// name their filter here.

import { cache } from 'react';
import { createServiceRoleClient, type createClient } from '@/lib/supabase/server';
import type { ConfigMap, ConfigRow, Course, Product, Program } from './types';

type Db = Awaited<ReturnType<typeof createClient>>;

// Every programme, open or not — the admin's pages and a student's own
// programme name read this.
export async function getPrograms(db: Db): Promise<Program[]> {
  const { data, error } = await db
    .from('programs')
    .select('program_id, program_name, trial_product_id, is_open')
    .order('program_name');
  if (error) {
    console.error('getPrograms:', error);
    return [];
  }
  return (data ?? []) as Program[];
}

// The programmes Open to the public (02 C5a, Sam 2026-10-04) — what a
// visitor may see and choose: the home page, registration, the shop,
// checkout. A closed one is being prepared; the admin can still grant
// its packages for testing.
export async function getOpenPrograms(db: Db): Promise<Program[]> {
  const { data, error } = await db
    .from('programs')
    .select('program_id, program_name, trial_product_id, is_open')
    .eq('is_open', true)
    .order('program_name');
  if (error) {
    console.error('getOpenPrograms:', error);
    return [];
  }
  return (data ?? []) as Program[];
}

/** The open programmes and what their trial gives, for the public pages' words. */
export type PublicProgrammes = {
  programs: { program_id: string; program_name: string }[];
  /** The trial's length in days — "Start your 14-day trial" — from the programmes' trial packages; null if none reads. */
  trialDays: number | null;
  /** Builder quizzes on the trial ("3 Quiz Builder quizzes"); null when unlimited or unread. */
  trialQuizzes: number | null;
};

// The home page and the public footer (03 F3, 2026-10-30) each say "Start
// your 14-day trial", so the length is read, not typed: an admin who
// changes the trial changes every page. One request — the programme's
// trial package embedded — and cache() so the page and its footer share
// it within a render (no argument, so the key is the same for both; the
// server's own client, as the public pages read courses, since there is
// nothing personal in it). The shortest trial when programmes differ.
export const getPublicProgrammes = cache(async function getPublicProgrammes(): Promise<PublicProgrammes> {
  const { data, error } = await createServiceRoleClient()
    .from('programs')
    .select('program_id, program_name, trial:products!programs_trial_product_id_fkey ( duration_days, allow_builder_quizzes )')
    .eq('is_open', true)
    .order('program_name');
  if (error) {
    console.error('getPublicProgrammes:', error);
    return { programs: [], trialDays: null, trialQuizzes: null };
  }
  type Row = { program_id: string; program_name: string; trial: { duration_days: number | null; allow_builder_quizzes: number | null } | null };
  const rows = (data ?? []) as unknown as Row[];
  const days = rows.map((r) => r.trial?.duration_days).filter((n): n is number => typeof n === 'number' && n > 0);
  const quizzes = rows.map((r) => r.trial?.allow_builder_quizzes).filter((n): n is number => typeof n === 'number');
  return {
    programs: rows.map((r) => ({ program_id: r.program_id, program_name: r.program_name })),
    trialDays: days.length ? Math.min(...days) : null,
    trialQuizzes: quizzes.length ? Math.min(...quizzes) : null,
  };
});

// A product's courses are product_courses rows (02 C1); the select embeds
// them and the row is flattened to `courses`, sorted by id.
const PRODUCT_SELECT = '*, product_courses ( course_id )';

// ⚠ THE PUBLIC LIST NAMES ITS COLUMNS (D19 / D23 item 5, 2026-09-22).
// `*` sent `telegram_group_keys` to every signed-out visitor of
// /subscribe and /premium-prep — all 32 products' worth, readable in the
// page source without an account. Those keys are the join keys for the
// Premium Prep study groups, and they are the ONE thing a premium
// product has that Full Access does not (§8 S14). The Telegram gate is
// not built yet (BUILD_LIST item 17), so nothing could be joined with
// them today; the day it ships, `*` would have handed the benefit away
// for free. The admin's getAllProducts below keeps `*` — the Products
// page edits the keys, and it is behind requireAdmin().
const PUBLIC_PRODUCT_SELECT =
  'product_id, name, kind, status, price_minor, currency, duration_days, is_premium, product_courses ( course_id )';

type ProductRow = Omit<Product, 'courses'> & { product_courses: { course_id: string }[] | null };

function flattenProducts(rows: ProductRow[]): Product[] {
  return rows.map(({ product_courses, ...rest }) => ({
    ...rest,
    courses: (product_courses ?? []).map((r) => r.course_id).sort(),
  }));
}

/**
 * Active products only, by name. The public pages and the trial grant.
 * Columns named, not `*` — see PUBLIC_PRODUCT_SELECT above. The returned
 * rows therefore carry no `telegram_group_keys`; the one reader of that
 * field is the admin Products page, which uses getAllProducts.
 */
export async function getProducts(db: Db): Promise<Product[]> {
  const { data, error } = await db.from('products').select(PUBLIC_PRODUCT_SELECT).eq('status', 'active').order('name');
  if (error) {
    console.error('getProducts:', error);
    return [];
  }
  return flattenProducts((data ?? []) as unknown as ProductRow[]);
}

/** Every product, archived included — the admin Products page. */
export async function getAllProducts(db: Db): Promise<Product[]> {
  const { data, error } = await db.from('products').select(PRODUCT_SELECT).order('name');
  if (error) {
    console.error('getAllProducts:', error);
    return [];
  }
  return flattenProducts((data ?? []) as unknown as ProductRow[]);
}

/**
 * Active courses only, by title. Wrapped in cache() so a request reads
 * once however many callers (the dashboard, the courses pages and the
 * shop ask). The columns are named, so a narrower
 * grant later cannot break it (AGENTS.md, select('*') under a cookie
 * client).
 */
export const getCourses = cache(async function getCourses(db: Db): Promise<Course[]> {
  const { data, error } = await db
    .from('courses')
    .select('course_id, title, program_scope, status, page_slug')
    .eq('status', 'active')
    .order('title');
  if (error) {
    console.error('getCourses:', error);
    return [];
  }
  return (data ?? []) as Course[];
});

/** One course by id, any status — legacy getCourseById (the course page, 7d). */
export async function getCourseById(db: Db, courseId: string): Promise<Course | null> {
  const { data, error } = await db.from('courses').select('*').eq('course_id', courseId).maybeSingle();
  if (error) {
    console.error('getCourseById:', error);
    return null;
  }
  return (data as Course | null) ?? null;
}

/** Every course, every status — the admin Courses page. */
export async function getAllCourses(db: Db): Promise<Course[]> {
  const { data, error } = await db.from('courses').select('*').order('title');
  if (error) {
    console.error('getAllCourses:', error);
    return [];
  }
  return (data ?? []) as Course[];
}

/** The config rows, by key — the admin Config page. */
export async function getConfigRows(db: Db): Promise<ConfigRow[]> {
  const { data, error } = await db.from('config').select('*').order('key');
  if (error) {
    console.error('getConfigRows:', error);
    return [];
  }
  return (data ?? []) as ConfigRow[];
}

/**
 * config as a plain map, as legacy getConfig(): a value that parses as a
 * number is a number. The runner, builder and offline pack code read this.
 */
export async function getConfig(db: Db): Promise<ConfigMap> {
  const { data, error } = await db.from('config').select('key, value');
  if (error) {
    console.error('getConfig:', error);
    return {};
  }
  const result: ConfigMap = {};
  for (const row of (data ?? []) as { key: string; value: string }[]) {
    const num = Number(row.value);
    result[row.key] = Number.isNaN(num) ? row.value : num;
  }
  return result;
}
