// app/(app)/admin/messages/students-filters.tsx — the students list's three
// filters (08.2 step 4; Sam, 2026-10-17): a search across every student
// (debounced, so a word is one request), "Waiting for a reply / All", and
// the label. Each change replaces the address and the page reads again on
// the server; "Loading…" shows meanwhile (a tap is never silent).

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MESSAGE_LABELS } from '@/lib/messaging/types';

export function StudentsFiltersBar({ q, view, label }: { q: string; view: 'waiting' | 'all'; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(q);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function go(next: { q?: string; view?: string; label?: string }) {
    const p = new URLSearchParams();
    const nq = next.q ?? q;
    const nv = next.view ?? view;
    const nl = next.label ?? label;
    if (nq) p.set('q', nq);
    if (nv === 'all') p.set('view', 'all');
    if (nl) p.set('label', nl);
    const s = p.toString();
    startTransition(() => router.replace(s ? `/admin/messages?${s}` : '/admin/messages'));
  }

  return (
    <form className="amsg-filters" role="search" method="get" onSubmit={(e) => { e.preventDefault(); go({ q: text.trim() }); }}>
      <input
        type="search"
        className="amsg-search"
        placeholder="Search any student by name or email…"
        aria-label="Search students"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => go({ q: v.trim() }), 400);
        }}
      />
      <select className="amsg-select" aria-label="Show" value={view} onChange={(e) => go({ view: e.target.value })}>
        <option value="waiting">Waiting for a reply</option>
        <option value="all">All</option>
      </select>
      <select className="amsg-select" aria-label="Label" value={label} onChange={(e) => go({ label: e.target.value })}>
        <option value="">All labels</option>
        {MESSAGE_LABELS.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>
      {pending ? <span className="amsg-loading" role="status">Loading…</span> : null}
    </form>
  );
}
