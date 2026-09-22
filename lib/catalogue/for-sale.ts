// lib/catalogue/for-sale.ts
//
// What is for sale, and who each product is for. Both answers were
// previously decided three separate times, differently, by the three
// selling doors — which is diagnosis finding D23, "the sales pages offer
// everything and adapt to nothing".
//
// D23's rulings (Sam, 2026-09-18), built here:
//
//   item 3 — ONE helper for "for sale": kind PAID, status active,
//   price_minor > 0, called by all three doors. Subscribe and Upgrade
//   each carried a byte-identical `paidProductsOf()` that keyed off
//   "not any programme's trial_product_id and price > 0"; Premium Prep
//   used a third rule — the id ending `_2026_PREP`, with no price gate
//   at all, so a zero-price product was selectable and payable there.
//
//   item 2 — which programme a product is FOR is DERIVED, not stored. A
//   product matches a programme when any of its courses is sat by that
//   programme, IGNORING the courses every programme sits. A programme
//   column on products was rejected: a product is a bag of courses and a
//   bag can cross programmes.
//
// ⚠ NOT A 'use server' MODULE. These are pure functions over rows the
// caller has already read, so they may export non-async members —
// AGENTS.md's rule is about Server Action modules.
//
// ⚠ THE CALLER SUPPLIES THE COURSES, and on a public page must read them
// with the service role: `courses_select` is `auth.uid() is not null`,
// so a signed-out visitor reads nothing from that table and every
// product would silently come back as "everyone's". Opening that policy
// is the cleaner fix and needs its own §8 row; unruled as of
// 2026-09-22.

import type { Course, Product } from './types';

/** D23 item 3. The one definition of a product a visitor may buy. */
export function isForSale(product: Product): boolean {
  return (
    product.kind === 'PAID' &&
    product.status === 'active' &&
    Number(product.price_minor) > 0
  );
}

/**
 * D23 item 2. The programmes a product is for, derived from its courses.
 *
 * Returns an EMPTY array to mean "everyone" — a product built only from
 * courses every programme sits (General Paper alone) belongs to no
 * single programme and must show up for all of them. An empty result and
 * "belongs to nobody" would be the same value otherwise, which is the
 * kind of ambiguity that turns into a product nobody can find.
 *
 * "A course every programme sits" is decided from the data, not from the
 * id: a course whose scope covers every programme there is. Hard-coding
 * 'GP' would break the day a second such course is added.
 */
export function programmesOf(
  product: Product,
  courseScope: Map<string, string[]>,
  programmeCount: number,
): string[] {
  const scoped = new Set<string>();
  for (const courseId of product.courses) {
    const scope = courseScope.get(courseId);
    if (!scope || scope.length === 0) continue;
    // The courses everyone sits carry no information about who this
    // product is for, so they are skipped rather than counted.
    if (programmeCount > 0 && scope.length >= programmeCount) continue;
    for (const programme of scope) scoped.add(programme);
  }
  return [...scoped].sort();
}

/** True when this product should appear for `programmeId`. */
export function matchesProgramme(programmes: string[], programmeId: string): boolean {
  // Empty means everyone's (see above), so it matches whatever is asked.
  return programmes.length === 0 || programmes.includes(programmeId);
}

/** Course id → its programme scope, for programmesOf(). */
export function courseScopeMap(courses: Course[]): Map<string, string[]> {
  return new Map(courses.map((c) => [c.course_id, c.program_scope ?? []]));
}

/**
 * D23 item 1: the page ADAPTS, it does not filter. With a programme
 * chosen, its products come first and everything else follows under a
 * divider — nothing is removed, and a student can still buy across
 * programmes. With none chosen, the order is the catalogue's own.
 *
 * Sam, 2026-09-22, on being asked whether narrowing the list would
 * break his own ruling: "everything is on the page but something to
 * narrow the ones you may probably want". This is that — a reorder, not
 * a filter.
 */
export function partitionByProgramme<T>(
  items: T[],
  programmeId: string | null,
  programmesFor: (item: T) => string[],
): { mine: T[]; others: T[] } {
  if (!programmeId) return { mine: items, others: [] };
  const mine: T[] = [];
  const others: T[] = [];
  for (const item of items) {
    if (matchesProgramme(programmesFor(item), programmeId)) mine.push(item);
    else others.push(item);
  }
  return { mine, others };
}
