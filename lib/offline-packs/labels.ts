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

import type { Allowance, PackLabelMeta } from './types';
import { OFFLINE_PACKS_PER_COURSE_DEFAULT } from './types';

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
  const limit =
    allowance && allowance.downloads_per_course != null ? Number(allowance.downloads_per_course) : OFFLINE_PACKS_PER_COURSE_DEFAULT;
  switch (String(reason || '').trim()) {
    case 'not_subscribed':
      return 'You do not currently have an active eligible subscription for this course.';
    case 'renew_required':
      return 'Your course subscription exists but is not currently active. Please renew before downloading offline packs.';
    case 'trial_not_allowed':
      return 'Offline packs are not available on trial access.';
    case 'limit_reached':
      return `You have already used your ${limit} offline pack allowance for this course in the current subscription period.`;
    case 'allowance_check_failed':
      return 'We could not confirm your allowance right now. Please try again.';
    default:
      return 'This offline pack cannot be created right now.';
  }
}

// The renderer's date: en-GB, "14 Sept 2026, 21:05" — legacy formatDate.
export function formatPackDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
