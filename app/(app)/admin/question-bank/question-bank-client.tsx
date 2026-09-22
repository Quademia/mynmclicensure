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

'use client';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Toast } from '@/lib/toast/toast';
import { CsvImportModal } from './csv-import-modal';
import { deleteQuestion, loadCourseItems, saveQuestion } from '@/lib/bank/actions';
import {
  DIFFICULTIES,
  OPTION_LETTERS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  RATIONALE_IMAGE_MAX_BYTES,
  type Item,
  type OptionLetter,
  type QuestionType,
} from '@/lib/bank/types';
import type { Course } from '@/lib/catalogue/types';
import { Icon } from '@/components/shell/icons';

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
};

const TYPE_BADGE: Record<string, string> = { MCQ: 'badge-mcq', TF: 'badge-tf', SATA: 'badge-sata' };
const DIFF_BADGE: Record<string, string> = { Easy: 'badge-easy', Moderate: 'badge-moderate', Hard: 'badge-hard' };

function correctLetters(item: Item): string[] {
  return item.question_type === 'SATA'
    ? (item.correct || '').split(',').map((s) => s.trim().toLowerCase())
    : [(item.correct || '').trim().toLowerCase()];
}

export function QuestionBankClient({ courses }: { courses: Course[] }) {
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  // ── the course and its rows ──
  const [courseId, setCourseId] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [maintopics, setMaintopics] = useState<string[]>([]);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // ── filters (applied in the browser, as legacy) ──
  const [fMaintopic, setFMaintopic] = useState('');
  const [fDifficulty, setFDifficulty] = useState('');
  const [fType, setFType] = useState('');
  const [fBatch, setFBatch] = useState('');
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    return result.items;
  }

  function resetFilters() {
    setFMaintopic('');
    setFDifficulty('');
    setFType('');
    setFBatch('');
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
    if (kw) {
      const searchable = [
        item.stem, item.option_a, item.option_b, item.option_c,
        item.option_d, item.option_e, item.option_f,
        item.rationale, item.maintopic, item.subtopic, item.subject,
      ].map((v) => (v || '').toLowerCase()).join(' ');
      if (!searchable.includes(kw)) return false;
    }
    return true;
  });
  const shown = filtered.slice(0, limit);

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
    };
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
    setForm(applyType({ ...EMPTY_FORM, options: blankLetters(), feedback: blankLetters(), itemId: prefix + Date.now().toString().slice(-6) }, 'MCQ'));
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
      },
      image,
    );
    setSaving(false);
    if (!result.ok) return setMsg({ text: result.error, tone: 'error' });

    // legacy: re-fetch the course, keep the panel open on this question;
    // the preview shows the stored URL again.
    const fresh = await fetchCourse(courseId);
    if (isNew) setIsNew(false);
    setCurrentId(form.itemId);
    setImgFile(null);
    setImgLocalPreview('');
    setImgUrl(fresh.find((i) => i.item_id === form.itemId)?.rationale_img || '');
    setMsg({ text: 'Question saved.', tone: 'success' });
  }

  // DS4: legacy's words in the app's dialog; the id is typed back before
  // Delete enables (a delete cannot be undone).
  const [confirm, confirmDialog] = useConfirm();
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
                    className={`q-card${currentId === item.item_id ? ' active' : ''}`}
                    onClick={() => openEdit(item)}
                  >
                    <div className="q-card-header">
                      <div className="q-card-meta">
                        <span className="q-id">{item.item_id}</span>
                        <span className={`badge ${TYPE_BADGE[item.question_type] || 'badge-default'}`}>{item.question_type || '—'}</span>
                        {item.difficulty ? <span className={`badge ${DIFF_BADGE[item.difficulty] || 'badge-default'}`}>{item.difficulty}</span> : null}
                        {item.marks && Number(item.marks) !== 1 ? <span className="badge badge-default">{item.marks} marks</span> : null}
                      </div>
                      <button type="button" className="q-edit-btn" onClick={(e) => { e.stopPropagation(); openEdit(item); }}><Icon name="pencil" />Edit</button>
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
            <h3>{isNew ? 'New Question' : 'Edit Question'}</h3>
            <button type="button" className="panel-close" onClick={closePanel} title="Close">✕</button>
          </div>

          <div className="panel-body">
            <div className="form-group">
              <label htmlFor="fieldItemId">Question ID</label>
              <input id="fieldItemId" type="text" className="field-id" readOnly value={form.itemId} />
              <p className="form-hint">Auto-generated. Cannot be changed.</p>
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
