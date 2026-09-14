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

import type { createClient } from '@/lib/supabase/server';
import type { ConfigMap, ConfigRow, Course, Product, Program } from './types';

type Db = Awaited<ReturnType<typeof createClient>>;

export async function getPrograms(db: Db): Promise<Program[]> {
  const { data, error } = await db
    .from('programs')
    .select('program_id, program_name, trial_product_id')
    .order('program_name');
  if (error) {
    console.error('getPrograms:', error);
    return [];
  }
  return (data ?? []) as Program[];
}

/** Active products only, by name. The public pages and the trial grant. */
export async function getProducts(db: Db): Promise<Product[]> {
  const { data, error } = await db.from('products').select('*').eq('status', 'active').order('name');
  if (error) {
    console.error('getProducts:', error);
    return [];
  }
  return (data ?? []) as Product[];
}

/** Every product, archived included — the admin Products page. */
export async function getAllProducts(db: Db): Promise<Product[]> {
  const { data, error } = await db.from('products').select('*').order('name');
  if (error) {
    console.error('getAllProducts:', error);
    return [];
  }
  return (data ?? []) as Product[];
}

/** Active courses only, by title. */
export async function getCourses(db: Db): Promise<Course[]> {
  const { data, error } = await db.from('courses').select('*').eq('status', 'active').order('title');
  if (error) {
    console.error('getCourses:', error);
    return [];
  }
  return (data ?? []) as Course[];
}

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
