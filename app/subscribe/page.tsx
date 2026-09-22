// app/subscribe/page.tsx — the shop.
//
// Rebuilt 2026-09-22 (Sam) on the design system, replacing the legacy
// transcription of legacy/mynmclicensure/subscribe.html. What went: the
// email / phone / programme / product form, the four-bullet "How this
// paid flow works" explainer, and `subscribe-client.tsx` entire. The
// details are collected at checkout now, once a product is chosen.
//
// ⚠ NO CLIENT COMPONENT. Like /premium-prep: nothing here holds state,
// so nothing hydrates and the page contributes no bundle of its own.
// The programme chooser is LINKS, not a script — `?programme=RM` — which
// means it works before any script loads and the choice can be sent to
// someone in WhatsApp, which is how this product actually spreads.
//
// ── D23's rulings, built here (Sam, 2026-09-18) ──────────────────────
//
// item 1 — ANYONE MAY BUY ANY PRODUCT: the page adapts, it does not
// filter. Choosing a programme REORDERS — that programme's products
// first, then a divider, then everything else, still fully buyable.
// Nothing is removed. Sam confirmed the reading on 2026-09-22: "not
// selecting a program that determines what they will eventually buy …
// everything is on the page but something to narrow the ones you may
// probably want."
//
// item 2 — the programme a product is for is DERIVED from its courses,
// ignoring the courses every programme sits. In lib/catalogue/for-sale.ts.
//
// item 3 — ONE definition of "for sale", also in for-sale.ts, replacing
// the copy this page used to carry.
//
// item 5 — each sales row lists the courses it unlocks.
//
// ── The premium products are NOT in the grid (Sam, 2026-09-22) ───────
// They have their own page. A band at the foot links to it, so the shop
// is complete without listing them twice — D23 item 1 says nothing is
// hidden, and a link is not hiding.
//
// ⚠ THE COURSE ROWS ARE READ WITH THE SERVICE ROLE, and must be:
// `courses_select` is `auth.uid() is not null`, so a signed-out visitor
// reads nothing from that table. Without this the titles would be blank
// AND every product would derive as "everyone's", which would silently
// defeat the whole chooser. Opening that policy is the cleaner fix and
// needs its own §8 row; unruled as of 2026-09-22.

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getCourses, getPrograms, getProducts } from '@/lib/catalogue/queries';
import { courseScopeMap, isForSale, partitionByProgramme, programmesOf } from '@/lib/catalogue/for-sale';
import { formatMinor } from '@/lib/money/format-minor';
import { PublicTopBar } from '@/components/shell/public-top-bar';
import { PublicFooter } from '@/components/shell/public-footer';
import type { Product } from '@/lib/catalogue/types';
import '@/styles/subscribe.css';

export const metadata: Metadata = {
  title: 'Subscribe | MyNMCLicensure',
  description: 'Full access, single courses and exam-year packages for every NMC Ghana programme.',
};

export const dynamic = 'force-dynamic';

