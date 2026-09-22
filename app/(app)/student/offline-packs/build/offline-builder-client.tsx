// app/(app)/student/offline-packs/build/offline-builder-client.tsx
//
// The script block of legacy student/offline-pack-builder.html (slice
// 13a): the Quiz Builder's five-step wizard with two changes — Step 4
// asks a count and a pack name (the suggested name, "Next" held until
// one is set), and Step 5's "Create pack" opens the confirmation box:
// the rules, the course / questions / allowance pills, "Fresh: N •
// Reused: N", the editable name, Cancel, Create & Download. The pool is
// filtered in the browser over the course's light rows, as legacy did;
// the allowance check, the pick against earlier packs and the save run
// on the server (lib/offline-packs/actions). The last three setups are
// remembered in the browser under legacy's own key.
//
// Only accessible courses arrive in `courses`, so the legacy "Course not
// available" dialog can only appear when a remembered setup names a
// course the student no longer has; it is kept for that case.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { loadBuilderCourse, searchBuilderConcepts } from '@/lib/attempts/actions';
import { CONCEPT_SEARCH_DELAY_MS, type BuilderItem } from '@/lib/attempts/types';
import type { ItemFilterOptions } from '@/lib/bank/types';
import { createOfflinePack, prepareOfflinePack } from '@/lib/offline-packs/actions';
import { allowanceMessageForReason, buildOfflinePackDefaultName, buildOfflinePackDisplayLabel } from '@/lib/offline-packs/labels';
import type { Allowance, PickResult, SelectionMode } from '@/lib/offline-packs/types';

type Course = { course_id: string; title: string };

const STEP_LABELS = [
  'Step 1 of 5 — Course & selection mode',
  'Step 2 of 5 — Topics',
  'Step 3 of 5 — Difficulty & question type',
  'Step 4 of 5 — Count & pack name',
  'Step 5 of 5 — Review & create',
];
const STEP_SHORT = ['Course & mode', 'Topics', 'Difficulty', 'Count & name', 'Review & create'];

const RECENT_KEY = 'qa_offline_builder_recent_v1';
const RECENT_MAX = 3;

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
  packName: string;
  savedAt: string;
};

// The confirmation box's state (legacy #offlineModal and its dataset).
type Modal = {
  open: boolean;
  allowance: Allowance | null;
  allowanceText: string;
  pick: PickResult | null;
  itemIds: string[];
  error: string;
  canCreate: boolean;
  name: string;
};

const MODAL_CLOSED: Modal = { open: false, allowance: null, allowanceText: 'Allowance: —', pick: null, itemIds: [], error: '', canCreate: false, name: '' };

function normaliseArray(arr: unknown): string[] {
  return [...new Set((Array.isArray(arr) ? arr : []).map((x) => String(x || '').trim()).filter(Boolean))];
}

