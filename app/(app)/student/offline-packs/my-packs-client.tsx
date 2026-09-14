// app/(app)/student/offline-packs/my-packs-client.tsx
//
// The script block of legacy student/my-offline-packs.html (slice 13b):
// the hero, the filters card (search, course, status, sort; Refresh,
// Clear Filters), the summary card (four counts), the saved-packs grid
// twenty-four at a time with Load More, and the empty card when the
// student has no pack at all. The filters and the counts work over the
// loaded rows, as legacy's did; the course dropdown lists the titles
// seen so far. Open / Download opens the renderer for an active pack
// (greyed otherwise); Build Similar opens the builder on the course.
//
// The Archived and Deleted status options are legacy's; no legacy code
// ever sets a pack to either (rebuild.md §12 slice 13, carried).
//
// Dates render after hydration (the `mounted` read), so the browser's
// clock formats them, as legacy's did.

'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { loadOfflinePacksPage } from '@/lib/offline-packs/actions';
import { formatPackDate } from '@/lib/offline-packs/labels';
import type { OfflinePackListRow, OfflinePackPage } from '@/lib/offline-packs/types';

type SortValue = 'newest' | 'oldest' | 'name_asc' | 'name_desc';

const subscribeNever = () => () => {};

function normalizeStatus(v: string | null | undefined): string {
  return String(v || '').trim().toLowerCase() || 'active';
}

function packStatusClass(status: string | null | undefined): 'active' | 'archived' | 'deleted' {
  const s = normalizeStatus(status);
  return s === 'active' || s === 'archived' || s === 'deleted' ? s : 'archived';
}

function getCourseName(item: OfflinePackListRow): string {
  return String(item.course_title || item.course_id || '—').trim();
}

