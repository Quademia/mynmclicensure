// app/register/page.tsx — legacy/mynmclicensure/register.html.
//
// The server half: loads the programme list (order program_name, as
// getPrograms()) and the active schools (order region, name) with the
// anon client — both tables are readable before login — and hands them
// to the form. The "Signing up for MyTeacher instead?" link is gone with
// the April split.

import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { RegisterForm, type ProgramOption, type SchoolOption } from './register-form';
import '@/styles/auth.css';

export const metadata: Metadata = {
  title: 'Register | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const supabase = await createClient();

  const [programsRes, schoolsRes] = await Promise.all([
    supabase.from('programs').select('program_id, program_name, trial_product_id').order('program_name'),
    supabase
      .from('schools')
      .select('id, name, region')
      .eq('active', true)
      .order('region', { ascending: true })
      .order('name', { ascending: true }),
  ]);

  // Trial length comes from products.duration_days — slice 8. Until then
  // the hint has nothing to say and stays hidden, as legacy does when the
  // days are unknown.
  const programs: ProgramOption[] = (programsRes.data ?? []).map((p) => ({
    program_id: p.program_id as string,
    program_name: p.program_name as string,
    trialDays: null,
  }));
  const schools: SchoolOption[] = (schoolsRes.data ?? []).map((s) => ({
    id: s.id as number,
    name: s.name as string,
    region: s.region as string,
  }));

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>Quademia</h1>
          <p>MyNMCLicensure</p>
        </div>

        <h2 className="auth-title">Create your account</h2>
        <p className="auth-subtitle">Join MyNMCLicensure today</p>

        <RegisterForm programs={programs} schools={schools} />

        <div className="auth-footer">
          Already have an account? <a href="/login">Sign in</a>
        </div>
      </div>
    </div>
  );
}