function readRecentSetups(): RecentSetup[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as RecentSetup[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function OfflineBuilderClient({
  courses,
  maxQuestions,
  initialCourseId,
}: {
  courses: Course[];
  maxQuestions: number;
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
  const [packName, setPackName] = useState('');

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

  // ── recent setups, the access dialog, the confirmation box ──
  const [recent, setRecent] = useState<RecentSetup[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [statusOverride, setStatusOverride] = useState('');
  const [modal, setModal] = useState<Modal>(MODAL_CLOSED);

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
  const n = Number(questionCount || 0);
  const selectedN = Math.min(n, poolSize);

  function selectionIsValid(): boolean {
    if (selectionMode === 'topics') return useAllTopics || selectedTopics.length > 0;
    return selectedConcepts.length > 0 || conceptSearch.trim().length > 0;
  }

  // legacy getCountErrorText
  let countErr = '';
  if (!n || n < 1) countErr = 'Enter a valid number of questions.';
  else if (n > maxQuestions) countErr = `Reduce the number to ${maxQuestions} or below.`;
  else if (poolSize > 0 && n > poolSize) countErr = `Your current filters support up to ${poolSize} questions.`;

  const ready = Boolean(courseId) && selectionIsValid() && !countErr && poolSize > 0 && !searching; // legacy buildReady

  const chosenMaintopics = useAllTopics ? options?.maintopics || [] : selectedTopics; // legacy getChosenMaintopics
  const labelMeta = {
    n,
    selection_mode: selectionMode,
    maintopics: chosenMaintopics,
    difficulties: selectedDifficulties,
    concepts: selectedConcepts,
    concept_query: conceptSearch,
  };
  const suggestedName = courseId ? buildOfflinePackDefaultName(labelMeta) : ''; // legacy getSuggestedPackName
  const hasName = packName.trim().length > 0;

  // legacy renderSummary's status box
  let status = 'Choose a course to begin.';
  if (courseId) {
    if (!selectionIsValid()) {
      status = selectionMode === 'topics' ? 'Select at least one topic or use all topics.' : 'Choose at least one concept or type a concept keyword.';
    } else if (searching) {
      status = 'Searching…';
    } else if (poolSize === 0) {
      status = 'No questions match your current filters. Adjust difficulty or question type.';
    } else if (countErr) {
      status = countErr;
    } else {
      status = `Ready — ${selectedN} question${selectedN !== 1 ? 's' : ''} from a pool of ${poolSize}. Click "Create pack" to check your allowance and confirm.`;
    }
  }
  if (statusOverride) status = statusOverride;

  // ── steps ──
  function goStep(target: number) {
    setStep(target);
    if (target === 3) {
      // legacy syncCountPane: clamp if the pool shrank
      setQuestionCount((q) => (q > cap ? cap : q < 1 && cap > 0 ? cap : q));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // legacy clearPackName — called by renderAll (a course, mode, topic-set
  // or concept-search change) and by the difficulty / type toggles.
  const clearName = () => setPackName('');

  // ── counts for the chips (legacy renderTopics / renderConcepts / checks) ──
  const topicCounts: Record<string, number> = {};
  const conceptCounts: Record<string, number> = {};
  for (const r of items) {
    const t = String(r.maintopic || '').trim();
    if (t) topicCounts[t] = (topicCounts[t] || 0) + 1;
    const s = String(r.subtopic || '').trim();
    if (s) conceptCounts[s] = (conceptCounts[s] || 0) + 1;
  }
  const diffCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  for (const r of step2Pool()) {
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

  // ── recent setups (legacy saveRecentSetup: dedupe on every field, keep 3) ──
  function saveRecentSetup(name: string) {
    try {
      const entry: RecentSetup = {
        courseId, selectionMode, useAllTopics: Boolean(useAllTopics), selectedTopics: [...selectedTopics], conceptSearch,
        selectedConcepts: [...selectedConcepts], selectedDifficulties: [...selectedDifficulties],
        selectedQuestionTypes: [...selectedQuestionTypes], questionCount: n, packName: name.trim(), savedAt: new Date().toISOString(),
      };
      const same = (x: RecentSetup) =>
        x.courseId === entry.courseId &&
        x.selectionMode === entry.selectionMode &&
        JSON.stringify(x.selectedTopics || []) === JSON.stringify(entry.selectedTopics) &&
        JSON.stringify(x.selectedConcepts || []) === JSON.stringify(entry.selectedConcepts) &&
        JSON.stringify(x.selectedDifficulties || []) === JSON.stringify(entry.selectedDifficulties) &&
        JSON.stringify(x.selectedQuestionTypes || []) === JSON.stringify(entry.selectedQuestionTypes) &&
        Number(x.questionCount || 0) === entry.questionCount &&
        String(x.packName || '') === entry.packName;
      const rest = readRecentSetups().filter((x) => !same(x));
      window.localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...rest].slice(0, RECENT_MAX)));
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
    setPackName(String(item.packName || ''));
    // legacy: the course loads, then the wizard lands on the last step.
    goStep(4);
  }

  // ── "Create pack" (legacy openOfflineModal) ──
  async function openOfflineModal() {
    if (!poolSize || !n || !ready) return;
    setBusy(true);
    setStatusOverride('Checking your offline allowance…');

    const name = packName.trim() || suggestedName;
    const base: Modal = {
      ...MODAL_CLOSED,
      open: true,
      name,
    };

    const result = await prepareOfflinePack(courseId, pool.map((x) => x.item_id), selectedN);

    if (!result.ok) {
      const allowance = result.allowance;
      const text =
        allowance && allowance.success ? `Allowance: ${allowance.remaining} left of ${allowance.downloads_per_course}` : 'Allowance: blocked';
      setModal({ ...base, allowance, allowanceText: text, error: allowanceMessageForReason(result.reason, allowance), canCreate: false });
      setStatusOverride('Offline pack creation is currently blocked.');
      setBusy(false);
      return;
    }

    const { allowance, pick } = result;
    const text = `Allowance: ${allowance.remaining} left of ${allowance.downloads_per_course}`;
    if (!pick.item_ids.length) {
      setModal({ ...base, allowance, allowanceText: text, error: 'No items were selected for this pack.', canCreate: false });
      setStatusOverride('We could not prepare an offline pack from this selection.');
      setBusy(false);
      return;
    }

    setModal({ ...base, allowance, allowanceText: text, pick, itemIds: pick.item_ids, canCreate: true });
    setStatusOverride(
      pick.reused_selected > 0
        ? `Review the offline pack details. ${pick.unused_selected} fresh question(s) selected and ${pick.reused_selected} reused because the filtered pool is exhausted.`
        : 'Review the offline pack details in the confirmation box.',
    );
    setBusy(false);
  }

  function closeOfflineModal() {
    setModal(MODAL_CLOSED);
  }

  // ── "Create & Download" (legacy createPackFromModal) ──
  async function createPackFromModal() {
    if (!modal.itemIds.length) {
      setModal((m) => ({ ...m, error: 'No items were selected for this pack.' }));
      return;
    }
    const name = modal.name.trim();
    setPackName(name);
    setModal((m) => ({ ...m, canCreate: false, error: '' }));
    setStatusOverride('Creating your offline pack…');

    const displayLabel = buildOfflinePackDisplayLabel(labelMeta);
    const res = await createOfflinePack({
      course_id: courseId,
      item_ids: modal.itemIds,
      pack_name: name,
      selection_mode: selectionMode,
      maintopics: chosenMaintopics,
      subtopics: selectedConcepts,
      difficulties: selectedDifficulties,
      question_types: selectedQuestionTypes,
      concepts: selectedConcepts,
      concept_query: conceptSearch,
      display_label: displayLabel,
    });

    if (!res.ok) {
      setModal((m) => ({ ...m, canCreate: true, error: res.message || allowanceMessageForReason(res.reason, res.allowance) }));
      setStatusOverride('We could not create your offline pack. Please review the message and try again.');
      return;
    }

    saveRecentSetup(name);
    setModal(MODAL_CLOSED);
    setStatusOverride('Offline pack ready. Opening renderer…');
    router.push(`/offline-pack?pack_id=${encodeURIComponent(res.pack_id)}`);
  }

  // legacy: no accessible course → the empty card
  if (courses.length === 0) {
    return (
      <div className="opb">
        <div className="empty-card">
          <h2>No builder access</h2>
          <p>You do not currently have access to any course that can be used in the offline pack builder.</p>
          <a href="/student/dashboard" className="btn-primary">Back to dashboard</a>
        </div>
      </div>
    );
  }

  const summarySelection = selectionMode === 'topics'
    ? useAllTopics ? 'All topics' : selectedTopics.length ? selectedTopics.join(', ') : '—'
    : [...selectedConcepts, conceptSearch].filter(Boolean).join(', ') || '—';
  const summarySetup = `${n} questions · PDF · ${packName.trim() || suggestedName}`;

  return (
    <div className="opb">
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
                  const packLabel = item.packName ? ` · ${item.packName}` : '';
                  const sub = `${item.selectionMode === 'concept' ? 'Concept' : 'Topics'} · ${item.questionCount || '—'}Q${packLabel} · ${dt}`;
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
              <select id="courseSelect" value={courseId} onChange={(e) => { setCourseId(e.target.value); clearName(); }}>
                <option value="">Select a course…</option>
                {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
              </select>
              <span className="hint">Only your active courses are shown.</span>
            </div>
            <div className="field">
              <label>Selection mode</label>
              <div className="segmented">
                <label className={selectionMode === 'topics' ? 'picked' : ''} onClick={() => { setSelectionMode('topics'); clearName(); }}>
                  <input type="radio" name="selectionMode" value="topics" checked={selectionMode === 'topics'} readOnly /> Topics
                </label>
                <label className={selectionMode === 'concept' ? 'picked' : ''} onClick={() => { setSelectionMode('concept'); clearName(); }}>
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
                <input type="checkbox" id="useAllTopics" checked={useAllTopics} onChange={(e) => { setUseAllTopics(e.target.checked); clearName(); }} />
                <label htmlFor="useAllTopics">Use all topics for this course</label>
              </div>
              <div className="topics-toolbar">
                <input type="text" placeholder="Filter topics…" value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} />
                <button type="button" className="btn-lite" onClick={() => { setSelectedTopics((t) => normaliseArray([...t, ...visibleTopics])); clearName(); }}>Select all shown</button>
                <button type="button" className="btn-lite" onClick={() => { setSelectedTopics([]); setUseAllTopics(false); clearName(); }}>Clear</button>
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
                <input type="text" placeholder="e.g. DKA, stroke, shock…" value={conceptSearch} onChange={(e) => { setConceptSearch(e.target.value); clearName(); }} />
                <button type="button" className="btn-lite" onClick={() => { setSelectedConcepts([]); setConceptSearch(''); clearName(); }}>Clear</button>
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
                    <div key={d} className={`check-item${picked ? ' picked' : ''}`} onClick={() => { setSelectedDifficulties((s) => toggleIn(s, d)); clearName(); }}>
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
                    <div key={qt} className={`check-item${picked ? ' picked' : ''}`} onClick={() => { setSelectedQuestionTypes((s) => toggleIn(s, qt)); clearName(); }}>
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

      {/* PANE 3 — count & pack name */}
      {step === 3 ? (
        <div className="pane-card">
          <div className="pane-title">Count &amp; pack name</div>
          <p className="pane-sub">Set how many questions to include, then give your pack a name for easy reference later.</p>
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
          <div className="count-hint">Max {maxQuestions} questions per pack · Pool: {poolSize} available</div>

          <div className="pack-name-section">
            <label htmlFor="packName">Pack name</label>
            <input id="packName" type="text" placeholder="Type a name or tap the suggestion below" value={packName} onChange={(e) => setPackName(e.target.value)} />
            {courseId ? (
              <div className="pack-name-suggestion">
                <span className="hint">Suggestion: </span>
                <button type="button" className="btn-lite" onClick={() => setPackName(suggestedName)}>{suggestedName}</button>
              </div>
            ) : null}
            <div className={`pack-name-status${hasName ? ' ok' : ' missing'}`}>
              {hasName ? '✓ Pack name set.' : 'Enter a pack name or tap the suggestion to continue.'}
            </div>
          </div>

          {countErr ? <div className="error-text">{countErr}</div> : null}

          <div className="nav-bar">
            <button type="button" className="btn-back" onClick={() => goStep(2)}>← Back</button>
            <button type="button" className="btn-next" disabled={!hasName} onClick={() => goStep(4)}>Next →</button>
          </div>
        </div>
      ) : null}

      {/* PANE 4 — review & create */}
      {step === 4 ? (
        <div className="pane-card">
          <div className="pane-title">Review &amp; create</div>
          <p className="pane-sub">Check your setup, then create the offline pack.</p>
          <div className="stats-row">
            <div className="stat-card"><div className="stat-num">{poolSize}</div><div className="stat-lbl">Pool size</div></div>
            <div className="stat-card"><div className="stat-num">{selectedN}</div><div className="stat-lbl">Questions selected</div></div>
            <div className="stat-card"><div className="stat-num">PDF</div><div className="stat-lbl">Format</div></div>
          </div>
          <div className="summary-grid">
            {[
              ['Course', courseTitle(courseId) || '—', 0],
              ['Selection mode', selectionMode === 'concept' ? 'Concept' : 'Topics', 0],
              ['Topics / concept', summarySelection, 1],
              ['Difficulty', selectedDifficulties.length ? selectedDifficulties.join(', ') : 'All', 2],
              ['Question type', selectedQuestionTypes.length ? selectedQuestionTypes.join(', ') : 'All types', 2],
              ['Pack name', summarySetup, 3],
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
            <button type="button" className="btn-create" disabled={!ready || busy} onClick={openOfflineModal}>Create pack →</button>
          </div>
        </div>
      ) : null}

      <BodyPortal>
        <div className="opb-overlay">
          {/* Access dialog (legacy #accessModal) */}
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

          {/* Offline confirmation box (legacy #offlineModal) */}
          <div className={`modal-backdrop${modal.open ? ' show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) closeOfflineModal(); }}>
            <div className="modal-card">
              <h3>Confirm offline pack download</h3>
              <p>This will create a stored offline revision pack for this course. Creation uses your allowance and cannot be undone.</p>

              <div className="rule-box">
                <strong>Rules</strong><br />
                • For offline revision only. Do not share.<br />
                • Pack includes questions, options, and the correct option marked.<br />
                • Your pack will be watermarked with your details.<br />
                • Creating a pack consumes allowance. Deleting later does not restore it.
              </div>

              <div className="kv-pills">
                <span className="badge">Course: {courseTitle(courseId)}</span>
                <span className="badge">Questions: {selectedN}</span>
                <span className="badge">{modal.allowanceText}</span>
                {modal.pick ? <span className="badge">Fresh: {modal.pick.unused_selected} • Reused: {modal.pick.reused_selected}</span> : null}
              </div>

              <div className="field">
                <label htmlFor="modalPackName">Pack name</label>
                <input
                  id="modalPackName"
                  type="text"
                  maxLength={120}
                  placeholder="Enter a pack name or use the default"
                  value={modal.name}
                  onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))}
                />
                <div className="hint">You can change the pack name here before creating it.</div>
              </div>

              <div className="inline-error">{modal.error}</div>

              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={closeOfflineModal}>Cancel</button>
                <button type="button" className="btn-create" disabled={!modal.canCreate} onClick={createPackFromModal}>Create &amp; Download</button>
              </div>
            </div>
          </div>
        </div>
      </BodyPortal>
    </div>
  );
}
