// lib/supabase/read-all.ts
//
// AGENTS.md rule 10 (diagnosis D52, 2026-09-26). The API hands back at
// most 1,000 rows a request and gives no error when it stops: the list
// simply arrives short. A `.limit()` above 1,000 is cut to 1,000, and so
// is a database function that returns a set (both probed on dev). So a
// read of a whole table, a whole course, or every row of a kind across
// students comes through here, 1,000 at a time until a short batch comes
// back.
//
// `page(from, to)` builds the SAME query each time, fresh, and ends it
// with `.range(from, to)`. The query must be ordered on a unique column
// (or end its order on one — the table's key), or a row can slip between
// two batches or arrive twice. The result has the client's own shape,
// `{ data, error }`, so a call site keeps its error handling.
//
// This is the safety net, not the best shape: a page that shows a list
// should page it for the screen, and a number should be a count. Each
// D52 place takes that shape when its surface is next worked on.

/** The API's row cap: a batch shorter than this is the last one. */
export const READ_BATCH = 1000;

type Batch<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export type ReadAllResult<T> = { data: T[]; error: null } | { data: null; error: { message: string } };

/**
 * Every row of a read, past the API's 1,000-row cap. `max` stops early
 * at that many rows (a read that must not run away, as the Attempts
 * page's window); the caller compares the length with it to say so.
 */
export async function readAll<T>(
  page: (from: number, to: number) => Batch<T>,
  { max }: { max?: number } = {},
): Promise<ReadAllResult<T>> {
  const rows: T[] = [];
  for (let from = 0; max === undefined || from < max; from += READ_BATCH) {
    const size = max === undefined ? READ_BATCH : Math.min(READ_BATCH, max - from);
    const { data, error } = await page(from, from + size - 1);
    if (error) return { data: null, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < size) break;
  }
  return { data: rows, error: null };
}

/**
 * A long id list in slices. An `.in()` filter rides in the request's
 * address, which has a length limit of its own; a list that `readAll`
 * made longer than 1,000 must be sent in slices (200 ids, as
 * `existingItemIds` in lib/bank/queries.ts always has).
 */
export function slices<T>(list: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
