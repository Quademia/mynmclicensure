// app/(app)/admin/announcements/who-sees-it.tsx
//
// The editor page's "Who sees it" (08.18; Sam, 2026-10-19, drawn and
// mocked up): "Every student" until a scope is added; "+ Narrow down"
// lists the scopes not yet used — programme, course, level, subscription
// kind, package, cohort, named students — and each one used is a chip
// that opens its picker again, its ✕ taking it off. The picker drops under
// the row; Done, a click outside or Escape closes it. A student must match
// every scope set (08). The reach line beneath is the database's count of
// who it reaches today (08.12), counted by the page. Only used here.

'use client';

import { useEffect, useRef, useState } from 'react';
import { searchStudentsForScope } from '@/lib/announcements/actions';
import { LEVELS } from '@/lib/announcements/types';
import type { Course, Product, Program } from '@/lib/catalogue/types';
import type { StudentHit } from '@/lib/subscriptions/types';

export type Scopes = {
  programs: string[];
  courses: string[];
  levels: string[];
  subKind: string;
  products: string[];
  cohort: string;
  users: { user_id: string; name: string }[];
};

type ScopeKey = 'programs' | 'courses' | 'levels' | 'subKind' | 'products' | 'cohort' | 'users';

const SCOPE_NAME: Record<ScopeKey, string> = {
  programs: 'Programme',
  courses: 'Course',
  levels: 'Level',
  subKind: 'Subscription',
  products: 'Package',
  cohort: 'Cohort',
  users: 'Named students',
};
const KIND_WORD: Record<string, string> = { PAID: 'Paid only', TRIAL: 'On a trial only', FREE: 'Free only' };

function isSet(s: Scopes, k: ScopeKey): boolean {
  const v = s[k];
  return Array.isArray(v) ? v.length > 0 : Boolean(v);
}

function hitName(u: StudentHit): string {
  return u.name || `${u.forename || ''} ${u.surname || ''}`.trim() || u.email;
}

