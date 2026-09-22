// app/premium-prep/page.tsx — the Premium Prep page.
//
// Rebuilt 2026-09-22 (Sam) on the design system, replacing the legacy
// transcription of legacy/mynmclicensure/premium-prep.html. What went:
// the two-step wizard, the search box over five items, the email /
// confirm-email / phone form, the "How this paid flow works" explainer,
// and `premium-prep-client.tsx` entire — 431 lines.
//
// ⚠ THE PAGE HAS NO CLIENT COMPONENT OF ITS OWN — nothing on it
// hydrates, and it contributes no page bundle. (Next's own runtime still
// loads for routing, so this is not "zero JavaScript"; it is no
// JavaScript of ours.) That matters because the audience is nursing
// students in Ghana, often on a phone on poor data. It falls out of
// Sam's own design rather than being engineered in — with no programme
// picker and no form, nothing here holds state. The cards are links.
//
// WHY THERE IS NO PROGRAMME PICKER (Sam, 2026-09-22): there is exactly
// one Premium Prep product per programme, so choosing the product IS
// choosing the programme. The old page asked twice. The programme is
// prefilled at checkout from the product, where it is shown and can be
// changed — it becomes the student's ACCOUNT programme, not a property
// of the order, and D23 item 1 lets anyone buy any product.
//
// ⚠ WHAT THIS PAGE MAY NOT SAY, until each is built:
//   - the Telegram study group (BUILD_LIST item 17, not built), which is
//     the only thing in the data Premium Prep has and Full Access does
//     not (telegram_group_keys on these five products alone);
//   - premium-only mock exams (`mock_quizzes.visibility` exists and
//     every row is still ALL — nothing reads the column);
//   - a larger offline-pack allowance (one global config number today,
//     `offline_packs_per_course`, the same for everyone).
// Sam ruled these are added to Premium Prep rather than taken from the
// others, and that the page ships on what is true and grows as each
// lands (2026-09-22). Until then the honest offer is the one below: the
// same courses as Full Access, for 240 days instead of 365, at GHS 99
// instead of GHS 150.
//
// ALL COPY HERE IS NEW AND IS SAM'S TO CHANGE. Nothing was transcribed;
// legacy's words were written for a form.

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getCourses, getProducts } from '@/lib/catalogue/queries';
import { formatMinor } from '@/lib/money/format-minor';
import { PublicTopBar } from '@/components/shell/public-top-bar';
import { PublicFooter } from '@/components/shell/public-footer';
import '@/styles/premium-prep.css';

export const metadata: Metadata = {
  // The year is gone from the title as it went from the product ids and
  // names (§8 S14): it dates the page every January.
  title: 'Premium Prep | MyNMCLicensure',
  description:
    'Exam-year access to your whole NMC programme — the same courses as Full Access, for less.',
};

export const dynamic = 'force-dynamic';

export default async function PremiumPrepPage() {
  const supabase = await createClient();

  // ⚠ THE COURSE TITLES ARE READ WITH THE SERVICE ROLE, and must be.
  // `courses_select` is `auth.uid() is not null` (db/rls.sql), so a
  // signed-out visitor reads NOTHING from that table — the first build of
  // this page silently printed raw ids ("NAC_BASIC_CLIN") because every
  // lookup missed and fell through to its fallback. D23 item 5 says a
  // sales row lists the courses it unlocks, and on a public page that is
  // impossible through the cookie client.
  //
  // Reading them here on the server keeps the table shut to the browser
  // while the page still says what it sells — the shape S12 used for
  // announcements. The alternative is opening `courses_select` to anon,
  // which is arguably right (a syllabus is not a secret, and the legacy
  // site showed it) but is a change to the storage floor and would need
  // its §8 row first. Put to Sam 2026-09-22; unruled.
  const [products, courses] = await Promise.all([
    getProducts(supabase),
    getCourses(createServiceRoleClient()),
  ]);

  const courseTitle = new Map(courses.map((c) => [c.course_id, c.title]));

  // is_premium is the marker since §8 S14; the price gate is the rule the
  // other two selling doors have always had and this page never did.
  const premium = products
    .filter((p) => p.is_premium === true && Number(p.price_minor) > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="prep-page">
      <PublicTopBar />

      <main className="prep">
        <header className="prep-hero">
          <p className="prep-eyebrow">NMC Licensure Exam Prep</p>
          <h1>Premium Prep</h1>
          <p className="prep-lede">
            Your whole programme, priced for exam year. The same courses as Full Access — for
            240 days instead of 365, at {formatMinor(9900, 'GHS')} instead of{' '}
            {formatMinor(15000, 'GHS')}.
          </p>
          <p className="prep-sub">
            Pick your programme below. You pay with Paystack, then set up your account on the
            page it brings you back to — there is no form to fill in first.
          </p>
        </header>

        {premium.length === 0 ? (
          <p className="prep-empty">
            No Premium Prep packages are on sale at the moment. Please check back, or{' '}
            <Link href="/subscribe">see the other packages</Link>.
          </p>
        ) : (
          <ul className="prep-grid">
            {premium.map((product) => {
              const titles = product.courses
                .map((id) => courseTitle.get(id) ?? id)
                .sort((a, b) => a.localeCompare(b));
              return (
                <li key={product.product_id} className="prep-card">
                  <h2 className="prep-card-name">{product.name}</h2>

                  <p className="prep-price">
                    <span className="prep-amount">
                      {formatMinor(product.price_minor, product.currency)}
                    </span>
                    <span className="badge badge-neutral">{product.duration_days} days</span>
                  </p>

                  <p className="prep-unlocks">
                    Unlocks {titles.length} course{titles.length === 1 ? '' : 's'}
                  </p>
                  <ul className="prep-courses">
                    {titles.map((title) => (
                      <li key={title}>{title}</li>
                    ))}
                  </ul>

                  <Link
                    href={`/checkout/${product.product_id}`}
                    className="btn btn-accent btn-lg prep-cta"
                  >
                    Continue
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <aside className="prep-note">
          <h2>Not sitting the exam this year?</h2>
          <p>
            Full Access opens the same courses for a full year at {formatMinor(15000, 'GHS')}, and
            single courses are {formatMinor(5900, 'GHS')} each.{' '}
            <Link href="/subscribe">See every package</Link>. Every student can also{' '}
            <Link href="/register">register free</Link> and start on a trial.
          </p>
        </aside>
      </main>

      <PublicFooter />
    </div>
  );
}
