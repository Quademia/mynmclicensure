// app/(app)/student/messages/page.tsx — the student's Messages (slice 12a's
// page on 08.2's rules).
//
// The server half: the gate, the active courses (the threads' names and
// the course card), "+ New"'s course picker — the student's My courses
// list, the courses they hold, else their programme's (Sam, 2026-10-17) —
// and their threads
// with their latest message, handed to the client half. A message from
// another page goes through the "Message us" box there (08.2), so this
// page takes nothing from the address.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { getStudentThreads } from '@/lib/messaging/queries';
import { studentCourseList } from '@/lib/practice-papers/derive';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { MessagesClient } from './messages-client';
import '@/styles/student-messages.css';

export const metadata: Metadata = {
  title: 'Messages | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentMessagesPage() {
  const { supabase, profile } = await requireStudent();

  const [courses, access, threads] = await Promise.all([
    getCourses(supabase),
    getStudentCourseAccess(supabase, profile.user_id),
    getStudentThreads(supabase, profile.user_id),
  ]);
  const mine = studentCourseList(courses, access, profile.program_id ?? null);

  return (
    <MessagesClient
      student={{ name: profile.forename || profile.name || 'Student', avatarUrl: profile.avatar_url }}
      courses={courses.map((c) => ({ course_id: c.course_id, title: c.title }))}
      pickerCourses={mine.map((c) => ({ course_id: c.course_id, title: c.title }))}
      initialThreads={threads}
    />
  );
}
