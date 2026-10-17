// app/(app)/student/learning-history/stamp.ts — a mark of each server
// render of the page. The list keys on it, so a refresh after Abandon
// starts the list again from the fresh first page rather than keeping the
// rows it had. The clock is read here, never in render (AGENTS.md).

export function renderStamp(): number {
  return Date.now();
}
