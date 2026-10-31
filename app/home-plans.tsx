// app/home-plans.tsx — the home page's plans row (03 F3; design C, Sam
// 2026-10-05; the page drawn by Claude Design and chosen 2026-10-30).
//
// Three cards — Trial, Standard Prep, Premium Prep — then the single
// courses line. The words are the ones approved on 2026-10-05
// (docs/home-page-plans-2026-10-05.html §3). Sam's 2026-10-30 choices on
// the drawing: Premium Prep stands out (its border, "Best for the exam",
// the row's filled button), and each card keeps its drawing.
//
// NOTHING HERE IS TYPED THAT THE ADMIN CAN CHANGE. Prices and days come
// from the packages on sale for an open programme ("from" when a tier's
// packages differ), the trial's days and builder quizzes from the trial
// packages, the packs a course from Standard Prep. A tier with nothing on
// sale shows no card. A feature not live comes off its card (11): the
// premium channel (17) is not built, so Premium Prep does not promise it,
// and "or Premium Prep" on the single courses line waits for a Premium
// single course to be on sale.
//
// The drawings are SVG written into the page — no picture files, so no
// extra downloads on a phone (Sam, 2026-10-30) — their colours the design
// system's tokens through classes (styles/landing.css, .hp-art). A
// Server Component: nothing here holds state.

import { AppLink } from '@/components/shell/link-pending';
import { isForOpenProgramme, isForSale } from '@/lib/catalogue/for-sale';
import type { ProductKind, ProductStatus } from '@/lib/catalogue/types';
import type { createClient } from '@/lib/supabase/server';
import { formatMinor } from '@/lib/money/format-minor';

type Db = Awaited<ReturnType<typeof createClient>>;

export type PlanProduct = {
  product_id: string;
  kind: ProductKind;
  status: ProductStatus;
  price_minor: number;
  currency: string;
  duration_days: number;
  is_premium: boolean;
  allow_packs_per_course: number | null;
  courses: string[];
};

/** The packages the row prices from — named columns, readable by a visitor. */
export async function getPlanProducts(db: Db): Promise<PlanProduct[]> {
  const { data, error } = await db
    .from('products')
    .select('product_id, kind, status, price_minor, currency, duration_days, is_premium, allow_packs_per_course, product_courses ( course_id )')
    .eq('status', 'active');
  if (error) {
    console.error('getPlanProducts:', error);
    return [];
  }
  type Row = Omit<PlanProduct, 'courses'> & { product_courses: { course_id: string }[] | null };
  return ((data ?? []) as unknown as Row[]).map(({ product_courses, ...p }) => ({ ...p, courses: (product_courses ?? []).map((c) => c.course_id) }));
}

type Price = { amount: string; from: boolean; days: number };

/** The cheapest package of a tier, "from" when its packages differ in price. */
function priceOf(list: PlanProduct[]): Price | null {
  if (!list.length) return null;
  const cheapest = list.reduce((low, p) => (p.price_minor < low.price_minor ? p : low));
  return {
    amount: formatMinor(cheapest.price_minor, cheapest.currency),
    from: new Set(list.map((p) => p.price_minor)).size > 1,
    days: cheapest.duration_days,
  };
}