function ProductCard({
  product,
  courseTitle,
}: {
  product: Product;
  courseTitle: Map<string, string>;
}) {
  const titles = product.courses
    .map((id) => courseTitle.get(id) ?? id)
    .sort((a, b) => a.localeCompare(b));

  return (
    <li className="subp-card">
      <h3 className="subp-card-name">{product.name}</h3>

      <p className="subp-price">
        <span className="subp-amount">{formatMinor(product.price_minor, product.currency)}</span>
        <span className="badge badge-neutral">{product.duration_days} days</span>
      </p>

      <p className="subp-unlocks">
        Unlocks {titles.length} course{titles.length === 1 ? '' : 's'}
      </p>
      <ul className="subp-courses">
        {titles.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>

      <Link href={`/checkout/${product.product_id}`} className="btn btn-accent btn-lg subp-cta">
        Continue
      </Link>
    </li>
  );
}

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ programme?: string }>;
}) {
  const supabase = await createClient();
  const { programme } = await searchParams;

  const [programs, products, courses] = await Promise.all([
    getPrograms(supabase),
    getProducts(supabase),
    getCourses(createServiceRoleClient()),
  ]);

  // Only a programme that exists is honoured — an unknown one in the URL
  // falls back to "all", rather than producing an empty "yours" list
  // that reads as a broken page.
  const chosen = programs.find(
    (p) => p.program_id.toUpperCase() === String(programme ?? '').trim().toUpperCase(),
  );
  const chosenId = chosen?.program_id ?? null;

  const courseTitle = new Map(courses.map((c) => [c.course_id, c.title]));
  const scope = courseScopeMap(courses);

  // The shop is everything for sale that is not a Premium Prep product.
  const forSale = products.filter((p) => isForSale(p) && p.is_premium !== true);
  const programmesFor = (p: Product) => programmesOf(p, scope, programs.length);

  // Biggest bundle first inside each group, then by price — a student
  // sees the whole-programme package before the single courses.
  const ordered = [...forSale].sort(
    (a, b) => b.courses.length - a.courses.length || a.price_minor - b.price_minor,
  );
  const { mine, others } = partitionByProgramme(ordered, chosenId, programmesFor);

  return (
    <div className="subp-page">
      <PublicTopBar />

      <main className="subp">
        <header className="subp-hero">
          <h1>Choose your access</h1>
          <p className="subp-lede">
            Every package is open to every student — pick your programme and yours come first.
            You pay with Paystack, then set up your account on the page it brings you back to.
          </p>
        </header>

        <nav className="subp-chips" aria-label="Filter by programme">
          {/* Each chip carries BOTH its full name and its code, and the
              stylesheet shows one or the other. Below 768px the full
              names need four rows, and a sideways-scrolling row put the
              chip you had just chosen off-screen to the right — the page
              reloads scrolled to the left, so a student picking
              Midwifery saw "All programmes · NACNAP" and no sign of
              their choice. Codes wrap into two rows and the chosen one
              is always visible. Caught at 375px, 2026-09-22. */}
          <Link
            href="/subscribe"
            className={`subp-chip${chosenId ? '' : ' is-on'}`}
            aria-current={chosenId ? undefined : 'true'}
          >
            <span className="subp-chip-full">All programmes</span>
            <span className="subp-chip-short">All</span>
          </Link>
          {programs.map((p) => {
            const on = p.program_id === chosenId;
            return (
              <Link
                key={p.program_id}
                href={`/subscribe?programme=${encodeURIComponent(p.program_id)}`}
                className={`subp-chip${on ? ' is-on' : ''}`}
                aria-current={on ? 'true' : undefined}
                // The code alone is the visible label on a phone, so the
                // full name still reaches a screen reader and a tooltip.
                title={p.program_name || p.program_id}
              >
                <span className="subp-chip-full">{p.program_name || p.program_id}</span>
                <span className="subp-chip-short">{p.program_id}</span>
              </Link>
            );
          })}
        </nav>

        {mine.length === 0 && others.length === 0 ? (
          <p className="subp-empty">
            No packages are on sale at the moment. Please check back shortly.
          </p>
        ) : (
          <>
            {chosenId ? (
              <h2 className="subp-band">
                For {chosen?.program_name || chosenId}
                <span className="subp-count">
                  {mine.length} package{mine.length === 1 ? '' : 's'}
                </span>
              </h2>
            ) : null}

            <ul className="subp-grid">
              {mine.map((product) => (
                <ProductCard key={product.product_id} product={product} courseTitle={courseTitle} />
              ))}
            </ul>

            {others.length > 0 ? (
              <>
                {/* D23 item 1 made visible: the rest are still here, and
                    still buyable. A student changing programme, or buying
                    General Paper alone, is a real case. */}
                <h2 className="subp-band subp-band-other">
                  Other programmes
                  <span className="subp-count">
                    {others.length} package{others.length === 1 ? '' : 's'}
                  </span>
                </h2>
                <p className="subp-band-note">
                  These are open to you too — nothing here is restricted by programme.
                </p>
                <ul className="subp-grid">
                  {others.map((product) => (
                    <ProductCard
                      key={product.product_id}
                      product={product}
                      courseTitle={courseTitle}
                    />
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}

        <aside className="subp-note">
          <h2>Sitting the exam this year?</h2>
          <p>
            Premium Prep opens the same courses as Full Access for 240 days at{' '}
            {formatMinor(9900, 'GHS')} instead of {formatMinor(15000, 'GHS')}.{' '}
            <Link href="/premium-prep">See Premium Prep</Link>. Every student can also{' '}
            <Link href="/register">register free</Link> and start on a trial.
          </p>
        </aside>
      </main>

      <PublicFooter />
    </div>
  );
}
