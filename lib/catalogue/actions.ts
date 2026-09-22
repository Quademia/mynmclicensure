// lib/catalogue/actions.ts
//
// The catalogue writes — the legacy admin pages' direct `db.from(...)`
// inserts and updates (products.html, courses.html, config.html) as
// Server Actions behind the admin gate. Each repeats the page's own
// validation, in its order, with its words. A Supabase error comes back
// as its own message, which is what the legacy pages showed.
//
// ⚠ THE PRODUCT WRITES GO THROUGH THE SERVICE ROLE (§8 S14, 2026-09-22).
// They used to write as the signed-in admin, with the RLS admin policies
// as the floor. S14 took `products`' grants back from the browser roles
// — anon and authenticated hold SELECT and nothing else — so a cookie
// client can no longer write the table at all, and the two policies that
// policed those privileges were dropped with it. The gate is unchanged:
// requireAdmin() still decides who may call these, and it is now the ONLY
// thing that does, which is why it must stay the first line of each.
//
// `product_courses` and `courses` still carry the schema's vanilla-era
// grants and are written by the same service-role client here purely so
// one function does not juggle two clients. Their own grants are
// untouched and wait their turn under ruling 9.
//
// The config writes below are unchanged and still write as the admin.
//
// A 'use server' module exports only async functions; the row types and
// constants live in ./types.

'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ActionResult, CourseStatus, ProductKind, ProductStatus } from './types';

function fail(error: string): ActionResult {
  return { ok: false, error };
}

// ── programmes (courses.html, submitProgramme) ─────────────────────────

export async function saveProgram(input: {
  isNew: boolean;
  programId: string;
  name: string;
}): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const progId = input.programId.trim().toUpperCase();
  const name = input.name.trim();

  if (input.isNew && !progId) return fail('Programme ID is required.');
  if (!name) return fail('Programme name is required.');

  const { error } = input.isNew
    ? await supabase.from('programs').insert({ program_id: progId, program_name: name })
    : await supabase.from('programs').update({ program_name: name }).eq('program_id', progId);
  if (error) return fail(error.message);

  revalidatePath('/admin/courses');
  return { ok: true };
}

// ── courses (courses.html, submitCourse + updateCourseStatus) ──────────

export async function saveCourse(input: {
  isNew: boolean;
  courseId: string;
  title: string;
  status: CourseStatus;
  pageSlug: string;
  programScope: string[];
}): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const courseId = input.courseId.trim().toUpperCase();
  const title = input.title.trim();
  const slug = input.pageSlug.trim() || null;

  if (input.isNew && !courseId) return fail('Course ID is required.');
  if (!title) return fail('Course title is required.');

  const payload = {
    title,
    status: input.status,
    page_slug: slug,
    program_scope: input.programScope.length ? input.programScope : [],
  };
  const { error } = input.isNew
    ? await supabase.from('courses').insert({ ...payload, course_id: courseId })
    : await supabase.from('courses').update(payload).eq('course_id', courseId);
  if (error) return fail(error.message);

  revalidatePath('/admin/courses');
  return { ok: true };
}

export async function setCourseStatus(courseId: string, status: CourseStatus): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('courses').update({ status }).eq('course_id', courseId);
  if (error) return fail(error.message);
  revalidatePath('/admin/courses');
  return { ok: true };
}

// ── products (products.html, submitProduct + confirmArchive/restore) ───

