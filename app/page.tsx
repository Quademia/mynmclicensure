// app/page.tsx — the home page (03 F3), redesigned 2026-10-30: drawn by
// Claude Design from 11-pages' decisions and chosen by Sam (canvas "Home
// page": the programmes under the hero, Premium Prep standing out, the
// card drawings kept).
//
// In order: the hero — words only for now, one filled "Start your N-day
// trial" and Sign in (pictures later, Sam); the open programmes as one
// row of names; the plans row C (app/home-plans.tsx); the shared footer,
// which now carries the social links. Gone with the old page (the
// September port of the legacy index.html): the navy hero and its quiz
// drawing, the trial badge, the socials and stats strips, "Where do you
// start?", the programme cards, About the exam, What you get, How it
// works and the closing band — the page was eleven phone screens (11).
//
// Every number is read: the trial's days from the programmes' trial
// packages, the prices and days from the packages on sale. Three reads at
// once; the footer's programmes come from the same cached read.
// A Server Component — the links are the app's own (AppLink), nothing
// else hydrates.

import type { Metadata } from 'next';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getCourses, getPublicProgrammes } from '@/lib/catalogue/queries';
import { courseScopeMap } from '@/lib/catalogue/for-sale';
import { PublicTopBar } from '@/components/shell/public-top-bar';
import { PublicFooter } from '@/components/shell/public-footer';
import { AppLink } from '@/components/shell/link-pending';
import { HomePlans, getPlanProducts } from './home-plans';
import '@/styles/landing.css';

export const metadata: Metadata = {
  title: 'MyNMCLicensure | Quademia',
  description: 'Practise for the NMC Ghana licensure exam on your phone: exam-style questions for every programme, each with the reason behind the answer.',
};

export const dynamic = 'force-dynamic';

/** The decided trial (03 F4a), only if no trial package can be read. */
const TRIAL_DAYS_FALLBACK = 14;

export default async function HomePage() {
  const supabase = await createClient();
  // ⚠ Courses with the service role, as on the shop: a visitor reads
  // nothing from `courses` (AGENTS.md), and the open-programme check
  // needs each course's programmes.
  const [publicProgrammes, products, courses] = await Promise.all([
    getPublicProgrammes(),
    getPlanProducts(supabase),
    getCourses(createServiceRoleClient()),
  ]);
  const { programs, trialDays, trialQuizzes } = publicProgrammes;
  const days = trialDays ?? TRIAL_DAYS_FALLBACK;

  return (
    <div className="landing">
      <PublicTopBar />

      <main className="hp-main">
        <section className="hp-hero">
          <h1>Practise for the NMC licensure exam, on your phone.</h1>
          <p>
            Exam-style questions for every NMC Ghana programme, each with the reason behind the answer. Register and
            your {days}-day trial starts at once.
          </p>
          <div className="hp-hero-actions">
            <AppLink href="/register" className="btn btn-primary btn-lg">
              Start your {days}-day trial
            </AppLink>
            <AppLink href="/login" className="btn btn-outline btn-lg">
              Sign in
            </AppLink>
          </div>
        </section>

        {programs.length ? (
          <section className="hp-progs" aria-label="Open programmes">
            <p className="hp-progs-label">Open programmes</p>
            <ul>
              {programs.map((p) => (
                <li key={p.program_id}>{p.program_name}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <HomePlans
          products={products}
          courseScope={courseScopeMap(courses)}
          openIds={programs.map((p) => p.program_id)}
          trialDays={days}
          trialQuizzes={trialQuizzes}
        />
      </main>

      <PublicFooter />
    </div>
  );
}