export function WhoSeesIt({
  value,
  onChange,
  programs,
  courses,
  products,
  cohorts,
  reach,
}: {
  value: Scopes;
  onChange: (next: Scopes) => void;
  programs: Program[];
  courses: Course[];
  products: Product[];
  cohorts: string[];
  /** Who it reaches today; null while it is being counted. */
  reach: number | null;
}) {
  const [open, setOpen] = useState<'menu' | ScopeKey | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // a picker closes on a click outside it or on Escape
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const set = <K extends keyof Scopes>(k: K, v: Scopes[K]) => onChange({ ...value, [k]: v });
  const clear = (k: ScopeKey) => set(k, (k === 'subKind' || k === 'cohort' ? '' : []) as Scopes[typeof k]);
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const courseTitle = (id: string) => courses.find((c) => c.course_id === id)?.title || id;
  const productName = (id: string) => products.find((p) => p.product_id === id)?.name || id;

  function chipLabel(k: ScopeKey): string {
    switch (k) {
      case 'programs':
        return `${SCOPE_NAME.programs}: ${value.programs.join(', ')}`;
      case 'courses':
        return value.courses.length === 1 ? `Course: ${courseTitle(value.courses[0])}` : `Courses: ${value.courses.length}`;
      case 'levels':
        return `Level: ${value.levels.join(', ')}`;
      case 'subKind':
        return KIND_WORD[value.subKind] ?? value.subKind;
      case 'products':
        return value.products.length === 1 ? `Package: ${productName(value.products[0])}` : `Packages: ${value.products.length}`;
      case 'cohort':
        return `Cohort: ${value.cohort}`;
      case 'users':
        return value.users.length === 1 ? `Named: ${value.users[0].name}` : `Named: ${value.users.length} students`;
    }
  }

  const keys = Object.keys(SCOPE_NAME) as ScopeKey[];
  const used = keys.filter((k) => isSet(value, k));
  const unused = keys.filter((k) => !isSet(value, k) && (k !== 'cohort' || cohorts.length > 0));

  return (
    <div className="ann-who" ref={boxRef}>
      <div className="ann-who-chips">
        {used.length ? (
          used.map((k) => (
            <span key={k} className="ann-chip">
              <button type="button" className="ann-chip-open" onClick={() => setOpen(open === k ? null : k)} aria-expanded={open === k}>
                {chipLabel(k)}
              </button>
              <button type="button" className="ann-chip-x" aria-label={`Take off ${SCOPE_NAME[k]}`} onClick={() => clear(k)}>
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="ann-who-all">Every student</span>
        )}
      </div>

      {unused.length ? (
        <div className="ann-who-add">
          <button type="button" className="btn-link" aria-expanded={open === 'menu'} onClick={() => setOpen(open === 'menu' ? null : 'menu')}>
            + Narrow down
          </button>
          {open === 'menu' ? (
            <div className="ann-who-menu" role="menu">
              {unused.map((k) => (
                <button key={k} type="button" role="menuitem" onClick={() => setOpen(k)}>
                  {SCOPE_NAME[k]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {open && open !== 'menu' ? (
        <div className="ann-who-picker" role="group" aria-label={SCOPE_NAME[open]}>
          <p className="ann-who-picker-title">{SCOPE_NAME[open]}</p>
          {open === 'programs' ? (
            <div className="ann-who-ticks">
              {programs.map((p) => (
                <label key={p.program_id}>
                  <input type="checkbox" checked={value.programs.includes(p.program_id)} onChange={() => set('programs', toggleIn(value.programs, p.program_id))} />
                  {p.program_id}
                  <span className="ann-who-sub">{p.program_name}</span>
                </label>
              ))}
            </div>
          ) : null}
          {open === 'courses' ? (
            <div className="ann-who-ticks ann-who-long">
              {courses.map((c) => (
                <label key={c.course_id}>
                  <input type="checkbox" checked={value.courses.includes(c.course_id)} onChange={() => set('courses', toggleIn(value.courses, c.course_id))} />
                  {c.title}
                </label>
              ))}
              <p className="ann-who-hint">Reaches everyone who has held the course, its subscription live or ended.</p>
            </div>
          ) : null}
          {open === 'levels' ? (
            <div className="ann-who-ticks">
              {LEVELS.map((l) => (
                <label key={l}>
                  <input type="checkbox" checked={value.levels.includes(l)} onChange={() => set('levels', toggleIn(value.levels, l))} />
                  {l}
                </label>
              ))}
            </div>
          ) : null}
          {open === 'subKind' ? (
            <div className="ann-who-ticks">
              {(['PAID', 'TRIAL', 'FREE'] as const).map((k) => (
                <label key={k}>
                  <input type="radio" name="ann-subkind" checked={value.subKind === k} onChange={() => set('subKind', k)} />
                  {KIND_WORD[k]}
                </label>
              ))}
            </div>
          ) : null}
          {open === 'products' ? (
            <div className="ann-who-ticks ann-who-long">
              {products.map((p) => (
                <label key={p.product_id}>
                  <input type="checkbox" checked={value.products.includes(p.product_id)} onChange={() => set('products', toggleIn(value.products, p.product_id))} />
                  {p.name}
                </label>
              ))}
              <p className="ann-who-hint">Reaches students whose live subscription is this package.</p>
            </div>
          ) : null}
          {open === 'cohort' ? (
            <select className="ann-input" value={value.cohort} onChange={(e) => set('cohort', e.target.value)} aria-label="Cohort">
              <option value="">Pick a cohort</option>
              {cohorts.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : null}
          {open === 'users' ? <NamedStudents users={value.users} onChange={(users) => set('users', users)} /> : null}
          <div className="ann-who-done">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>Done</button>
          </div>
        </div>
      ) : null}

      <p className="ann-reach" aria-live="polite">
        {reach === null ? 'Counting who it reaches…' : <>This will reach <strong>{reach} student{reach === 1 ? '' : 's'}</strong> today.</>}
      </p>
    </div>
  );
}

function NamedStudents({ users, onChange }: { users: Scopes['users']; onChange: (u: Scopes['users']) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<StudentHit[] | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let stopped = false;
    const t = window.setTimeout(() => {
      searchStudentsForScope(term)
        .then((h) => {
          if (!stopped) setHits(h);
        })
        .catch(() => {
          if (!stopped) setHits([]);
        });
    }, 300);
    return () => {
      stopped = true;
      window.clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="ann-who-named">
      <input
        className="ann-input"
        type="search"
        placeholder="A name or an email"
        aria-label="Search students"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          if (e.target.value.trim().length < 2) setHits(null);
        }}
      />
      {hits ? (
        <ul className="ann-who-hits">
          {hits.length ? (
            hits.map((u) => {
              const already = users.some((s) => s.user_id === u.user_id);
              return (
                <li key={u.user_id}>
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => {
                      onChange([...users, { user_id: u.user_id, name: hitName(u) }]);
                      setQ('');
                      setHits(null);
                    }}
                  >
                    <span className="ann-who-hit-name">{hitName(u)}{already ? ' ✓' : ''}</span>
                    <span className="ann-who-sub">{u.email} · {u.program_id || '—'}</span>
                  </button>
                </li>
              );
            })
          ) : (
            <li className="ann-who-sub">No students found</li>
          )}
        </ul>
      ) : null}
      {users.length ? (
        <div className="ann-who-tags">
          {users.map((u) => (
            <span key={u.user_id} className="ann-tag">
              {u.name}
              <button type="button" aria-label={`Take off ${u.name}`} onClick={() => onChange(users.filter((x) => x.user_id !== u.user_id))}>×</button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
