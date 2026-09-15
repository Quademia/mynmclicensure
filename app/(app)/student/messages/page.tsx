// app/(app)/student/messages/page.tsx — legacy student/messages.html
// (slice 12a).
//
// The server half: the gate, then what legacy's boot loaded — the
// active courses (the thread labels and the course reference card)
// and the student's threads with their latest message — plus the deep
// link the course page ("Message us", a course id) and the runners
// ("Send feedback", the item, quiz and attempt ids and the quoted
// question) put in the address, handed to the client half, which is
// the page's script. The client opens or reuses the thread for a deep
// link and then clears the address, as legacy did.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { getStudentThreads } from '@/lib/messaging/queries';
import type { ThreadDeepLink } from '@/lib/messaging/types';
import { MessagesClient } from './messages-client';
import '@/styles/student-messages.css';

export const metadata: Metadata = {
  title: 'Messages | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

type Params = { course_id?: string; item_id?: string; quiz_id?: string; attempt_id?: string; ref?: string };

export default async function StudentMessagesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, profile } = await requireStudent();
  const params = await searchParams;

  const [courses, threads] = await Promise.all([getCourses(supabase), getStudentThreads(supabase, profile.user_id)]);

  const deepLink: ThreadDeepLink = {
    course_id: String(params.course_id || '').trim() || null,
    item_id: String(params.item_id || '').trim() || null,
    quiz_id: String(params.quiz_id || '').trim() || null,
    attempt_id: String(params.attempt_id || '').trim() || null,
    ref: params.ref ? String(params.ref) : null,
  };

  return (
    <MessagesClient
      studentInitial={(profile.name || profile.forename || 'S').charAt(0).toUpperCase()}
      courses={courses.map((c) => ({ course_id: c.course_id, title: c.title }))}
      initialThreads={threads}
      deepLink={deepLink}
    />
  );
}
