// app/(app)/student/quiz-builder/quiz-builder-client.tsx
//
// The script block of legacy student/quiz-builder.html (slice 6a): the
// five-step wizard — course and selection mode; topics (or a concept
// search over subtopics, stems, rationales and main topics); difficulty
// and question type with live counts; count and mode; review and build.
// The pool is filtered in the browser over the course's light rows, as
// legacy did; the build shuffles the pool, takes the first N, spawns the
// attempt through a Server Action and opens the runner. The last five
// setups are remembered in the browser (legacy's localStorage key).
//
// Only accessible courses arrive in `courses`, so the legacy "Course not
// available" dialog can only appear when a remembered setup names a
// course the student no longer has; it is kept for that case.
//
// The runner for a timed build is slice 6b: until then, picking Timed
// opens a page that does not exist yet (rebuild.md §12).

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { loadBuilderCourse, searchBuilderConcepts, spawnBuilderAttempt } from '@/lib/attempts/actions';
import { CONCEPT_SEARCH_DELAY_MS, type BuilderItem } from '@/lib/attempts/types';
import type { ItemFilterOptions } from '@/lib/bank/types';

type Course = { course_id: string; title: string };
type Mode = 'instant' | 'timed';
type SelectionMode = 'topics' | 'concept';

const STEP_LABELS = [
  'Step 1 of 5 — Course & selection mode',
  'Step 2 of 5 — Topics',
  'Step 3 of 5 — Difficulty & question type',
  'Step 4 of 5 — Count & mode',
  'Step 5 of 5 — Review & build',
];
const STEP_SHORT = ['Course & mode', 'Topics', 'Difficulty', 'Count & mode', 'Review & build'];

const RECENT_KEY = 'qa_builder_recent_v1';
const RECENT_MAX = 5;

type RecentSetup = {
  courseId: string;
  selectionMode: SelectionMode;
  useAllTopics: boolean;
  selectedTopics: string[];
  conceptSearch: string;
  selectedConcepts: string[];
  selectedDifficulties: string[];
  selectedQuestionTypes: string[];
  questionCount: number;
  mode: Mode;
  savedAt: number;
};

function normaliseArray(arr: unknown): string[] {
  return [...new Set((Array.isArray(arr) ? arr : []).map((x) => String(x || '').trim()).filter(Boolean))];
}

function readRecentSetups(): RecentSetup[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentSetup[]) : [];
  } catch {
    return [];
  }
}

// legacy shuffleArray (Math.random Fisher–Yates) — the pick is random per build.
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The page's own label builder (it overrides the API's; legacy passed
// display_label explicitly, so this is the one students saw).
function buildBuilderDisplayLabel(o: {
  selection_mode: SelectionMode;
  maintopics: string[];
  difficulties: string[];
  concepts: string[];
  concept_query: string;
  n: number;
}): string {
  const parts: string[] = [];
  if (o.selection_mode === 'topics') {
    parts.push(o.maintopics.length ? o.maintopics.slice(0, 3).join(', ') : 'All topics');
  } else {
    const terms = [...o.concepts, o.concept_query].filter(Boolean);
    parts.push(terms.length ? terms.slice(0, 3).join(', ') : 'Concept search');
  }
  if (o.difficulties.length) parts.push(o.difficulties.join('/'));
  parts.push(`${o.n}Q`);
  return parts.join(' · ');
}

