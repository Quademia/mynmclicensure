// app/register/page.tsx — registering, the trial's door (01; 01.15, Sam
// 2026-10-31: the sign-in page's look, canvas
// https://claude.ai/artifact/5vmaSLpvdCZtyxKhchQCTU).
//
// The server half: the open programmes (order program_name) and the active
// listed schools (order region, name), both readable before sign-in, and
// the trial's days, read as on the home and sign-in pages. A suggested
// school is never shown with the listed ones (01). The only way-in wording
// is "Start your N-day trial" (Sam, 2026-10-05).

import type { Metadata } from 'next';
import { AppLink } from '@/components/shell/link-pending';
import { SignInFrame, TRIAL_DAYS_FALLBACK } from '@/components/sign-in/frame';
import { getPublicProgrammes } from '@/lib/catalogue/queries';
import { createClient } from '@/lib/supabase/server';
import { RegisterForm, type ProgramOption, type SchoolOption } from './register-form';

export const metadata: Metadata = {
  title: 'Start your trial | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const supabase = await createClient();

  const [programsRes, schoolsRes, { trialDays }] = await Promise.all([
    // Open to the public only (02 C5a); the action refuses any other.
    supabase.from('programs').select('program_id, program_name').eq('is_open', true).order('program_name'),
    supabase
      .from('schools')
      .select('id, name, region')
      .eq('active', true)
      .eq('status', 'listed')
      .order('region', { ascending: true })
      .order('name', { ascending: true }),
    getPublicProgrammes(),
  ]);
  const days = trialDays ?? TRIAL_DAYS_FALLBACK;

  const programs: ProgramOption[] = (programsRes.data ?? []).map((p) => ({
    program_id: p.program_id as string,
    program_name: p.program_name as string,
  }));
  const schools: SchoolOption[] = (schoolsRes.data ?? []).map((s) => ({
    id: s.id as number,
    name: s.name as string,
    region: s.region as string,
  }));

  return (
    <SignInFrame>
      <header className="si-head">
        <h1>Start your {days}-day trial.</h1>
        <p>Then free practice, forever. No card needed.</p>
      </header>

      <RegisterForm programs={programs} schools={schools} days={days} />

      {/* For someone who would rather pay now: Premium Prep first, then
          Standard Prep (Sam, 2026-10-31: B, as sign in). Buying makes the
          account at checkout, with no trial (01). */}
      <div className="si-foot">
        <p>
          Already have an account? <AppLink href="/login">Sign in</AppLink>
        </p>
        <p>
          Ready to buy? <AppLink href="/premium-prep">Get Premium Prep</AppLink>, best for the exam. Or{' '}
          <AppLink href="/subscribe">Standard Prep</AppLink>.
        </p>
      </div>
    </SignInFrame>
  );
}
