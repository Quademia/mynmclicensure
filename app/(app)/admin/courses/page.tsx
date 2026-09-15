// app/(app)/admin/courses/page.tsx — legacy admin/courses.html.
//
// The server half: the gate, then every course (all statuses) and the
// programmes, handed to the client half, which is the page's script.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { getAllCourses, getPrograms } from '@/lib/catalogue/queries';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';
import { CoursesClient } from './courses-client';
import '@/styles/admin-catalogue.css';

export const metadata: Metadata = {
  title: 'Courses & Programmes | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminCoursesPage() {
  const { supabase, profile } = await requireAdmin();
  const [courses, programs] = await Promise.all([getAllCourses(supabase), getPrograms(supabase)]);

  return (
    <>
      <PageHeader
        title="Courses & Programmes"
        subtitle="Manage courses and nursing programmes"
        userName={displayNameOf(profile)}
      />
      <CoursesClient courses={courses} programs={programs} />
    </>
  );
}
