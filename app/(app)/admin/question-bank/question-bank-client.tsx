// app/(app)/admin/question-bank/question-bank-client.tsx
//
// The script block of legacy admin/question-bank.html (slice 4a): the
// course picker, the five filters applied in the browser over the loaded
// course, the card list with "Load more" (25 at a time), the edit / new
// panel in the right-hand column with the option area that changes by
// type, the SATA checkboxes, the rationale-image attach and remove, Save
// and Delete. Messages are toasts (UI convention #1) where legacy used
// the inline .alert boxes; Delete keeps the browser's own confirm box
// with legacy's words (Sam, 2026-09-11: dialogs stay as legacy has them).
//
// The CSV importer is the modal beside this file (slice 4b).
//
// Two legacy quirks carried as they are (logged, not in §9): opening a
// question runs onTypeChange() after the fields are filled, so the
// shuffle box follows the TYPE (unchecked for TF, checked otherwise), not
// the stored value; and the message after a save is always "Question
// saved." — the "created" branch is unreachable in the legacy script.
//
// 08 B4 (2026-09-26): a question is a draft until published. The editor
// gains the Published switch, the Free tick, a Level, a Source and Tags
// (suggested from the tags in use, snapped to their spelling); the list
// gains Status, Free and Level filters, a Draft badge, Publish /
// Unpublish per card and "Publish all shown". Unpublishing asks first
// when live quizzes name the question, since each will refuse to start.

'use client';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Toast } from '@/lib/toast/toast';
import { CsvImportModal } from './csv-import-modal';
import { countQuizzesNaming, deleteQuestion, loadCourseItems, saveQuestion, setPublished } from '@/lib/bank/actions';
import {
  BLOOM_LEVELS,
  DIFFICULTIES,
  OPTION_LETTERS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  RATIONALE_IMAGE_MAX_BYTES,
  normaliseTags,
  type Item,
  type OptionLetter,
  type QuestionType,
} from '@/lib/bank/types';
import type { Course } from '@/lib/catalogue/types';
import { Icon } from '@/components/shell/icons';
import { KindChip, ScaleChip, QUESTION_TYPE_HUE, DIFFICULTY_STEP } from '@/components/shell/chips';

type Msg = { text: string; tone: 'error' | 'success' } | null;

const PAGE_SIZE = 25;

type Form = {
  itemId: string;
  type: QuestionType;
  stem: string;
  options: Record<OptionLetter, string>;
  feedback: Record<OptionLetter, string>;
  correctMcq: string;
  correctSata: string[];
  rationale: string;
  subject: string;
  maintopic: string;
  subtopic: string;
  difficulty: string;
  marks: string;
  batchId: string;
  shuffle: boolean;
  // ── 08 B4 ──
  bloomLevel: string;
  isPublished: boolean;
  isFreeSample: boolean;
  questionRef: string;
  tags: string[];
};

const blankLetters = (): Record<OptionLetter, string> =>
  ({ a: '', b: '', c: '', d: '', e: '', f: '' });

const EMPTY_FORM: Form = {
  itemId: '',
  type: 'MCQ',
  stem: '',
  options: blankLetters(),
  feedback: blankLetters(),
  correctMcq: 'a',
  correctSata: [],
  rationale: '',
  subject: '',
  maintopic: '',
  subtopic: '',
  difficulty: '',
  marks: '1',
  batchId: '',
  shuffle: true,
  bloomLevel: '',
  // a new question is a draft (08 B4, draft by default)
  isPublished: false,
  isFreeSample: false,
  questionRef: '',
  tags: [],
};


function correctLetters(item: Item): string[] {
  return item.question_type === 'SATA'
    ? (item.correct || '').split(',').map((s) => s.trim().toLowerCase())
    : [(item.correct || '').trim().toLowerCase()];
}

/** "1 quiz will…" / "3 quizzes will…" — the unpublish warning's words. */
function quizzesWillRefuse(n: number): string {
  return `${n} ${n === 1 ? 'quiz' : 'quizzes'} will refuse to start until this question is published again.`;
}

