// app/(app)/student/messages/page.tsx — the student's Messages (slice 12a's
// page on 08.2's rules).
//
// The server half: the gate, the student's active courses (the thread
// labels, the course card and "+ New"'s course picker) and their threads
// with their latest message, handed to the client half. A message from
// another page goes through the "Message us" box there (08.2), so this
// page takes nothing from the address.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { getStudentThreads } from '@/lib/messaging/queries';
import { MessagesClient } from './messages-client';
import '@/styles/student-messages.css';

export const metadata: Metadata = {
  title: 'Messages | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentMessagesPage() {
  const { supabase, profile } = await requireStudent();

  const [courses, threads] = await Promise.all([getCourses(supabase), getStudentThreads(supabase, profile.user_id)]);

  return (
    <MessagesClient
      student={{ name: profile.forename || profile.name || 'Student', avatarUrl: profile.avatar_url }}
      courses={courses.map((c) => ({ course_id: c.course_id, title: c.title }))}
      initialThreads={threads}
    />
  );
}