export async function saveProduct(input: {
  isNew: boolean;
  productId: string;
  name: string;
  kind: ProductKind;
  status: ProductStatus;
  /** Full units as typed, e.g. "150.00"; stored as minor units. */
  price: string;
  currency: string;
  duration: string;
  /** Premium Prep marker (§8 S14) — a subset of kind PAID, not a kind. */
  isPremium: boolean;
  courses: string[];
  telegramKeys: string[];
}): Promise<ActionResult> {
  // The gate first and the gate alone: S14 left no RLS policy behind this
  // write, so returning early here is the whole of the protection.
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const productId = input.productId.trim().toUpperCase();
  const name = input.name.trim();
  const priceInput = parseFloat(input.price) || 0;
  const duration = parseInt(input.duration, 10) || null;

  if (input.isNew && !productId) return fail('Product ID is required.');
  if (!name) return fail('Product name is required.');
  if (!duration) return fail('Duration (days) is required.');
  const wanted = [...new Set(input.courses.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (!wanted.length) return fail('Please select at least one course.');

  // The courses must exist before the product is written, so a bad id
  // never leaves a product with half its list; the key on
  // product_courses is the floor beneath this check (02 C1).
  const { data: known, error: coursesError } = await supabase.from('courses').select('course_id').in('course_id', wanted);
  if (coursesError) return fail(coursesError.message);
  const knownIds = new Set((known ?? []).map((r) => r.course_id as string));
  const unknown = wanted.filter((c) => !knownIds.has(c));
  if (unknown.length) return fail(`Unknown course: ${unknown.join(', ')}`);

  const payload = {
    name,
    kind: input.kind,
    status: input.status,
    price_minor: Math.round(priceInput * 100),
    currency: input.currency,
    duration_days: duration,
    is_premium: input.isPremium,
    telegram_group_keys: input.telegramKeys.length ? input.telegramKeys : null,
  };
  const { error } = input.isNew
    ? await supabase.from('products').insert({ ...payload, product_id: productId })
    : await supabase.from('products').update(payload).eq('product_id', productId);
  if (error) return fail(error.message);

  // The link rows follow the ticks: rows no longer ticked go, new ticks
  // are added, the rest stay.
  const { data: current, error: linksError } = await supabase.from('product_courses').select('course_id').eq('product_id', productId);
  if (linksError) return fail(linksError.message);
  const have = new Set((current ?? []).map((r) => r.course_id as string));
  const toDelete = [...have].filter((c) => !wanted.includes(c));
  const toInsert = wanted.filter((c) => !have.has(c));
  if (toDelete.length) {
    const { error: delError } = await supabase.from('product_courses').delete().eq('product_id', productId).in('course_id', toDelete);
    if (delError) return fail(delError.message);
  }
  if (toInsert.length) {
    const { error: insError } = await supabase.from('product_courses').insert(toInsert.map((course_id) => ({ product_id: productId, course_id })));
    if (insError) return fail(insError.message);
  }

  revalidatePath('/admin/products');
  return { ok: true };
}

export async function setProductStatus(productId: string, status: ProductStatus): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await createServiceRoleClient().from('products').update({ status }).eq('product_id', productId);
  if (error) return fail(error.message);
  revalidatePath('/admin/products');
  return { ok: true };
}

// ── config (config.html: saveNewKey, saveRow, deleteRow) ───────────────

export async function addConfigKey(input: {
  key: string;
  value: string;
  description: string;
}): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const key = input.key.trim().toLowerCase();
  const value = input.value.trim();
  const desc = input.description.trim();

  if (!key) return fail('Key is required.');
  if (!value) return fail('Value is required.');
  if (!/^[a-z0-9_]+$/.test(key)) {
    return fail('Key must be lowercase letters, numbers and underscores only.');
  }

  const { error } = await supabase.from('config').insert({
    key,
    value,
    description: desc || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return fail('Failed to add key: ' + error.message);

  revalidatePath('/admin/config');
  return { ok: true };
}

export async function saveConfigRow(input: {
  key: string;
  value: string;
  description: string;
}): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const value = input.value.trim();
  const desc = input.description.trim();

  if (!value) return fail(`Value for "${input.key}" cannot be empty.`);

  const { error } = await supabase
    .from('config')
    .update({ value, description: desc || null, updated_at: new Date().toISOString() })
    .eq('key', input.key);
  if (error) return fail(`Failed to save "${input.key}": ` + error.message);

  revalidatePath('/admin/config');
  return { ok: true };
}

export async function deleteConfigRow(key: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('config').delete().eq('key', key);
  if (error) return fail(`Failed to delete "${key}": ` + error.message);
  revalidatePath('/admin/config');
  return { ok: true };
}
