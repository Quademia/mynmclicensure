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
  description: 'Practise for the NMC Ghana licensure exam the way you’ll sit it: exam-style questions for every programme, timed like the real paper, each with the reason behind the answer.',
};

export const dynamic = 'force-dynamic';

/** The decided trial (03 F4a), only if no trial package can be read. */
const TRIAL_DAYS_FALLBACK = 14;

// The hero's pictures (Sam, 2026-10-30: his Cloudinary photos, one a
// programme; the words stay still, only the picture fades — not a slider).
// Cloudinary sends each cut to 3:2, at its economy quality, only as wide
// as the screen needs (480 or 720px) and in the lightest format the phone
// takes: 10–80 KB each in place of up to 2 MB (measured 2026-10-30: the
// four at 720px, 159 KB). The first loads with the page; the rest after
// it, at low priority. The fade is the stylesheet's (styles/landing.css,
// .hp-shots): no JavaScript.
const HERO_PHOTOS: { path: string; alt: string }[] = [
  { path: 'v1767886112/NMC_2026_uwmvxq.png', alt: 'Nursing students making a hospital bed together' },
  { path: 'v1767885931/RM_dwdzvo.jpg', alt: 'Midwifery students practising on a newborn manikin' },
  { path: 'v1767885933/RPHN_tz9ncc.webp', alt: 'A public health nurse giving a vaccination at an outdoor clinic' },
  { path: 'v1767887854/RMHN_2_pdl5xu.png', alt: 'A mental health nurse comforting a patient' },
];
const CLOUDINARY = 'https://res.cloudinary.com/dbyufeays/image/upload';
const photoAt = (path: string, width: number) => `${CLOUDINARY}/f_auto,q_auto:eco,c_fill,ar_3:2,g_auto,w_${width}/${path}`;
const PHOTO_WIDTHS = [480, 720];

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
          <div className="hp-hero-inner">
            <div className="hp-hero-text">
              <h1>Practise for the NMC licensure exam the way you&apos;ll sit it.</h1>
              <p>
                Exam-style questions for every NMC Ghana programme, timed like the real paper, each with the reason
                behind the answer. On your phone, tablet or computer. Start with a {days}-day trial.
              </p>
              <div className="hp-hero-actions">
                <AppLink href="/register" className="btn btn-primary btn-lg">
                  Start your {days}-day trial
                </AppLink>
                <AppLink href="/login" className="btn btn-outline btn-lg">
                  Sign in
                </AppLink>
              </div>
            </div>
            <div className="hp-shots">
              {HERO_PHOTOS.map((photo, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- Cloudinary sizes and formats each picture itself; next/image would resize it a second time
                <img
                  key={photo.path}
                  className="hp-shot"
                  src={photoAt(photo.path, 720)}
                  srcSet={PHOTO_WIDTHS.map((w) => `${photoAt(photo.path, w)} ${w}w`).join(', ')}
                  sizes="(min-width: 960px) 520px, calc(100vw - 32px)"
                  alt={photo.alt}
                  width={720}
                  height={480}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'low'}
                  decoding="async"
                />
              ))}
            </div>
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
