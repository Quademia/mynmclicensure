// app/(app)/offline-pack/page.tsx — legacy student/offline-pack-renderer.html
// (slice 13a).
//
// The renderer: a saved pack laid out for the screen and the printer —
// the cover (owner name, masked email, owner label), the overview, the
// questions with their options and topic line and the watermark strip
// after every tenth, the answer key. Read from the stored snapshot only
// (lib/offline-packs/queries getOfflinePackForRender) and rendered on
// the server; the toolbar's Print / "Download / Save PDF" / Reload
// buttons are the one client piece. Both print buttons open the
// browser's print dialog, as legacy's did — no PDF is generated.
//
// No sidebar, as legacy: the page sits under the (app) auth boundary
// beside the runner, so printing gives the pack alone (rebuild.md §12
// slice 13, Sam 2026-09-14).
//
// "QA" → "Q", "QAcademy Nurses Hub" → "Quademia" (UI convention #5).

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import type { Item } from '@/lib/bank/types';
import { getCourses } from '@/lib/catalogue/queries';
import { getOfflinePackForRender } from '@/lib/offline-packs/queries';
import { formatPackDate, OWNER_NAME_FALLBACK } from '@/lib/offline-packs/labels';
import { OWNER_MARK_EVERY, type OfflinePack } from '@/lib/offline-packs/types';
import { RendererToolbar } from './renderer-toolbar';
import '@/styles/offline-pack-renderer.css';

export const metadata: Metadata = {
  title: 'Offline Pack | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

const BRAND = 'Quademia';
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

// legacy orderedOptionEntries: option_a … option_f, the non-empty ones, in order.
function orderedOptionEntries(item: Item): { letter: string; text: string }[] {
  const out: { letter: string; text: string }[] = [];
  for (const letter of LETTERS) {
    const text = item[`option_${letter.toLowerCase()}` as keyof Item];
    if (text != null && String(text).trim() !== '') out.push({ letter, text: String(text) });
  }
  return out;
}

// legacy normalizeCorrectLetters — tolerant of "b", "a,c,e", "A / C",
// "OPTION_B", "2", ["A","C"], "ACD".
function normalizeCorrectLetters(v: unknown): string[] {
  const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))];
  const fromToken = (token: unknown): string[] => {
    const t = String(token || '').trim().toUpperCase();
    if (!t) return [];
    if ((LETTERS as readonly string[]).includes(t)) return [t];
    if (/^OPTION_[A-F]$/.test(t)) return [t.replace('OPTION_', '')];
    if (/^[1-6]$/.test(t)) return [LETTERS[Number(t) - 1]];
    if (/^[A-F]+$/.test(t) && t.length > 1) return t.split('').filter((x) => (LETTERS as readonly string[]).includes(x));
    return [];
  };

  if (Array.isArray(v)) return uniq(v.flatMap(fromToken));
  const raw = String(v || '').trim();
  if (!raw) return [];
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return uniq(parsed.flatMap(fromToken));
    } catch {
      /* not JSON — fall through */
    }
  }
  const up = raw.toUpperCase();
  const optionMatches = up.match(/OPTION_[A-F]/g);
  if (optionMatches && optionMatches.length) return uniq(optionMatches.flatMap(fromToken));
  const parts = up.replace(/\bAND\b/g, ',').split(/[\s,;/|&+]+/).filter(Boolean);
  const parsedParts = uniq(parts.flatMap(fromToken));
  if (parsedParts.length) return parsedParts;
  return uniq(fromToken(up));
}

function joinOrFallback(arr: string[] | null | undefined, fallback: string): string {
  return Array.isArray(arr) && arr.length ? arr.map((x) => String(x)).join(', ') : fallback;
}

