// app/(app)/student/profile/page.tsx — legacy student/profile.html
// (slice 7e).
//
// The server half: the gate, then what legacy's boot loaded — the
// student's full row (the gate's profile is the whole row), the
// programmes (the Programme name), the active schools grouped by
// region (the picker), and the active subscription with its product
// (the Subscription panel) — plus the `?complete=1` flag the dashboard
// nudge passes — handed to the client half, which is the page's script
// (the three panels, the edit modes, the two saves).
//
// Legacy's profile page had no top-nav row: its header sat inside the
// 720px column ("My Profile" / "Your NMC Licensure account details"),
// with no sign-out on the page. Kept as it was.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getPrograms } from '@/lib/catalogue/queries';
import { getActiveSchools, getProfileSubscription } from '@/lib/profile/queries';
import { ProfileClient } from './profile-client';
import '@/styles/student-profile.css';

export const metadata: Metadata = {
  title: 'My Profile | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ complete?: string }> }) {
  const { supabase, profile } = await requireStudent();
  const { complete } = await searchParams;

  const [programs, schools, subscription] = await Promise.all([
    getPrograms(supabase),
    getActiveSchools(supabase),
    getProfileSubscription(supabase, profile.user_id),
  ]);
  const programName = programs.find((p) => p.program_id === profile.program_id)?.program_name ?? null;

  return (
    <ProfileClient
      profile={{
        forename: profile.forename,
        surname: profile.surname,
        name: profile.name,
        email: profile.email,
        phone_number: profile.phone_number,
        avatar_url: profile.avatar_url,
        program_id: profile.program_id,
        level: profile.level,
        cohort: profile.cohort,
        school_id: profile.school_id,
        school_other: profile.school_other,
      }}
      programName={programName}
      schools={schools}
      subscription={subscription}
      complete={complete === '1'}
    />
  );
}