export function MyPacksClient({ initialPage }: { initialPage: OfflinePackPage }) {
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  // legacy `state`
  const [allItems, setAllItems] = useState<OfflinePackListRow[]>(initialPage.ok ? initialPage.items : []);
  const [totalKnown, setTotalKnown] = useState(initialPage.ok ? initialPage.total : 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialPage.ok ? '' : initialPage.message || 'Could not load your offline packs.');
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<SortValue>('newest');

  const offset = allItems.length;
  const hasMore = offset < totalKnown;

  // legacy loadNextPage(reset)
  async function loadNextPage(reset: boolean) {
    if (loading) return;
    setLoading(true);
    setError('');
    const res = await loadOfflinePacksPage(reset ? 0 : offset);
    if (!res.ok) {
      setError(res.message || 'Could not load your offline packs.');
      setLoading(false);
      return;
    }
    setTotalKnown(res.total);
    setAllItems((prev) => (reset ? res.items : prev.concat(res.items)));
    setLoading(false);
  }

  // legacy refillCourseFilter — the titles seen so far, sorted
  const courseNames = [...new Set(allItems.map(getCourseName).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  // legacy getFilteredItems
  let filtered = [...allItems];
  const q = search.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((item) =>
      [item.pack_name, item.display_label, item.course_title, item.course_id, item.pack_id].join(' ').toLowerCase().includes(q),
    );
  }
  if (course) filtered = filtered.filter((item) => getCourseName(item) === course);
  if (status) filtered = filtered.filter((item) => normalizeStatus(item.status) === status);
  filtered.sort((a, b) => {
    if (sort === 'oldest') return String(a.created_utc || '').localeCompare(String(b.created_utc || ''));
    if (sort === 'name_asc') return String(a.pack_name || '').localeCompare(String(b.pack_name || ''));
    if (sort === 'name_desc') return String(b.pack_name || '').localeCompare(String(a.pack_name || ''));
    return String(b.created_utc || '').localeCompare(String(a.created_utc || ''));
  });

  // legacy updateSummary
  const activeCount = allItems.filter((item) => normalizeStatus(item.status) === 'active').length;
  const displayedQuestions = filtered.reduce((sum, item) => sum + Number(item.question_count || 0), 0);
  const filterBits: string[] = [];
  if (search) filterBits.push(`search: ${search}`);
  if (course) filterBits.push(`course: ${course}`);
  if (status) filterBits.push(`status: ${status}`);
  const filterPill = filterBits.length ? filterBits.join(' • ') : 'Showing all packs';

  function clearFilters() {
    setSearch('');
    setCourse('');
    setStatus('');
    setSort('newest');
  }

  function openPack(packId: string) {
    router.push(`/offline-pack?pack_id=${encodeURIComponent(packId)}`);
  }

  // legacy renderGrid: no pack at all → the empty card alone
  if (!allItems.length) {
    return (
      <div className="opk">
        {error ? <div className="error-box">{error}</div> : null}
        <div className="empty-card">
          <h2>No Offline Packs Yet</h2>
          <p>You have not created any offline packs yet. Build one from a course, then it will appear here for future re-download.</p>
          <div className="footer-actions">
            <a className="btn-primary" href="/student/offline-packs/build">Create Your First Pack</a>
            <a className="btn-ghost" href="/student/dashboard">Back to Dashboard</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="opk">
      {error ? <div className="error-box">{error}</div> : null}

      <section className="hero-card">
        <div>
          <h1>Your Saved Downloads</h1>
          <p>Every offline pack here is a stored snapshot. Open any active pack to print it again or save it as PDF from the renderer page.</p>
        </div>
        <div className="hero-actions">
          <a className="btn-ghost" href="/student/dashboard">Back to Dashboard</a>
          <a className="btn-primary" href="/student/offline-packs/build">Create New Pack</a>
        </div>
      </section>

      <section className="filters-card">
        <div className="filters-head">
          <div>
            <h2 className="section-title">Filters</h2>
            <p className="section-sub">Narrow your saved packs by course, status, search, or sort order.</p>
          </div>
          <span className="step-pill">{filterPill}</span>
        </div>
        <div className="filters-grid">
          <div className="field">
            <label htmlFor="searchInput">Search</label>
            <input id="searchInput" type="text" placeholder="Search by pack name or course" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="courseFilter">Course</label>
            <select id="courseFilter" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">All courses</option>
              {courseNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="statusFilter">Status</label>
            <select id="statusFilter" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="sortSelect">Sort</label>
            <select id="sortSelect" value={sort} onChange={(e) => setSort(e.target.value as SortValue)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name_asc">Name A → Z</option>
              <option value="name_desc">Name Z → A</option>
            </select>
          </div>
        </div>
        <div className="footer-actions start">
          <button className="btn-lite" type="button" disabled={loading} onClick={() => void loadNextPage(true)}>Refresh</button>
          <button className="btn-ghost" type="button" onClick={clearFilters}>Clear Filters</button>
        </div>
      </section>

      <section className="stats-card">
        <div className="stats-head">
          <div>
            <h2 className="section-title">Summary</h2>
            <p className="section-sub">A quick view of your saved offline pack history.</p>
          </div>
          <span className="step-pill">{allItems.length} total</span>
        </div>
        <div className="stats-grid">
          <div className="stat-box"><div className="stat-label">Total loaded</div><div className="stat-value">{allItems.length}</div></div>
          <div className="stat-box"><div className="stat-label">Active</div><div className="stat-value">{activeCount}</div></div>
          <div className="stat-box"><div className="stat-label">Displayed now</div><div className="stat-value">{filtered.length}</div></div>
          <div className="stat-box"><div className="stat-label">Questions across displayed packs</div><div className="stat-value">{displayedQuestions}</div></div>
        </div>
      </section>

      <section className="grid-card">
        <div className="grid-head">
          <div>
            <h2 className="section-title">Saved Packs</h2>
            <p className="section-sub">Open any active pack in the renderer. Inactive packs stay visible for history.</p>
          </div>
          <span className="step-pill">{filtered.length} shown</span>
        </div>

        {!filtered.length ? (
          <div className="muted-box">No saved pack matches the current filters. Clear the filters or load more results.</div>
        ) : null}

        <div className="packs-grid">
          {filtered.map((item) => {
            const st = packStatusClass(item.status);
            const active = st === 'active';
            const displayLabel = String(item.display_label || '').trim();
            return (
              <article key={item.pack_id} className={`pack-card${active ? '' : ' inactive'}`}>
                <span className={`pack-status ${st}`}>{st}</span>
                <div className="pack-course">{getCourseName(item)}</div>
                <div className="pack-title">{item.pack_name || 'Offline Pack'}</div>
                <div className="pack-meta">
                  <div className="meta-row"><strong>Questions:</strong>{Number(item.question_count || 0)}</div>
                  <div className="meta-row"><strong>Created:</strong>{mounted ? formatPackDate(item.created_utc) : '—'}</div>
                  <div className="meta-row"><strong>Pack ID:</strong>{item.pack_id || '—'}</div>
                </div>
                <div className="tag-row">
                  <span className="tag">{st}</span>
                  {displayLabel ? <span className="tag">{displayLabel}</span> : null}
                </div>
                <div className="pack-actions">
                  <button className="btn-primary" type="button" disabled={!active} onClick={() => openPack(item.pack_id)}>Open / Download</button>
                  <a className="btn-ghost" href={`/student/offline-packs/build?course=${encodeURIComponent(item.course_id || '')}`}>Build Similar</a>
                </div>
              </article>
            );
          })}
        </div>

        <div className="load-more-wrap">
          {hasMore || loading ? (
            <button className="btn-ghost" type="button" disabled={loading} onClick={() => void loadNextPage(false)}>
              {loading ? 'Loading…' : hasMore ? 'Load More' : 'No More Packs'}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