export default async function OfflinePackPage({ searchParams }: { searchParams: Promise<{ pack_id?: string }> }) {
  const { supabase, profile } = await requireStudent();
  const { pack_id } = await searchParams;
  const packId = String(pack_id || '').trim();

  let error = '';
  let pack: OfflinePack | null = null;
  let items: Item[] = [];
  let courseTitle = '';

  if (!packId) {
    error = 'Missing pack_id in the page URL.';
  } else {
    const load = await getOfflinePackForRender(supabase, profile.user_id, packId);
    if (!load.ok) {
      error = load.message || 'Could not load this offline pack.';
    } else {
      pack = load.pack;
      items = load.items;
      // legacy: the course title from getCourseById, else the id
      const courses = await getCourses(supabase);
      courseTitle = courses.find((c) => c.course_id === pack!.course_id)?.title || pack.course_id;
    }
  }

  const wm = pack?.watermark || {};
  const ownerName = String(wm.owner_name || '').trim() || OWNER_NAME_FALLBACK;
  const ownerEmail = String(wm.owner_email_mask || '').trim();
  const ownerLabel = String(wm.owner_label || '').trim();
  const watermarkText = String(wm.owner_label || wm.owner_name || BRAND).trim() || BRAND;
  const questionsShown = pack ? items.length || pack.question_count || '—' : '—';

  return (
    <div className="opr">
      <div className="wrap">
        <RendererToolbar />

        {error ? <div className="err">{error}</div> : null}

        {pack ? (
          <>
            {/* Cover (legacy renderCover) */}
            <div className="card">
              <div className="coverRow">
                <div className="logoBox">
                  <div className="logoMark">Q</div>
                </div>
                <div className="coverMain">
                  <p className="coverTitle">{pack.pack_name || 'Offline Pack'}</p>
                  <div className="coverSub">
                    <span className="tag"><b>Course</b>&nbsp;{courseTitle}</span>
                    <span className="tag"><b>Questions</b>&nbsp;{questionsShown}</span>
                    <span className="tag"><b>Pack</b>&nbsp;{pack.pack_id}</span>
                    <span className="tag"><b>Generated</b>&nbsp;{formatPackDate(pack.created_utc)}</span>
                  </div>
                  <div className="coverOwner">
                    <b>Prepared for:</b> {ownerName}
                    {ownerEmail ? <span className="muted"> ({ownerEmail})</span> : null}
                    {ownerLabel ? <div className="muted ownerLabel">{ownerLabel}</div> : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Overview (legacy renderOverview) */}
            <div className="card">
              <div className="sectionTitle">Pack Overview</div>
              <div className="divider" />
              <div className="kvList">
                <div className="kvBox"><div className="k">Course</div><div><b>{courseTitle}</b></div></div>
                <div className="kvBox"><div className="k">Questions</div><div><b>{questionsShown}</b></div></div>
                <div className="kvBox"><div className="k">Pack ID</div><div><b>{pack.pack_id}</b></div></div>
                <div className="kvBox"><div className="k">Selection mode</div><div><b>{pack.selection_mode === 'concept' ? 'Concept mode' : 'Topics mode'}</b></div></div>
              </div>
              <div className="compactLine"><span className="label">Maintopics selected:</span><span className="value">{joinOrFallback(pack.maintopics, 'All topics')}</span></div>
              <div className="compactLine"><span className="label">Subtopics selected:</span><span className="value">{joinOrFallback(pack.subtopics, 'Not specified')}</span></div>
              <div className="compactLine"><span className="label">Difficulty:</span><span className="value">{joinOrFallback(pack.difficulties, 'All difficulties')}</span></div>
              <div className="compactLine"><span className="label">Question type:</span><span className="value">{joinOrFallback(pack.question_types, 'All question types')}</span></div>
              <div className="compactLine"><span className="label">Concept keyword:</span><span className="value">{String(pack.concept_query || '').trim() || 'None'}</span></div>
              <div className="overviewNote">
                For personal study use only. Do not share. Attempt the questions first, then use the answer key at the end to check your work.
              </div>
            </div>

            {/* Questions (legacy renderQuestions) */}
            <div className="card">
              <div className="sectionTitle">Questions</div>
              <div className="divider" />
              {items.map((item, idx) => {
                const qn = idx + 1;
                const opts = orderedOptionEntries(item);
                const strip = OWNER_MARK_EVERY > 0 && qn % OWNER_MARK_EVERY === 0 && qn !== items.length;
                return (
                  <div key={item.item_id}>
                    <div className="q">
                      <div className="qhead">
                        <div className="qno">Q{qn}.</div>
                        <div className="qstem">{item.stem || ''}</div>
                      </div>
                      <ul className="opts">
                        {opts.map((opt) => (
                          <li key={opt.letter} className="opt">
                            <div className="olabel">{opt.letter}.</div>
                            <div className="otext">{opt.text}</div>
                          </li>
                        ))}
                      </ul>
                      <div className="metaLine">
                        <span><b>Main topic:</b> {item.maintopic || '—'}</span>
                        <span><b>Subtopic:</b> {item.subtopic || '—'}</span>
                        <span><b>Difficulty:</b> {item.difficulty || '—'}</span>
                        <span><b>Type:</b> {item.question_type || '—'}</span>
                      </div>
                    </div>
                    {strip ? (
                      <div className="ownerSep" data-watermark={watermarkText}>
                        <div className="ownerSepRow">
                          <div className="ownerSepSmall">
                            <b>{watermarkText}</b> <span className="muted">• marker after Q{qn}</span>
                          </div>
                          <div className="ownerSepChip">{pack.pack_id || 'Pack'}</div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {!items.length ? <div className="muted small">No questions found in this pack.</div> : null}
            </div>

            {/* Answer key (legacy renderAnswerKey) */}
            <div className="card">
              <div className="sectionTitle">Answer Key</div>
              <div className="divider" />
              <div className="akeyGrid">
                {items.map((item, idx) => {
                  const letters = normalizeCorrectLetters(item.correct);
                  return (
                    <div key={item.item_id} className="kv">
                      <span>Q{idx + 1}</span>
                      <b>{letters.length ? letters.join(', ') : '—'}</b>
                    </div>
                  );
                })}
              </div>
              {!items.length ? <div className="muted small akeyEmpty">No answer key available.</div> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
