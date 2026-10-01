// lib/attempts/links.ts
//
// 03 Q8 (Sam, 2026-09-27): a sitting has one address, `/session/<id>`,
// whatever its mode or state — the page reads the attempt and plays it,
// or shows its review once it is finished (MyNclex's
// `/session/[attempt_id]`). Before Q8 there were two pages, one per mode,
// and five places built the address, each with its own copy of the rule.
//
// And a sitting's home: where Exit, "Save & Resume Later", "Submit &
// Exit" and the button after submitting go — the page the sitting came
// from, not always Fixed Quizzes as legacy had it. A retake goes where
// the sitting it retakes came from (queries.ts `originSource`).
//
// No database here, so client pages can build the address.

export function sessionHref(attemptId: string): string {
  return `/session/${encodeURIComponent(attemptId)}`;
}

/** A finished sitting's review opened at question `n` (1-based) — the report's links (03 Q10). */
export function sessionQuestionHref(attemptId: string, n: number): string {
  return `${sessionHref(attemptId)}?q=${n}`;
}

/** A finished sitting's report (03 Q10, Sam 2026-09-30): its own page in the student area. */
export function reportHref(attemptId: string): string {
  return `/student/report/${encodeURIComponent(attemptId)}`;
}

/** The Quiz Builder opened on a course with one topic ticked — the report's "Practise this topic". */
export function builderTopicHref(courseId: string, topic: string): string {
  return `/student/quiz-builder?course=${encodeURIComponent(courseId)}&topic=${encodeURIComponent(topic)}`;
}

export type SessionHome = 'builder' | 'fixed' | 'mock';

export type SessionExit = { href: string; label: string };

export const SESSION_EXITS: Record<SessionHome, SessionExit> = {
  builder: { href: '/student/quiz-builder', label: 'Back to Quiz Builder' },
  fixed: { href: '/student/fixed-quizzes', label: 'Back to Fixed Quizzes' },
  mock: { href: '/student/mock-exams', label: 'Back to Mock Exams' },
};