export function QuestionBankClient({ courses }: { courses: Course[] }) {
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  // ── the course and its rows ──
  const [courseId, setCourseId] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [maintopics, setMaintopics] = useState<string[]>([]);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [tagsInUse, setTagsInUse] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // ── filters (applied in the browser, as legacy) ──
  const [fMaintopic, setFMaintopic] = useState('');
  const [fDifficulty, setFDifficulty] = useState('');
  const [fType, setFType] = useState('');
  const [fBatch, setFBatch] = useState('');
  // 08 B4: '' | 'published' | 'draft'; '' | 'free' | 'not-free'; '' | a level | 'none'
  const [fStatus, setFStatus] = useState('');
  const [fFree, setFFree] = useState('');
  const [fLevel, setFLevel] = useState('');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  // legacy onSearchInput: a 220 ms timer before the filter runs.
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedKeyword(keyword), 220);
    return () => window.clearTimeout(id);
  }, [keyword]);

  // ── the panel ──
  const [panelOpen, setPanelOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgLocalPreview, setImgLocalPreview] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Publish / Unpublish: the card whose switch is in flight ──
  const [busyId, setBusyId] = useState<string | null>(null);

  // DS4: the app's own dialog for every question the page asks.
  const [confirm, confirmDialog] = useConfirm();

  // ── the CSV modal (slice 4b) ──
  const [csvOpen, setCsvOpen] = useState(false);
  function openCsvModal() {
    if (!courseId) return setMsg({ text: 'Please select a course first.', tone: 'error' });
    setCsvOpen(true);
  }

  async function fetchCourse(id: string): Promise<Item[]> {
    setLoading(true);
    const result = await loadCourseItems(id);
    setLoading(false);
    if (!result.ok) {
      setItems([]);
      setMaintopics([]);
      setBatchIds([]);
      setMsg({ text: result.error, tone: 'error' });
      return [];
    }
    setItems(result.items);
    setMaintopics(result.maintopics);
    setBatchIds(result.batchIds);
    setTagsInUse(result.tagsInUse);
    return result.items;
  }

  function resetFilters() {
    setFMaintopic('');
    setFDifficulty('');
    setFType('');
    setFBatch('');
    setFStatus('');
    setFFree('');
    setFLevel('');
    setKeyword('');
    setDebouncedKeyword('');
    setLimit(PAGE_SIZE);
  }

  // legacy onCourseChange: close the panel, clear the filters but keep
  // the course, then load.
  async function onCourseChange(id: string) {
    setCourseId(id);
    closePanel();
    resetFilters();
    if (!id) {
      setItems([]);
      setMaintopics([]);
      setBatchIds([]);
      return;
    }
    await fetchCourse(id);
  }

  // legacy clearFilters(): resets the course too.
  function clearFilters() {
    setCourseId('');
    setItems([]);
    setMaintopics([]);
    setBatchIds([]);
    resetFilters();
  }

  const kw = debouncedKeyword.toLowerCase().trim();
  const filtered = items.filter((item) => {
    if (fMaintopic && item.maintopic !== fMaintopic) return false;
    if (fDifficulty && item.difficulty !== fDifficulty) return false;
    if (fType && item.question_type !== fType) return false;
    if (fBatch && item.batch_id !== fBatch) return false;
    if (fStatus === 'published' && !item.is_published) return false;
    if (fStatus === 'draft' && item.is_published) return false;
    if (fFree === 'free' && !item.is_free_sample) return false;
    if (fFree === 'not-free' && item.is_free_sample) return false;
    if (fLevel === 'none' && item.bloom_level) return false;
    if (fLevel && fLevel !== 'none' && item.bloom_level !== fLevel) return false;
    if (kw) {
      const searchable = [
        item.stem, item.option_a, item.option_b, item.option_c,
        item.option_d, item.option_e, item.option_f,
        item.rationale, item.maintopic, item.subtopic, item.subject,
        item.question_ref, ...(item.tags ?? []),
      ].map((v) => (v || '').toLowerCase()).join(' ');
      if (!searchable.includes(kw)) return false;
    }
    return true;
  });
  const shown = filtered.slice(0, limit);
  const shownDrafts = filtered.filter((i) => !i.is_published);
  const currentItem = currentId ? items.find((i) => i.item_id === currentId) ?? null : null;

  // ── the panel: open for edit / new, type change, close ──

  // legacy onTypeChange: TF shows A and B only and picks "no shuffle";
  // the others show A–F and shuffle.
  function applyType(f: Form, type: QuestionType): Form {
    return { ...f, type, shuffle: type !== 'TF' };
  }

  function openEdit(item: Item) {
    setIsNew(false);
    setCurrentId(item.item_id);
    setImgFile(null);
    setImgLocalPreview('');
    setImgUrl(item.rationale_img || '');

    const options = blankLetters();
    const feedback = blankLetters();
    for (const l of OPTION_LETTERS) {
      options[l] = item[`option_${l}`] || '';
      feedback[l] = item[`fb_${l}`] || '';
    }
    const letters = correctLetters(item);
    const filled: Form = {
      itemId: item.item_id,
      type: item.question_type || 'MCQ',
      stem: item.stem || '',
      options,
      feedback,
      correctMcq: item.question_type === 'SATA' ? 'a' : letters[0] || 'a',
      correctSata: item.question_type === 'SATA' ? letters : [],
      rationale: item.rationale || '',
      subject: item.subject || '',
      maintopic: item.maintopic || '',
      subtopic: item.subtopic || '',
      difficulty: item.difficulty || '',
      marks: String(item.marks || 1),
      batchId: item.batch_id || '',
      shuffle: item.shuffle_options !== false,
      bloomLevel: item.bloom_level || '',
      isPublished: item.is_published,
      isFreeSample: item.is_free_sample,
      questionRef: item.question_ref || '',
      tags: item.tags ?? [],
    };
    setTagDraft('');
    setForm(applyType(filled, filled.type));
    setPanelOpen(true);
  }

  function openNew() {
    if (!courseId) return setMsg({ text: 'Please select a course first.', tone: 'error' });
    setIsNew(true);
    setCurrentId(null);
    setImgFile(null);
    setImgLocalPreview('');
    setImgUrl('');
    const prefix = courseId.replace(/_/g, '') + '_';
    setTagDraft('');
    setForm(applyType({ ...EMPTY_FORM, options: blankLetters(), feedback: blankLetters(), tags: [], itemId: prefix + Date.now().toString().slice(-6) }, 'MCQ'));
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setCurrentId(null);
    setIsNew(false);
  }

  function setField<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleSata(letter: string) {
    setForm((f) => ({
      ...f,
      correctSata: f.correctSata.includes(letter) ? f.correctSata.filter((l) => l !== letter) : [...f.correctSata, letter],
    }));
  }

  // ── tags (08 B4) ──
  // Typed text becomes tags at Enter, a comma or a semicolon, or at Save.
  // Each is snapped to the spelling already in use, matched without case,
  // so "Pain" where "pain" exists stays one tag; the save does the same.
  function withTags(current: string[], raw: string): string[] {
    const typed = raw.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    const snapped = typed.map((t) => tagsInUse.find((u) => u.toLowerCase() === t.toLowerCase()) ?? t);
    return normaliseTags([...current, ...snapped]);
  }

  function onTagInput(value: string) {
    // a separator typed (or pasted) closes every tag before it
    if (/[;,]/.test(value)) {
      const cut = Math.max(value.lastIndexOf(','), value.lastIndexOf(';'));
      setForm((f) => ({ ...f, tags: withTags(f.tags, value.slice(0, cut)) }));
      setTagDraft(value.slice(cut + 1));
    } else {
      setTagDraft(value);
    }
  }

  function commitTagDraft() {
    if (!tagDraft.trim()) return;
    setForm((f) => ({ ...f, tags: withTags(f.tags, tagDraft) }));
    setTagDraft('');
  }

  function removeTag(tag: string) {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  }

  // ── image ──
  function onImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > RATIONALE_IMAGE_MAX_BYTES) {
      setMsg({ text: 'Image must be under 2MB.', tone: 'error' });
      return;
    }
    setImgFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImgLocalPreview(String(ev.target?.result || ''));
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImgFile(null);
    setImgLocalPreview('');
    setImgUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── save / delete ──
  async function save() {
    // Legacy's own checks, in its order, before the round trip.
    if (!form.stem.trim()) return setMsg({ text: 'Question stem is required.', tone: 'error' });
    if (form.type === 'SATA' && !form.correctSata.length) {
      return setMsg({ text: 'Select at least one correct option for SATA.', tone: 'error' });
    }

    // 08 B4: a published question switched off here is an unpublish, and
    // asks first when live quizzes name it — as the card's button does.
    let blocked = 0;
    if (currentItem?.is_published && !form.isPublished) {
      const use = await countQuizzesNaming(courseId, [currentItem.item_id]);
      if (!use.ok) return setMsg({ text: use.error, tone: 'error' });
      if (use.count > 0) {
        const ok = await confirm({
          title: 'Unpublish this question?',
          body: quizzesWillRefuse(use.count),
          confirmLabel: 'Save and unpublish',
        });
        if (!ok) return;
        blocked = use.count;
      }
    }
    // text still in the Tags box is a tag the admin meant
    const tags = withTags(form.tags, tagDraft);

    let image: FormData | null = null;
    if (imgFile) {
      image = new FormData();
      image.append('file', imgFile);
    }

    setSaving(true);
    const result = await saveQuestion(
      {
        courseId,
        isNew,
        itemId: form.itemId,
        questionType: form.type,
        stem: form.stem,
        options: form.options,
        feedback: form.feedback,
        correct: form.type === 'SATA' ? form.correctSata : [form.correctMcq],
        rationale: form.rationale,
        rationaleImg: imgUrl,
        subject: form.subject,
        maintopic: form.maintopic,
        subtopic: form.subtopic,
        difficulty: form.difficulty,
        marks: form.marks,
        batchId: form.batchId,
        shuffleOptions: form.shuffle,
        bloomLevel: form.bloomLevel,
        isPublished: form.isPublished,
        isFreeSample: form.isFreeSample,
        questionRef: form.questionRef,
        tags,
      },
      image,
    );
    setSaving(false);
    if (!result.ok) return setMsg({ text: result.error, tone: 'error' });

    // legacy: re-fetch the course, keep the panel open on this question;
    // the preview shows the stored URL again. The tags as the server
    // stored them (snapped to the bank's spellings).
    const fresh = await fetchCourse(courseId);
    const stored = fresh.find((i) => i.item_id === form.itemId);
    if (isNew) setIsNew(false);
    setCurrentId(form.itemId);
    setImgFile(null);
    setImgLocalPreview('');
    setImgUrl(stored?.rationale_img || '');
    setTagDraft('');
    setForm((f) => ({ ...f, tags: stored?.tags ?? tags }));
    setMsg({
      text: blocked ? `Question saved and unpublished. ${quizzesWillRefuse(blocked)}` : 'Question saved.',
      tone: 'success',
    });
  }

  // ── Publish / Unpublish (08 B4) ──
  function markPublished(ids: string[], published: boolean) {
    const set = new Set(ids);
    setItems((rows) => rows.map((i) => (set.has(i.item_id) ? { ...i, is_published: published } : i)));
    if (currentId && set.has(currentId)) setForm((f) => ({ ...f, isPublished: published }));
  }

  async function publishOne(item: Item, published: boolean) {
    if (busyId) return;
    setBusyId(item.item_id);
    try {
      if (!published) {
        const use = await countQuizzesNaming(courseId, [item.item_id]);
        if (!use.ok) return setMsg({ text: use.error, tone: 'error' });
        if (use.count > 0) {
          const ok = await confirm({
            title: `Unpublish question ${item.item_id}?`,
            body: quizzesWillRefuse(use.count),
            confirmLabel: 'Unpublish',
          });
          if (!ok) return;
        }
      }
      const result = await setPublished(courseId, [item.item_id], published);
      if (!result.ok) return setMsg({ text: result.error, tone: 'error' });
      markPublished([item.item_id], published);
      setMsg({
        text: published
          ? 'Question published.'
          : result.blockedQuizzes
            ? `Question unpublished. ${quizzesWillRefuse(result.blockedQuizzes)}`
            : 'Question unpublished.',
        tone: 'success',
      });
    } finally {
      setBusyId(null);
    }
  }

  // Every draft the filters are showing — not only the cards drawn so far.
  async function publishAllShown() {
    const ids = shownDrafts.map((i) => i.item_id);
    if (!ids.length || busyId) return;
    const noun = ids.length === 1 ? 'draft question' : 'draft questions';
    const ok = await confirm({
      title: `Publish ${ids.length} ${noun}?`,
      body: 'Published questions reach students at once — in the Quiz Builder, offline packs and any quiz that names them.',
      confirmLabel: `Publish ${ids.length}`,
    });
    if (!ok) return;
    setBusyId('*');
    try {
      const result = await setPublished(courseId, ids, true);
      if (!result.ok) {
        // part of the set may have gone through before a failure
        await fetchCourse(courseId);
        return setMsg({ text: result.error, tone: 'error' });
      }
      markPublished(ids, true);
      setMsg({ text: `${result.changed} question${result.changed === 1 ? '' : 's'} published.`, tone: 'success' });
    } finally {
      setBusyId(null);
    }
  }

  // DS4: legacy's words in the app's dialog; the id is typed back before
  // Delete enables (a delete cannot be undone).
  async function confirmDelete() {
    if (!currentId) return;
    const ok = await confirm({
      title: `Delete question ${currentId}?`,
      body: 'This cannot be undone.',
      confirmLabel: 'Delete question',
      danger: true,
      typeToConfirm: currentId,
    });
    if (!ok) return;
    const result = await deleteQuestion(courseId, currentId);
    if (!result.ok) return setMsg({ text: result.error, tone: 'error' });
    setItems((rows) => rows.filter((i) => i.item_id !== currentId));
    closePanel();
    setMsg({ text: 'Question deleted.', tone: 'success' });
  }

  const visibleLetters = form.type === 'TF' ? (['a', 'b'] as OptionLetter[]) : OPTION_LETTERS;
  const previewSrc = imgLocalPreview || imgUrl;

  return (
    <div className="qb">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />
      {confirmDialog}
      {csvOpen ? (
        <CsvImportModal
          courseId={courseId}
          onClose={() => setCsvOpen(false)}
          onImported={async () => { await fetchCourse(courseId); }}
        />
      ) : null}

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <label htmlFor="filterCourse">Course *</label>
          <select id="filterCourse" value={courseId} onChange={(e) => onCourseChange(e.target.value)}>
            <option value="">Select course…</option>
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>{c.title} ({c.course_id})</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterMaintopic">Main Topic</label>
          <select id="filterMaintopic" value={fMaintopic} onChange={(e) => { setFMaintopic(e.target.value); setLimit(PAGE_SIZE); }}>
            <option value="">All topics</option>
            {maintopics.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterDifficulty">Difficulty</label>
          <select id="filterDifficulty" value={fDifficulty} onChange={(e) => { setFDifficulty(e.target.value); setLimit(PAGE_SIZE); }}>
            <option value="">All difficulties</option>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterType">Type</label>
          <select id="filterType" value={fType} onChange={(e) => { setFType(e.target.value); setLimit(PAGE_SIZE); }}>
            <option value="">All types</option>
            <option value="MCQ">MCQ</option>
            <option value="TF">True / False</option>
            <option value="SATA">SATA</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterBatch">Batch</label>
          <select id="filterBatch" value={fBatch} onChange={(e) => { setFBatch(e.target.value); setLimit(PAGE_SIZE); }}>
            <option value="">All batches</option>
            {batchIds.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterStatus">Status</label>
          <select id="filterStatus" value={fStatus} onChange={(e) => { setFStatus(e.target.value); setLimit(PAGE_SIZE); }}>
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterFree">Free</label>
          <select id="filterFree" value={fFree} onChange={(e) => { setFFree(e.target.value); setLimit(PAGE_SIZE); }}>
            <option value="">All</option>
            <option value="free">Free only</option>
            <option value="not-free">Not free</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterLevel">Level</label>
          <select id="filterLevel" value={fLevel} onChange={(e) => { setFLevel(e.target.value); setLimit(PAGE_SIZE); }}>
            <option value="">All levels</option>
            {BLOOM_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            <option value="none">Not set</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterKeyword">Search</label>
          <input id="filterKeyword" type="text" placeholder="Keyword in stem…" value={keyword} onChange={(e) => { setKeyword(e.target.value); setLimit(PAGE_SIZE); }} />
        </div>
        <div className="filter-actions">
          <button type="button" className="btn btn-ghost" onClick={clearFilters}>Clear</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="result-count">
            {courseId && !loading ? `${filtered.length} question${filtered.length !== 1 ? 's' : ''}` : ''}
          </span>
        </div>
        <div className="toolbar-right">
          {courseId && !loading && shownDrafts.length ? (
            <button type="button" className="btn btn-ghost" disabled={busyId !== null} onClick={publishAllShown}>
              <Icon name="check-circle" />Publish all shown ({shownDrafts.length})
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" disabled={!courseId} onClick={openCsvModal}><Icon name="upload" />Import CSV</button>
          <button type="button" className="btn btn-primary" disabled={!courseId} onClick={openNew}>+ New Question</button>
        </div>
      </div>

      {/* List + edit panel */}
      <div className="qb-layout">
        <div>
          {!courseId ? (
            <div className="empty-state"><div className="icon"><Icon name="book" size={36} /></div><p>Select a course above to load questions.</p></div>
          ) : loading ? (
            <div className="empty-state"><div className="icon"><Icon name="hourglass" size={36} /></div><p>Loading questions…</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><div className="icon"><Icon name="search" size={36} /></div><p>No questions match the current filters.</p></div>
          ) : (
            <div className="q-list">
              {shown.map((item) => {
                const correct = correctLetters(item);
                const img = item.rationale_img ? (
                  <div className="q-rationale-img">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a public bucket URL; next/image would need the host allow-listed */}
                    <img
                      src={item.rationale_img}
                      alt="Rationale image"
                      title="Click to enlarge"
                      onClick={(e) => { e.stopPropagation(); window.open(item.rationale_img!, '_blank'); }}
                    />
                    <span>Rationale image attached</span>
                  </div>
                ) : null;
                return (
                  <div
                    key={item.item_id}
                    id={`card-${item.item_id}`}
                    className={`q-card${currentId === item.item_id ? ' active' : ''}${item.is_published ? '' : ' is-draft'}`}
                    onClick={() => openEdit(item)}
                  >
                    <div className="q-card-header">
                      <div className="q-card-meta">
                        <span className="q-id">{item.item_id}</span>
                        {!item.is_published ? <span className="badge badge-warning">Draft</span> : null}
                        <KindChip hue={QUESTION_TYPE_HUE[item.question_type]}>{item.question_type || '—'}</KindChip>
                        {item.difficulty && DIFFICULTY_STEP[item.difficulty]
                          ? <ScaleChip step={DIFFICULTY_STEP[item.difficulty]}>{item.difficulty}</ScaleChip>
                          : item.difficulty ? <KindChip>{item.difficulty}</KindChip> : null}
                        {item.bloom_level ? <KindChip>{item.bloom_level}</KindChip> : null}
                        {item.is_free_sample ? <KindChip>Free</KindChip> : null}
                        {item.marks && Number(item.marks) !== 1 ? <KindChip>{item.marks} marks</KindChip> : null}
                      </div>
                      <div className="q-card-actions">
                        <button
                          type="button"
                          className="q-edit-btn"
                          disabled={busyId !== null}
                          onClick={(e) => { e.stopPropagation(); publishOne(item, !item.is_published); }}
                        >
                          {busyId === item.item_id ? '…' : item.is_published ? 'Unpublish' : <><Icon name="check-circle" />Publish</>}
                        </button>
                        <button type="button" className="q-edit-btn" onClick={(e) => { e.stopPropagation(); openEdit(item); }}><Icon name="pencil" />Edit</button>
                      </div>
                    </div>
                    <div className="q-stem">{item.stem}</div>
                    <div className="q-options">
                      {OPTION_LETTERS.map((l) => {
                        const text = item[`option_${l}`];
                        if (!text) return null;
                        return (
                          <div key={l} className={`q-option${correct.includes(l) ? ' correct' : ''}`}>
                            <span className="q-option-letter">{l.toUpperCase()}.</span>
                            <span className="q-option-text">{text}</span>
                          </div>
                        );
                      })}
                    </div>
                    {item.rationale ? (
                      <div className="q-rationale"><strong>Rationale:</strong> {item.rationale}{img}</div>
                    ) : img ? (
                      <div className="q-rationale">{img}</div>
                    ) : null}
                    <div className="q-topics">
                      {item.subject ? <span className="q-topic-pill">{item.subject}</span> : null}
                      {item.maintopic ? <span className="q-topic-pill">{item.maintopic}</span> : null}
                      {item.subtopic ? <span className="q-topic-pill">• {item.subtopic}</span> : null}
                      {(item.tags ?? []).map((t) => <span key={t} className="q-tag-pill">#{t}</span>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {courseId && !loading && filtered.length > limit ? (
            <div className="load-more-wrap">
              <button type="button" className="btn btn-ghost" onClick={() => setLimit((n) => n + PAGE_SIZE)}>Load more questions</button>
            </div>
          ) : null}
        </div>

        {/* Edit panel */}
        <div className={`edit-panel${panelOpen ? ' open' : ''}`} aria-hidden={!panelOpen}>
          <div className="panel-header">
            <h3 className="panel-title">
              {isNew ? 'New Question' : 'Edit Question'}
              {!isNew && currentItem && !currentItem.is_published ? <span className="badge badge-warning">Draft</span> : null}
            </h3>
            <button type="button" className="panel-close" onClick={closePanel} title="Close">✕</button>
          </div>

          <div className="panel-body">
            <div className="form-group">
              <label htmlFor="fieldItemId">Question ID</label>
              <input id="fieldItemId" type="text" className="field-id" readOnly value={form.itemId} />
              <p className="form-hint">
                Auto-generated. Cannot be changed.
                {!isNew && currentItem ? ` · Version ${currentItem.version}` : ''}
              </p>
            </div>

            <div className="form-group qb-switches">
              <label className="check-label">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setField('isPublished', e.target.checked)} />
                Published — students can see this question
              </label>
              {isNew ? <p className="form-hint">A new question is saved as a draft unless this is ticked.</p> : null}
              <label className="check-label">
                <input type="checkbox" checked={form.isFreeSample} onChange={(e) => setField('isFreeSample', e.target.checked)} />
                Free question
              </label>
              <p className="form-hint">Marks it for the free pool, which is not open to students yet. A question in a mock exam cannot be free.</p>
            </div>

            <div className="form-group">
              <label htmlFor="fieldType">Question Type *</label>
              <select id="fieldType" value={form.type} onChange={(e) => setForm((f) => applyType(f, e.target.value as QuestionType))}>
                {QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="fieldStem">Question Stem *</label>
              <textarea id="fieldStem" rows={4} placeholder="Enter the question text…" value={form.stem} onChange={(e) => setField('stem', e.target.value)} />
            </div>

            <div className="form-section">Answer Options</div>
            <p className="form-hint form-hint-block">For each option: enter the answer text (left) and the per-option feedback shown after answering (right). Leave unused options blank.</p>

            <div>
              {visibleLetters.map((l) => (
                <div key={l} className="option-pair">
                  <div>
                    <div className="opt-label">Option {l.toUpperCase()}</div>
                    <input
                      type="text"
                      placeholder={`Option ${l.toUpperCase()} text…`}
                      value={form.options[l]}
                      onChange={(e) => setForm((f) => ({ ...f, options: { ...f.options, [l]: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <div className="opt-label">Feedback</div>
                    <input
                      type="text"
                      placeholder={`Feedback for ${l.toUpperCase()}…`}
                      value={form.feedback[l]}
                      onChange={(e) => setForm((f) => ({ ...f, feedback: { ...f.feedback, [l]: e.target.value } }))}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="form-section">Correct Answer</div>

            {form.type === 'SATA' ? (
              <div className="form-group">
                <label>Correct Options * (select all that apply)</label>
                <div className="sata-correct">
                  {OPTION_LETTERS.map((l) => (
                    <label key={l}>
                      <input type="checkbox" value={l} checked={form.correctSata.includes(l)} onChange={() => toggleSata(l)} /> {l.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="fieldCorrectMcq">Correct Option *</label>
                <select id="fieldCorrectMcq" className="correct-select" value={form.correctMcq} onChange={(e) => setField('correctMcq', e.target.value)}>
                  {form.type === 'TF' ? (
                    <>
                      <option value="a">A (True)</option>
                      <option value="b">B (False)</option>
                    </>
                  ) : (
                    OPTION_LETTERS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)
                  )}
                </select>
              </div>
            )}

            <div className="form-section">Rationale &amp; Classification</div>

            <div className="form-group">
              <label htmlFor="fieldRationale">Rationale</label>
              <textarea id="fieldRationale" rows={3} placeholder="Explanation of the correct answer…" value={form.rationale} onChange={(e) => setField('rationale', e.target.value)} />
            </div>

            <div className="form-group">
              <label>Rationale Image</label>
              {!previewSrc ? (
                <div className="img-upload-area" onClick={() => fileInputRef.current?.click()}>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageSelected} />
                  <div className="img-upload-icon">🖼️</div>
                  <div className="img-upload-text">Click to upload an image</div>
                  <div className="img-upload-sub">JPG, PNG, GIF — max 2MB</div>
                </div>
              ) : (
                <div className="img-preview">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageSelected} hidden />
                  {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL preview or the bucket URL */}
                  <img src={previewSrc} alt="Rationale image" />
                  <div className="img-preview-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={clearImage}>Remove image</button>
                  </div>
                </div>
              )}
              <p className="form-hint img-url">{imgLocalPreview ? 'New image selected — will upload on save.' : imgUrl}</p>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fieldSubject">Subject</label>
                <input id="fieldSubject" type="text" placeholder="e.g. Anatomy" value={form.subject} onChange={(e) => setField('subject', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="fieldMaintopic">Main Topic</label>
                <input id="fieldMaintopic" type="text" placeholder="e.g. Cardiovascular" value={form.maintopic} onChange={(e) => setField('maintopic', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fieldSubtopic">Subtopic / Concept</label>
                <input id="fieldSubtopic" type="text" placeholder="e.g. Heart failure" value={form.subtopic} onChange={(e) => setField('subtopic', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="fieldDifficulty">Difficulty</label>
                <select id="fieldDifficulty" value={form.difficulty} onChange={(e) => setField('difficulty', e.target.value)}>
                  <option value="">— Select —</option>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fieldMarks">Marks</label>
                <input id="fieldMarks" type="number" min={1} value={form.marks} onChange={(e) => setField('marks', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="fieldBatchId">Batch ID</label>
                <input id="fieldBatchId" type="text" placeholder="e.g. GP_BATCH_001" value={form.batchId} onChange={(e) => setField('batchId', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fieldLevel">Level</label>
                <select id="fieldLevel" value={form.bloomLevel} onChange={(e) => setField('bloomLevel', e.target.value)}>
                  <option value="">— Not set —</option>
                  {BLOOM_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="fieldQuestionRef">Source</label>
                <input id="fieldQuestionRef" type="text" placeholder="e.g. NMC 2019 paper, Q14" value={form.questionRef} onChange={(e) => setField('questionRef', e.target.value)} />
              </div>
            </div>
            <p className="form-hint form-hint-block">The source is for admins only — students never see it.</p>
            <div className="form-group">
              <label htmlFor="fieldTags">Tags</label>
              <div className="tag-editor">
                {form.tags.map((t) => (
                  <span key={t} className="tag-chip">
                    {t}
                    <button type="button" aria-label={`Remove tag ${t}`} onClick={() => removeTag(t)}>×</button>
                  </span>
                ))}
                <input
                  id="fieldTags"
                  type="text"
                  list="qbTagsInUse"
                  placeholder={form.tags.length ? 'Add another…' : 'Type a tag, then Enter'}
                  value={tagDraft}
                  onChange={(e) => onTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitTagDraft(); }
                    else if (e.key === 'Backspace' && !tagDraft && form.tags.length) removeTag(form.tags[form.tags.length - 1]);
                  }}
                  onBlur={commitTagDraft}
                />
                <datalist id="qbTagsInUse">
                  {tagsInUse.filter((t) => !form.tags.some((x) => x.toLowerCase() === t.toLowerCase())).map((t) => <option key={t} value={t} />)}
                </datalist>
              </div>
              <p className="form-hint">Shown to students with the question. Enter, a comma or a semicolon ends a tag; one already in use keeps its spelling.</p>
            </div>
            <div className="form-group">
              <label className="check-label">
                <input type="checkbox" checked={form.shuffle} onChange={(e) => setField('shuffle', e.target.checked)} />
                Shuffle options (uncheck for True/False questions)
              </label>
            </div>
          </div>

          <div className="panel-actions">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : <><Icon name="save" />Save</>}</button>
            <button type="button" className="btn btn-ghost" onClick={closePanel}>Cancel</button>
            {!isNew ? (
              <button type="button" className="btn btn-danger btn-delete" onClick={confirmDelete}><Icon name="trash" />Delete</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