export function QuizBuilderClient({
  courses,
  maxQuestions,
  minutesPerQuestion,
  initialCourseId,
}: {
  courses: Course[];
  maxQuestions: number;
  minutesPerQuestion: number;
  initialCourseId: string;
}) {
  const router = useRouter();

  // ── wizard state (legacy `state`) ──
  const [step, setStep] = useState(0);
  const [courseId, setCourseId] = useState(() => initialCourseId || (courses.length === 1 ? courses[0].course_id : ''));
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('topics');
  const [useAllTopics, setUseAllTopics] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicSearch, setTopicSearch] = useState('');
  const [conceptSearch, setConceptSearch] = useState('');
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [mode, setMode] = useState<Mode>('instant');

  // ── the course's rows (legacy CURRENT_ITEMS / CURRENT_FILTER_OPTIONS) ──
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [options, setOptions] = useState<ItemFilterOptions | null>(null);
  const [loadedCourse, setLoadedCourse] = useState('');
  const [loading, setLoading] = useState(false);

  // ── the concept keyword's matching ids (08 B2) ──
  // The rows above no longer carry stems or rationales, so a free-text
  // keyword is matched by the server and answered with ids. null means
  // "nothing searched yet"; the previous result stays on screen while a
  // new one is in flight, so the pool does not blink between keystrokes.
  const [conceptIds, setConceptIds] = useState<Set<string> | null>(null);
  const [searching, setSearching] = useState(false);

  // ── recent setups, the access dialog, the build ──
  const [recent, setRecent] = useState<RecentSetup[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState<string>('');
  const [building, setBuilding] = useState(false);
  const [statusOverride, setStatusOverride] = useState('');

  useEffect(() => {
    const id = window.setTimeout(() => setRecent(readRecentSetups()), 0);
    return () => window.clearTimeout(id);
  }, []);

  // legacy handleCourseChange: load the course's rows, drop selections
  // the course does not have, clamp the count.
  const loadCourse = useCallback(
    async (id: string) => {
      setConceptIds(null);
      if (!id) {
        setItems([]);
        setOptions(null);
        setLoadedCourse('');
        return;
      }
      setLoading(true);
      const result = await loadBuilderCourse(id);
      setLoading(false);
      if (!result.ok) {
        setItems([]);
        setOptions(null);
        setLoadedCourse('');
        setAccessDenied(id);
        return;
      }
      const opts = result.options;
      setItems(result.items);
      setOptions(opts);
      setLoadedCourse(id);
      setSelectedTopics((t) => t.filter((x) => opts.maintopics.includes(x)));
      setSelectedConcepts((t) => t.filter((x) => opts.subtopics.includes(x)));
      setSelectedDifficulties((t) => t.filter((x) => opts.difficulties.includes(x)));
      setSelectedQuestionTypes((t) => t.filter((x) => opts.question_types.includes(x)));
      const cap = Math.min(result.items.length || maxQuestions, maxQuestions);
      setQuestionCount((n) => (!n || n > cap ? cap : n));
    },
    [maxQuestions],
  );

  // The course's rows follow the course pick (and the initial course from
  // the URL or a single accessible course).
  useEffect(() => {
    if (!courseId || courseId === loadedCourse) return;
    const id = window.setTimeout(() => void loadCourse(courseId), 0);
    return () => window.clearTimeout(id);
  }, [courseId, loadedCourse, loadCourse]);

  const courseTitle = (id: string) => courses.find((c) => c.course_id === id)?.title || id;

  // The keyword only does work when concept mode is on and no concept
  // chip is picked — a chip wins, as it always did.
  const conceptQuery = selectionMode === 'concept' && selectedConcepts.length === 0 ? conceptSearch.trim() : '';

  // The keyword's ids, a moment after the typing stops (08 B2). The same
  // four fields legacy matched on — subtopic, main topic, stem,
  // rationale — are matched in the database now; a reply that arrives
  // after the query changed again is dropped.
  useEffect(() => {
    if (!courseId || courseId !== loadedCourse) return;
    if (!conceptQuery) {
      const clear = window.setTimeout(() => {
        setConceptIds(null);
        setSearching(false);
      }, 0);
      return () => window.clearTimeout(clear);
    }

    let cancelled = false;
    const id = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        const result = await searchBuilderConcepts(courseId, conceptQuery);
        if (cancelled) return;
        setConceptIds(new Set(result.ok ? result.itemIds : []));
        setSearching(false);
      })();
    }, CONCEPT_SEARCH_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [courseId, loadedCourse, conceptQuery]);

  // ── the pools (legacy getStep2FilteredPool / getFilteredPool) ──
  function step2Pool(): BuilderItem[] {
    let pool = items;
    if (selectionMode === 'topics') {
      if (!useAllTopics && selectedTopics.length) pool = pool.filter((x) => selectedTopics.includes(x.maintopic || ''));
    } else if (selectedConcepts.length) {
      pool = pool.filter((x) => selectedConcepts.includes(x.subtopic || ''));
    } else if (conceptQuery) {
      pool = conceptIds ? pool.filter((x) => conceptIds.has(x.item_id)) : [];
    }
    return pool;
  }

  function filteredPool(): BuilderItem[] {
    let pool = step2Pool();
    if (selectedDifficulties.length) pool = pool.filter((x) => selectedDifficulties.includes(x.difficulty || ''));
    if (selectedQuestionTypes.length) pool = pool.filter((x) => selectedQuestionTypes.includes(x.question_type || ''));
    return pool;
  }

  const pool = filteredPool();
  const poolSize = pool.length;
  const cap = Math.min(poolSize || maxQuestions, maxQuestions);
  const selectedN = Math.min(questionCount, poolSize);
  const estTime = Math.ceil(selectedN * minutesPerQuestion);

  function selectionIsValid(): boolean {
    if (selectionMode === 'topics') return useAllTopics || selectedTopics.length > 0;
    return selectedConcepts.length > 0 || conceptSearch.trim().length > 0;
  }

  const ready = Boolean(courseId) && selectionIsValid() && questionCount > 0 && poolSize > 0 && !searching;

  // legacy renderSummary's status box
  let status = 'Choose a course to begin.';
  if (courseId) {
    if (!selectionIsValid()) {
      status = selectionMode === 'topics' ? 'Select at least one topic or use all topics.' : 'Choose at least one concept or type a concept keyword.';
    } else if (searching) {
      status = 'Searching…';
    } else if (poolSize === 0) {
      status = 'No questions match your current filters. Adjust difficulty or question type.';
    } else if (questionCount < 1) {
      status = 'Set a question count greater than 0.';
    } else {
      status = `Ready — ${selectedN} question${selectedN !== 1 ? 's' : ''} from a pool of ${poolSize}.`;
    }
  }
  if (statusOverride) status = statusOverride;

  // ── steps ──
  function goStep(n: number) {
    setStep(n);
    if (n === 3) {
      // legacy syncCountPane: clamp if the pool shrank
      setQuestionCount((q) => (q > cap ? cap : q < 1 && cap > 0 ? cap : q));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── counts for the chips (legacy renderTopics / renderConcepts / checks) ──
  const topicCounts: Record<string, number> = {};
  for (const r of items) {
    const key = String(r.maintopic || '').trim();
    if (key) topicCounts[key] = (topicCounts[key] || 0) + 1;
  }
  const conceptCounts: Record<string, number> = {};
  for (const r of items) {
    const key = String(r.subtopic || '').trim();
    if (key) conceptCounts[key] = (conceptCounts[key] || 0) + 1;
  }
  const s2 = step2Pool();
  const diffCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  for (const r of s2) {
    const d = String(r.difficulty || '').trim();
    if (d) diffCounts[d] = (diffCounts[d] || 0) + 1;
    const t = String(r.question_type || '').trim();
    if (t) typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  const topicFilter = topicSearch.toLowerCase();
  const visibleTopics = (options?.maintopics || []).filter((t) => !topicFilter || t.toLowerCase().includes(topicFilter));
  // The chip list narrows on the typed text too — over the subtopic
  // names the wizard already holds, so it stays instant whether or not a
  // keyword search is in flight.
  const conceptChipFilter = conceptSearch.toLowerCase();
  const visibleConcepts = (options?.subtopics || []).filter((s) => !conceptChipFilter || s.toLowerCase().includes(conceptChipFilter));
  const difficultyOptions = options?.difficulties.length ? options.difficulties : ['Easy', 'Moderate', 'Hard'];
  const typeOptions = options?.question_types.length ? options.question_types : ['MCQ', 'True/False', 'SATA'];

  function toggleIn(list: string[], v: string): string[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  // ── recent setups ──
  function saveRecentSetup() {
    try {
      const entry: RecentSetup = {
        courseId, selectionMode, useAllTopics, selectedTopics: [...selectedTopics], conceptSearch,
        selectedConcepts: [...selectedConcepts], selectedDifficulties: [...selectedDifficulties],
        selectedQuestionTypes: [...selectedQuestionTypes], questionCount, mode, savedAt: Date.now(),
      };
      const existing = readRecentSetups().filter((x) => !(x.courseId === entry.courseId && x.selectionMode === entry.selectionMode));
      window.localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...existing].slice(0, RECENT_MAX)));
    } catch {
      /* browser storage unavailable — as legacy, ignore */
    }
  }

  function applyRecentSetup(item: RecentSetup) {
    setCourseId(item.courseId || '');
    setSelectionMode(item.selectionMode === 'concept' ? 'concept' : 'topics');
    setUseAllTopics(Boolean(item.useAllTopics));
    setSelectedTopics(normaliseArray(item.selectedTopics));
    setConceptSearch(String(item.conceptSearch || ''));
    setSelectedConcepts(normaliseArray(item.selectedConcepts));
    setSelectedDifficulties(normaliseArray(item.selectedDifficulties));
    setSelectedQuestionTypes(normaliseArray(item.selectedQuestionTypes));
    setQuestionCount(Math.min(Number(item.questionCount || maxQuestions), maxQuestions));
    // legacy: the course loads, then the wizard lands on the last step.
    goStep(4);
  }

  // ── build (legacy buildBtn click) ──
  async function build() {
    const n = Number(questionCount || 0);
    const chosen = shuffleArray(pool).slice(0, n).map((x) => x.item_id);
    if (!chosen.length || !ready) return;

    setBuilding(true);
    setStatusOverride('Building your quiz…');

    const maintopics = useAllTopics ? options?.maintopics || [] : selectedTopics;
    const displayLabel = buildBuilderDisplayLabel({
      selection_mode: selectionMode,
      maintopics,
      difficulties: selectedDifficulties,
      concepts: selectedConcepts,
      concept_query: conceptSearch,
      n,
    });

    const result = await spawnBuilderAttempt(courseId, chosen, mode, {
      n,
      selection_mode: selectionMode,
      maintopics,
      subtopics: selectedConcepts,
      difficulties: selectedDifficulties,
      question_types: selectedQuestionTypes,
      concepts: selectedConcepts,
      concept_query: conceptSearch,
      display_label: displayLabel,
      duration_min_override: Math.ceil(n * minutesPerQuestion),
    });

    if (!result.ok) {
      setStatusOverride('We could not build your quiz. Please try again.');
      setBuilding(false);
      return;
    }

    saveRecentSetup();
    setStatusOverride('Quiz ready. Opening runner…');
    router.push(`/runner/${mode}?attempt_id=${encodeURIComponent(result.attemptId)}`);
  }

  // legacy: no accessible course → the empty card
  if (courses.length === 0) {
    return (
      <div className="qbld">
        <div className="empty-card">
          <h2>No builder access</h2>
          <p>You do not currently have access to any course that can be used in the quiz builder.</p>
          <a href="/student/dashboard" className="btn-primary">Back to dashboard</a>
        </div>
      </div>
    );
  }

  const modeHint = mode === 'timed'
    ? `Timed mode will give you ${Math.ceil(questionCount * minutesPerQuestion)} minute(s).`
    : 'Instant mode shows feedback after each answer.';

  const summarySelection = selectionMode === 'topics'
    ? useAllTopics ? 'All topics' : selectedTopics.length ? selectedTopics.join(', ') : '—'
    : [...selectedConcepts, conceptSearch].filter(Boolean).join(', ') || '—';

  return (
    <div className="qbld">
      {/* Progress bar */}
      <div className="prog-block">
        <div className="prog-bar">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={i < 4 ? 'prog-step' : 'prog-step last'}>
              <div className={`prog-circle${i < step ? ' done' : i === step ? ' active' : ''}`} onClick={() => goStep(i)}>
                {i < step ? '✓' : String(i + 1)}
              </div>
              {i < 4 ? <div className={`prog-line${i < step ? ' done' : ''}`} /> : null}
            </div>
          ))}
        </div>
        <div className="prog-labels">
          {STEP_SHORT.map((label, i) => (
            <div key={label} className={`prog-lbl${i < step ? ' done' : i === step ? ' active' : ''}`} onClick={() => goStep(i)}>{label}</div>
          ))}
        </div>
        <div className="prog-step-label"><strong>{STEP_LABELS[step]}</strong></div>
      </div>

      {/* PANE 0 — course & selection mode */}
      {step === 0 ? (
        <div className="pane-card">
          <div className="pane-title">Course &amp; selection mode</div>
          <p className="pane-sub">Choose a course from your active subscriptions, then decide how you want to select questions.</p>

          {recent.length ? (
            <div className="recent-collapse">
              <div className="recent-toggle" onClick={() => setRecentOpen((v) => !v)}>
                <span className="recent-toggle-lbl">Recent setups <span className="recent-count">— {recent.length} saved</span></span>
                <span className={`recent-toggle-caret${recentOpen ? ' open' : ''}`}>▾</span>
              </div>
              <div className={`recent-body${recentOpen ? ' open' : ''}`}>
                {recent.map((item, idx) => {
                  const dt = item.savedAt
                    ? new Date(item.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : 'Saved';
                  const sub = `${item.selectionMode === 'concept' ? 'Concept' : 'Topics'} · ${item.questionCount || '—'}Q · ${item.mode === 'timed' ? 'Timed' : 'Instant'} · ${dt}`;
                  return (
                    <div key={idx} className="recent-item">
                      <div className="recent-main">
                        <div className="recent-title">{courseTitle(item.courseId)}</div>
                        <div className="recent-sub">{sub}</div>
                      </div>
                      <button type="button" className="btn-lite" onClick={() => applyRecentSetup(item)}>Use this</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="field-grid">
            <div className="field">
              <label htmlFor="courseSelect">Course</label>
              <select id="courseSelect" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Select a course…</option>
                {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
              </select>
              <span className="hint">Only your active courses are shown.</span>
            </div>
            <div className="field">
              <label>Selection mode</label>
              <div className="segmented">
                <label className={selectionMode === 'topics' ? 'picked' : ''} onClick={() => setSelectionMode('topics')}>
                  <input type="radio" name="selectionMode" value="topics" checked={selectionMode === 'topics'} readOnly /> Topics
                </label>
                <label className={selectionMode === 'concept' ? 'picked' : ''} onClick={() => setSelectionMode('concept')}>
                  <input type="radio" name="selectionMode" value="concept" checked={selectionMode === 'concept'} readOnly /> Concept
                </label>
              </div>
              <span className="hint">{selectionMode === 'concept' ? 'Concept = search subtopics and keyword matching.' : 'Topics = choose from main topic groups.'}</span>
            </div>
          </div>
          <div className="nav-bar">
            <span />
            <button type="button" className="btn-next" onClick={() => goStep(1)}>Next →</button>
          </div>
        </div>
      ) : null}

      {/* PANE 1 — topics / concept */}
      {step === 1 ? (
        <div className="pane-card">
          <div className="pane-title">{selectionMode === 'concept' ? 'Concept search' : 'Topics'}</div>
          <p className="pane-sub">{selectionMode === 'concept' ? 'Search for a concept keyword and select matching subtopics.' : 'Select one or more topics to draw questions from.'}</p>

          {selectionMode === 'topics' ? (
            <div>
              <div className="use-all-row">
                <input type="checkbox" id="useAllTopics" checked={useAllTopics} onChange={(e) => setUseAllTopics(e.target.checked)} />
                <label htmlFor="useAllTopics">Use all topics for this course</label>
              </div>
              <div className="topics-toolbar">
                <input type="text" placeholder="Filter topics…" value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} />
                <button type="button" className="btn-lite" onClick={() => setSelectedTopics((t) => normaliseArray([...t, ...visibleTopics]))}>Select all shown</button>
                <button type="button" className="btn-lite" onClick={() => { setSelectedTopics([]); setUseAllTopics(false); }}>Clear</button>
              </div>
              <div className="topics-box">
                {loading ? (
                  <div className="topics-empty">Loading…</div>
                ) : visibleTopics.length === 0 ? (
                  <div className="topics-empty">No topics found.</div>
                ) : (
                  visibleTopics.map((t) => {
                    const picked = useAllTopics || selectedTopics.includes(t);
                    return (
                      <div key={t} className={`topic-chip${picked ? ' picked' : ''}`} onClick={() => { if (!useAllTopics) setSelectedTopics((s) => toggleIn(s, t)); }}>
                        <div className="dot" />{t}<span className="topic-chip-count">{topicCounts[t] || 0}</span>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="chips-row">
                {useAllTopics ? (
                  <span className="badge">All topics</span>
                ) : (
                  selectedTopics.map((t) => (
                    <span key={t} className="badge">{t} <button type="button" className="badge-remove" onClick={() => setSelectedTopics((s) => s.filter((x) => x !== t))}>×</button></span>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="concept-search-row">
                <input type="text" placeholder="e.g. DKA, stroke, shock…" value={conceptSearch} onChange={(e) => setConceptSearch(e.target.value)} />
                <button type="button" className="btn-lite" onClick={() => { setSelectedConcepts([]); setConceptSearch(''); }}>Clear</button>
              </div>
              <span className="hint block">Searches across subtopic, stem, rationale and maintopic.</span>
              <div className="concepts-box">
                {!visibleConcepts.length && !conceptChipFilter ? (
                  <div className="concepts-empty">Type a keyword to search concepts.</div>
                ) : !visibleConcepts.length ? (
                  <div className="concepts-empty">No matching concepts.</div>
                ) : (
                  visibleConcepts.map((s) => {
                    const picked = selectedConcepts.includes(s);
                    return (
                      <div key={s} className={`concept-item${picked ? ' picked' : ''}`} onClick={() => setSelectedConcepts((c) => toggleIn(c, s))}>
                        <span>{s}</span><span className="concept-item-count">{conceptCounts[s] || 0}</span>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="chips-row">
                {selectedConcepts.map((s) => (
                  <span key={s} className="badge">{s} <button type="button" className="badge-remove" onClick={() => setSelectedConcepts((c) => c.filter((x) => x !== s))}>×</button></span>
                ))}
              </div>
            </div>
          )}
          <div className="nav-bar">
            <button type="button" className="btn-back" onClick={() => goStep(0)}>← Back</button>
            <button type="button" className="btn-next" onClick={() => goStep(2)}>Next →</button>
          </div>
        </div>
      ) : null}

      {/* PANE 2 — difficulty & question type */}
      {step === 2 ? (
        <div className="pane-card">
          <div className="pane-title">Difficulty &amp; question type</div>
          <p className="pane-sub">Narrow your pool by difficulty and question format. Leave blank to include all.</p>
          <div className="field-grid">
            <div className="field">
              <label>Difficulty</label>
              <div className="checks-grid">
                {difficultyOptions.map((d) => {
                  const picked = selectedDifficulties.includes(d);
                  return (
                    <div key={d} className={`check-item${picked ? ' picked' : ''}`} onClick={() => setSelectedDifficulties((s) => toggleIn(s, d))}>
                      <input type="checkbox" checked={picked} readOnly /><label>{d}</label><span className="check-item-count">{diffCounts[d] || 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="field">
              <label>Question type</label>
              <div className="checks-grid">
                {typeOptions.map((qt) => {
                  const picked = selectedQuestionTypes.includes(qt);
                  return (
                    <div key={qt} className={`check-item${picked ? ' picked' : ''}`} onClick={() => setSelectedQuestionTypes((s) => toggleIn(s, qt))}>
                      <input type="checkbox" checked={picked} readOnly /><label>{qt}</label><span className="check-item-count">{typeCounts[qt] || 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="pool-bar">
            <span className="pool-bar-lbl">Questions matching your filters</span>
            <span className="pool-bar-count">{poolSize} available</span>
          </div>
          <div className="nav-bar">
            <button type="button" className="btn-back" onClick={() => goStep(1)}>← Back</button>
            <button type="button" className="btn-next" onClick={() => goStep(3)}>Next →</button>
          </div>
        </div>
      ) : null}

      {/* PANE 3 — count & mode */}
      {step === 3 ? (
        <div className="pane-card">
          <div className="pane-title">Count &amp; mode</div>
          <p className="pane-sub">How many questions, and how do you want to take the quiz?</p>
          <div className="count-display-row">
            <div>
              <div className="count-big">{questionCount || '—'}</div>
              <div className="count-sub">questions</div>
            </div>
            <div className="count-controls">
              <input
                type="range"
                min={1}
                max={cap}
                step={1}
                value={questionCount || 1}
                onChange={(e) => setQuestionCount(Math.min(Math.max(Number(e.target.value), 1), cap))}
              />
              <div className="count-input-row">
                <input
                  type="number"
                  min={1}
                  max={cap}
                  placeholder="Enter number"
                  value={questionCount || ''}
                  onChange={(e) => setQuestionCount(Math.min(Math.max(Number(e.target.value) || 0, 0), cap))}
                />
                <span className="hint">or use the slider</span>
              </div>
            </div>
          </div>
          <div className="count-hint">Max {maxQuestions} questions · Pool: {poolSize} available · Estimated {Math.ceil(questionCount * minutesPerQuestion)} min</div>
          <label className="mode-label">Mode</label>
          <div className="mode-grid">
            <div className={`mode-card${mode === 'instant' ? ' picked' : ''}`} onClick={() => setMode('instant')}>
              <div className="mode-card-title">Instant feedback</div>
              <div className="mode-card-desc">See whether each answer is correct as you go. Best for learning and revision.</div>
              <span className="mode-badge badge-instant">Practice</span>
            </div>
            <div className={`mode-card${mode === 'timed' ? ' picked' : ''}`} onClick={() => setMode('timed')}>
              <div className="mode-card-title">Timed exam</div>
              <div className="mode-card-desc">No feedback during the quiz. Review everything at the end. Simulates the real exam.</div>
              <span className="mode-badge badge-timed">Exam-style</span>
            </div>
          </div>
          <div className="mode-hint">{modeHint}</div>
          <div className="nav-bar">
            <button type="button" className="btn-back" onClick={() => goStep(2)}>← Back</button>
            <button type="button" className="btn-next" onClick={() => goStep(4)}>Next →</button>
          </div>
        </div>
      ) : null}

      {/* PANE 4 — review & build */}
      {step === 4 ? (
        <div className="pane-card">
          <div className="pane-title">Review &amp; build</div>
          <p className="pane-sub">Check your setup, then build the quiz.</p>
          <div className="stats-row">
            <div className="stat-card"><div className="stat-num">{poolSize}</div><div className="stat-lbl">Pool size</div></div>
            <div className="stat-card"><div className="stat-num">{selectedN}</div><div className="stat-lbl">Questions selected</div></div>
            <div className="stat-card"><div className="stat-num">{estTime} min</div><div className="stat-lbl">Estimated time</div></div>
          </div>
          <div className="summary-grid">
            {[
              ['Course', courseTitle(courseId) || '—', 0],
              ['Selection mode', selectionMode === 'concept' ? 'Concept' : 'Topics', 0],
              ['Topics / concept', summarySelection, 1],
              ['Difficulty', selectedDifficulties.length ? selectedDifficulties.join(', ') : 'All', 2],
              ['Question type', selectedQuestionTypes.length ? selectedQuestionTypes.join(', ') : 'All types', 2],
              ['Mode', mode === 'timed' ? 'Timed exam' : 'Instant feedback', 3],
            ].map(([label, value, target]) => (
              <div key={String(label)} className="summary-item">
                <div className="summary-head">
                  <div className="summary-label">{label}</div>
                  <button type="button" className="review-edit" onClick={() => goStep(Number(target))}>Edit</button>
                </div>
                <div className="summary-value">{value}</div>
              </div>
            ))}
          </div>
          <div className="status-box">{status}</div>
          <div className="nav-bar">
            <button type="button" className="btn-back" onClick={() => goStep(3)}>← Back</button>
            <button type="button" className="btn-build" disabled={!ready || building} onClick={build}>Build quiz →</button>
          </div>
        </div>
      ) : null}

      {/* Access dialog (legacy) */}
      <BodyPortal>
        <div className="qbld-overlay">
          <div className={`modal-backdrop${accessDenied ? ' show' : ''}`}>
            <div className="modal-card">
              <h3>Course not available</h3>
              <p>You do not have an active subscription for {courseTitle(accessDenied)}.</p>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => { setAccessDenied(''); setCourseId(''); }}>Close</button>
                <a className="btn-primary" href={`/student/course/${encodeURIComponent(accessDenied)}`}>View course</a>
              </div>
            </div>
          </div>
        </div>
      </BodyPortal>
    </div>
  );
}