function Tick() {
  return (
    <svg className="hp-tick" width="16" height="16" viewBox="0 0 16 16" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}

function Dash() {
  return (
    <svg className="hp-dash" width="16" height="16" viewBox="0 0 16 16" fill="none" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 8h8" />
    </svg>
  );
}

function Forever() {
  return (
    <svg className="hp-forever-mark" width="16" height="16" viewBox="0 0 16 16" fill="none" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.2 5.5C3.4 5.5 2 6.6 2 8s1.4 2.5 3.2 2.5C7.8 10.5 8.2 5.5 10.8 5.5 12.6 5.5 14 6.6 14 8s-1.4 2.5-3.2 2.5C8.2 10.5 7.8 5.5 5.2 5.5z" />
    </svg>
  );
}

function PriceLine({ price, fixed }: { price: Price | null; fixed?: { amount: string; days: number } }) {
  const shown = fixed ?? price;
  if (!shown) return null;
  return (
    <p className="hp-price">
      {price?.from ? <span className="hp-price-note">from</span> : null}
      <span className="hp-price-amount">{shown.amount}</span>
      <span className="hp-price-note">for {shown.days} days</span>
    </p>
  );
}

function Strip() {
  return (
    <p className="hp-strip">
      <Forever />
      <span>
        <strong>Free forever</strong> included, and kept when the package ends
      </span>
    </p>
  );
}

// ── the three drawings (Claude Design, 2026-10-30), 640 × 360 ─────────

function ArtPhone() {
  return (
    <svg className="hp-art" viewBox="0 0 640 360" aria-hidden="true">
      <rect className="a-bg" width="640" height="360" />
      <circle className="a-halo" cx="320" cy="210" r="150" />
      <rect className="a-navy" x="236" y="44" width="168" height="340" rx="24" />
      <rect className="a-white" x="246" y="56" width="148" height="328" rx="16" />
      <rect className="a-line" x="296" y="64" width="48" height="6" rx="3" />
      <rect className="a-line" x="262" y="84" width="116" height="6" rx="3" />
      <rect className="a-teal" x="262" y="84" width="52" height="6" rx="3" />
      <rect className="a-ink" x="262" y="106" width="116" height="8" rx="4" />
      <rect className="a-ink" x="262" y="120" width="96" height="8" rx="4" />
      <rect className="a-ink" x="262" y="134" width="72" height="8" rx="4" />
      <rect className="a-page s-line" x="262" y="158" width="116" height="30" rx="8" />
      <circle className="s-faint" cx="277" cy="173" r="6" fill="none" strokeWidth="1.5" />
      <rect className="a-faint" x="290" y="169" width="70" height="8" rx="4" />
      <rect className="a-bg s-teal" x="262" y="196" width="116" height="30" rx="8" strokeWidth="1.5" />
      <circle className="a-teal" cx="277" cy="211" r="6" />
      <path className="s-white" d="M274 211l2.2 2.2 4-4" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect className="a-teal-dark" x="290" y="207" width="60" height="8" rx="4" />
      <rect className="a-page s-line" x="262" y="234" width="116" height="30" rx="8" />
      <circle className="s-faint" cx="277" cy="249" r="6" fill="none" strokeWidth="1.5" />
      <rect className="a-faint" x="290" y="245" width="78" height="8" rx="4" />
      <rect className="a-page s-line" x="262" y="272" width="116" height="30" rx="8" />
      <circle className="s-faint" cx="277" cy="287" r="6" fill="none" strokeWidth="1.5" />
      <rect className="a-faint" x="290" y="283" width="54" height="8" rx="4" />
      <rect className="a-navy" x="262" y="316" width="116" height="30" rx="8" />
      <rect className="a-white" x="298" y="328" width="44" height="6" rx="3" />
      <circle className="a-teal s-bg" cx="424" cy="96" r="28" strokeWidth="6" />
      <path className="s-white" d="M411 96l8.5 8.5 17-17" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArtFolder() {
  return (
    <svg className="hp-art" viewBox="0 0 640 360" aria-hidden="true">
      <rect className="a-bg" width="640" height="360" />
      <circle className="a-halo" cx="320" cy="190" r="150" />
      <path className="a-navy-dark" d="M184 162a12 12 0 0 1 12-12h74l18 18h152a12 12 0 0 1 12 12v140a12 12 0 0 1-12 12H196a12 12 0 0 1-12-12z" />
      <g transform="rotate(-9 320 200)">
        <rect className="a-white s-line" x="246" y="74" width="140" height="180" rx="10" />
        <rect className="a-faint" x="266" y="98" width="86" height="8" rx="4" />
        <rect className="a-faint" x="266" y="114" width="100" height="8" rx="4" />
      </g>
      <g transform="rotate(6 320 200)">
        <rect className="a-white s-line" x="256" y="64" width="140" height="180" rx="10" />
        <rect className="a-faint" x="276" y="88" width="86" height="8" rx="4" />
        <rect className="a-faint" x="276" y="104" width="100" height="8" rx="4" />
      </g>
      <rect className="a-white s-line" x="250" y="52" width="140" height="190" rx="10" />
      <rect className="a-ink" x="270" y="76" width="100" height="8" rx="4" />
      <rect className="a-ink" x="270" y="92" width="72" height="8" rx="4" />
      <circle className="s-faint" cx="279" cy="124" r="6" fill="none" strokeWidth="1.5" />
      <rect className="a-faint" x="292" y="120" width="60" height="8" rx="4" />
      <circle className="a-teal" cx="279" cy="148" r="6" />
      <path className="s-white" d="M276 148l2.2 2.2 4-4" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect className="a-teal-dark" x="292" y="144" width="74" height="8" rx="4" />
      <circle className="s-faint" cx="279" cy="172" r="6" fill="none" strokeWidth="1.5" />
      <rect className="a-faint" x="292" y="168" width="52" height="8" rx="4" />
      <rect className="a-navy" x="184" y="196" width="272" height="124" rx="12" />
      <rect className="a-teal" x="208" y="226" width="96" height="8" rx="4" />
      <rect className="a-teal" x="208" y="244" width="64" height="8" rx="4" opacity="0.6" />
      <circle className="a-teal s-bg" cx="442" cy="300" r="30" strokeWidth="6" />
      <path className="s-white" d="M442 286v20M433 298l9 9 9-9M431 316h22" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArtStopwatch() {
  return (
    <svg className="hp-art" viewBox="0 0 640 360" aria-hidden="true">
      <rect className="a-bg" width="640" height="360" />
      <circle className="a-halo" cx="320" cy="190" r="150" />
      <rect className="a-white s-line" x="330" y="104" width="150" height="196" rx="12" />
      <rect className="a-ink" x="350" y="128" width="80" height="8" rx="4" />
      <rect className="a-faint" x="350" y="144" width="52" height="8" rx="4" />
      <rect className="a-line" x="350" y="172" width="110" height="10" rx="5" />
      <rect className="a-teal" x="350" y="172" width="88" height="10" rx="5" />
      <rect className="a-line" x="350" y="196" width="110" height="10" rx="5" />
      <rect className="a-teal" x="350" y="196" width="62" height="10" rx="5" />
      <rect className="a-line" x="350" y="220" width="110" height="10" rx="5" />
      <rect className="a-teal" x="350" y="220" width="98" height="10" rx="5" />
      <rect className="a-line" x="350" y="244" width="110" height="10" rx="5" />
      <rect className="a-teal" x="350" y="244" width="40" height="10" rx="5" />
      <rect className="a-navy" x="240" y="82" width="20" height="18" rx="4" />
      <rect className="a-navy" x="232" y="74" width="36" height="12" rx="5" />
      <circle className="a-navy" cx="250" cy="200" r="98" />
      <circle className="a-white" cx="250" cy="200" r="82" />
      <path className="a-bg" d="M250 200L250 128A72 72 0 0 1 312.4 236Z" />
      <path className="s-teal" d="M250 128A72 72 0 0 1 312.4 236" strokeWidth="8" fill="none" strokeLinecap="round" />
      <g className="s-faint" strokeWidth="3" strokeLinecap="round">
        <path d="M250 134v10" />
        <path d="M316 200h-10" />
        <path d="M250 266v-10" />
        <path d="M184 200h10" />
      </g>
      <path className="s-navy" d="M250 200L310 234" strokeWidth="5" strokeLinecap="round" />
      <circle className="a-teal" cx="250" cy="200" r="7" />
      <path className="a-teal" d="M408 36h100a14 14 0 0 1 14 14v38a14 14 0 0 1-14 14h-60l-24 20v-20h-16a14 14 0 0 1-14-14V50a14 14 0 0 1 14-14z" />
      <circle className="a-white" cx="436" cy="69" r="5" />
      <circle className="a-white" cx="458" cy="69" r="5" />
      <circle className="a-white" cx="480" cy="69" r="5" />
    </svg>
  );
}

// ── the row ───────────────────────────────────────────────────────────

export function HomePlans({
  products,
  courseScope,
  openIds,
  trialDays,
  trialQuizzes,
}: {
  products: PlanProduct[];
  /** course_id → the programmes it is in (courseScopeMap). */
  courseScope: Map<string, string[]>;
  openIds: string[];
  trialDays: number;
  trialQuizzes: number | null;
}) {
  const onSale = products.filter((p) => isForSale(p) && isForOpenProgramme(p, courseScope, openIds));
  const whole = onSale.filter((p) => p.courses.length > 1);
  const single = onSale.filter((p) => p.courses.length === 1);
  const standard = whole.filter((p) => !p.is_premium);
  const premium = whole.filter((p) => p.is_premium);
  const standardPrice = priceOf(standard);
  const premiumPrice = priceOf(premium);
  const singlePrice = priceOf(single);
  const premiumSingles = single.some((p) => p.is_premium);
  const packs = standard.map((p) => p.allow_packs_per_course).filter((n): n is number => typeof n === 'number');
  const packsPerCourse = packs.length === standard.length && packs.length ? Math.min(...packs) : null;

  return (
    <section className="hp-plans" id="plans" aria-labelledby="hp-plans-title">
      <div className="hp-plans-head">
        <span className="hp-kicker">Plans</span>
        <h2 id="hp-plans-title">Start your {trialDays}-day trial, then free practice, forever</h2>
        <p>No payment needed to start. You pick your programme when you register.</p>
      </div>

      <div className="hp-plans-grid">
        <article className="card hp-card">
          <ArtPhone />
          <div className="hp-card-head">
            <h3>Trial</h3>
            <p className="hp-card-tag">Try the real question bank</p>
            <PriceLine price={null} fixed={{ amount: 'GHS 0', days: trialDays }} />
          </div>
          <div className="hp-forever">
            <p className="hp-forever-title">
              <Forever />
              <span>Free forever</span>
            </p>
            <ul className="hp-list">
              <li><Tick /><span>Quizzes from the free questions in each of your courses</span></li>
              <li><Tick /><span>Learning and Untimed modes</span></li>
              <li><Tick /><span>Your history, reports and streak</span></li>
              <li><Tick /><span>The daily challenge and leaderboard</span></li>
            </ul>
          </div>
          <p className="hp-plus">Plus, for {trialDays} days:</p>
          <ul className="hp-list">
            <li><Tick /><span>All your programme&apos;s courses</span></li>
            <li><Tick /><span>One practice paper per course</span></li>
            <li><Tick /><span>{trialQuizzes ? `${trialQuizzes} Quiz Builder quizzes` : 'Quiz Builder quizzes'} from the full bank</span></li>
            <li><Tick /><span>Exam modes</span></li>
            <li className="hp-off"><Dash /><span>No mock exams or offline packs</span></li>
          </ul>
          <div className="hp-cta">
            <AppLink href="/trial" className="btn btn-outline btn-lg">
              Start your {trialDays}-day trial
            </AppLink>
            <p className="hp-cta-note">After {trialDays} days, Free forever stays.</p>
          </div>
        </article>

        {standardPrice ? (
          <article className="card hp-card">
            <ArtFolder />
            <div className="hp-card-head">
              <h3>Standard Prep</h3>
              <p className="hp-card-tag">Your whole programme, at your own pace</p>
              <PriceLine price={standardPrice} />
            </div>
            <Strip />
            <p className="hp-plus">While your package lasts:</p>
            <ul className="hp-list">
              <li><Tick /><span>All your programme&apos;s courses</span></li>
              <li><Tick /><span>Every practice paper</span></li>
              <li><Tick /><span>Unlimited Quiz Builder</span></li>
              <li><Tick /><span>Exam modes</span></li>
              {packsPerCourse !== 0 ? (
                <li><Tick /><span>{packsPerCourse ? `Offline packs, ${packsPerCourse} per course` : 'Offline packs'}</span></li>
              ) : null}
              <li><Tick /><span>Review and retake any sitting</span></li>
              <li className="hp-off"><Dash /><span>Mock exams come with Premium Prep</span></li>
            </ul>
            <div className="hp-cta">
              <AppLink href="/subscribe" className="btn btn-outline btn-lg">
                See packages
              </AppLink>
            </div>
          </article>
        ) : null}

        {premiumPrice ? (
          <article className="card hp-card hp-card-featured">
            <ArtStopwatch />
            <div className="hp-card-head">
              <div className="hp-card-titlerow">
                <h3>Premium Prep</h3>
                <span className="hp-flag">Best for the exam</span>
              </div>
              <p className="hp-card-tag">For the exam: mock exams</p>
              <PriceLine price={premiumPrice} />
            </div>
            <Strip />
            <p className="hp-plus">For {premiumPrice.days} days:</p>
            <ul className="hp-list">
              <li><Tick /><span>Everything in Standard Prep</span></li>
              <li><Tick /><span>Mock exams</span></li>
            </ul>
            <div className="hp-cta">
              <AppLink href="/premium-prep" className="btn btn-primary btn-lg">
                Get Premium Prep
              </AppLink>
            </div>
          </article>
        ) : null}
      </div>

      {singlePrice ? (
        <p className="hp-single">
          <span>
            <strong>Only need one course?</strong> Take it on its own, as Standard Prep{premiumSingles ? ' or Premium Prep' : ''}, from{' '}
            {singlePrice.amount}.
          </span>
          <AppLink href="/subscribe" className="hp-single-link">
            See single courses
          </AppLink>
        </p>
      ) : null}
    </section>
  );
}
