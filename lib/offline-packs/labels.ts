// lib/offline-packs/labels.ts
//
// The pure helpers of legacy's offline-pack section in
// js/mynmclicensure-api.js and the builder page: the masked email, the
// "Prepared for" owner label, the canonical difficulty word, the display
// label, the default pack name, and the builder page's message for each
// allowance refusal (allowanceMessageForReason). No database, no React —
// the builder's client and the Server Actions both import this.
//
// "QAcademy Student" → "Quademia Student" (AGENTS.md UI convention #5):
// the fallback name renders on the cover and inside the stored
// watermark.owner_label.

import type { Allowance, MyPack, PackLabelMeta } from './types';

export const OWNER_NAME_FALLBACK = 'Quademia Student';

// legacy safeArray: trimmed, non-empty, distinct.
export function safeArray(values: unknown): string[] {
  return Array.isArray(values) ? [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))] : [];
}

// legacy maskEmailForOffline: "sam***@domain"; one or two letters keep the first.
export function maskEmailForOffline(email: string): string {
  const raw = String(email || '').trim();
  if (!raw || !raw.includes('@')) return '';
  const [name, domain] = raw.split('@');
  if (!name || !domain) return raw;
  if (name.length <= 2) return `${name[0] || '*'}***@${domain}`;
  return `${name.slice(0, 3)}***@${domain}`;
}

// legacy buildOfflineOwnerLabel.
export function buildOfflineOwnerLabel(name: string, maskedEmail: string): string {
  const safeName = String(name || '').trim() || OWNER_NAME_FALLBACK;
  const safeMail = String(maskedEmail || '').trim();
  return safeMail ? `Prepared for: ${safeName} (${safeMail})` : `Prepared for: ${safeName}`;
}

// legacy getOfflinePackUserProfile's name: name → "forename surname" → the fallback.
export function ownerNameOf(p: { name: string | null; forename: string | null; surname: string | null }): string {
  return (
    String(p.name || '').trim() ||
    `${String(p.forename || '').trim()} ${String(p.surname || '').trim()}`.trim() ||
    OWNER_NAME_FALLBACK
  );
}

// legacy canonicalOfflineDifficultyLabel.
export function canonicalOfflineDifficultyLabel(d: string): string {
  const s = String(d || '').trim().toLowerCase();
  if (s === 'easy') return 'Easy';
  if (s === 'moderate' || s === 'medium') return 'Moderate';
  if (s === 'hard' || s === 'difficult') return 'Hard';
  return String(d || '').trim();
}

// legacy buildOfflinePackDisplayLabel — "Focus (Difficulty part, NQ)".
export function buildOfflinePackDisplayLabel(meta: Partial<PackLabelMeta>): string {
  const maintopics = safeArray(meta.maintopics);
  const difficulties = safeArray(meta.difficulties).map(canonicalOfflineDifficultyLabel).filter(Boolean);
  const n = Number(meta.n || 0);

  let focus = 'Offline Pack';

  if (meta.selection_mode === 'concept') {
    const concepts = safeArray(meta.concepts);
    const q = String(meta.concept_query || '').trim();
    if (concepts.length === 1 && !q) focus = concepts[0];
    else if (concepts.length > 1) focus = 'Concept Mix';
    else if (q) focus = q;
    else if (maintopics.length === 1) focus = maintopics[0];
  } else {
    if (maintopics.length === 1) focus = maintopics[0];
    else if (maintopics.length > 1) focus = 'Mixed Topics';
    else focus = 'Full Bank';
  }

  let diffPart = 'All difficulties';
  const canon = [...new Set(difficulties)];
  if (canon.length === 1) diffPart = `${canon[0]} only`;
  else if (canon.length === 2) diffPart = `${canon[0]} + ${canon[1]}`;

  return `${focus} (${diffPart}${n > 0 ? `, ${n}Q` : ''})`;
}

// legacy buildOfflinePackDefaultName — the label, at most 80 characters.
export function buildOfflinePackDefaultName(meta: Partial<PackLabelMeta>): string {
  return buildOfflinePackDisplayLabel(meta).slice(0, 80) || 'Offline Pack';
}

// The builder page's allowanceMessageForReason — its words, unchanged.
export function allowanceMessageForReason(reason: string | null | undefined, allowance: Allowance | null): string {
  const limit = allowance && allowance.downloads_per_course != null ? Number(allowance.downloads_per_course) : null;
  switch (String(reason || '').trim()) {
    case 'not_subscribed':
      return 'You do not currently have an active eligible subscription for this course.';
    case 'not_included':
      return 'Offline packs are not included in your package.';
    case 'renew_required':
      return 'Your course subscription exists but is not currently active. Please renew before downloading offline packs.';
    case 'trial_not_allowed':
      return 'Offline packs are not available on trial access.';
    case 'limit_reached':
      return limit === null
        ? 'You have used your offline pack allowance for this course.'
        : `You have already used your ${limit} offline pack allowance for this course in the current subscription period.`;
    case 'allowance_check_failed':
      return 'We could not confirm your allowance right now. Please try again.';
    default:
      return 'This offline pack cannot be created right now.';
  }
}

const TYPE_LABEL: Record<string, string> = { MCQ: 'Single answer', SATA: 'Select all that apply', TF: 'True / False' };

/**
 * What was picked, in a line (07.8, 07.5): the topics (or the keyword), then
 * any difficulty or type — the pack's page and the PDF's cover say the same.
 */
export function pickedWords(p: Pick<MyPack, 'selection_mode' | 'concept_query' | 'maintopics' | 'difficulties' | 'question_types'>): string {
  const what =
    p.selection_mode === 'concept' && p.concept_query
      ? `Keyword “${p.concept_query}”${p.maintopics?.length ? ` in ${p.maintopics.join(', ')}` : ''}`
      : p.maintopics?.length
        ? p.maintopics.join(', ')
        : 'All topics';
  const parts = [what];
  if (p.difficulties?.length) parts.push(p.difficulties.join(', '));
  if (p.question_types?.length) parts.push(p.question_types.map((t) => TYPE_LABEL[t] || t).join(', '));
  return parts.join(' · ');
}
