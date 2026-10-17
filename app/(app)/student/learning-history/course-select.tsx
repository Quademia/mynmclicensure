// app/(app)/student/learning-history/course-select.tsx — the course
// dropdown above the figures (Sam, 2026-10-17, in place of the chips: one
// line however many courses and however long their names). "All courses"
// is chosen to start. A choice moves to ?course=, so the figures and the
// list come back together and the way back works; while the page is on its
// way the box says "Loading…" (a tap is never silent). The page keys this
// on the course, so the box starts again from the page's choice.

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { HistoryCourse } from '@/lib/history/types';

const HISTORY_PATH = '/student/learning-history';

export function CourseSelect({ courses, courseId }: { courses: HistoryCourse[]; courseId: string }) {
  const router = useRouter();
  const [chosen, setChosen] = useState(courseId);
  const [pending, startTransition] = useTransition();

  function pick(id: string) {
    setChosen(id);
    startTransition(() => router.push(id ? `${HISTORY_PATH}?course=${encodeURIComponent(id)}` : HISTORY_PATH));
  }

  return (
    <form className="lh-course" method="get" action={HISTORY_PATH} onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="lhCourse">Course</label>
      <div className="lh-course-row">
        <select id="lhCourse" name="course" value={chosen} aria-busy={pending} onChange={(e) => pick(e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.course_id} value={c.course_id}>
              {c.title}
            </option>
          ))}
        </select>
        {pending ? <span className="lh-course-wait">Loading…</span> : null}
        <noscript>
          <button type="submit" className="btn btn-ghost">
            Show
          </button>
        </noscript>
      </div>
    </form>
  );
}
