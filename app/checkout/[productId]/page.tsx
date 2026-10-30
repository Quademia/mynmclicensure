// app/checkout/[productId]/page.tsx — the checkout (02 C4, 2026-09-23).
//
// One route for every product (Sam, 2026-09-22): every money shape here
// is "buy one product by id", so there is no checkout per category. Both
// selling pages' Continue buttons land here.
//
// TWO BUYERS, ONE PAGE. "Upgrade" is who you are, not what you buy (Sam,
// 2026-09-22):
//   - signed out — email, the same email again, WhatsApp number and
//     programme, then init-public. The programme is prefilled from the
//     product when the product belongs to exactly one, and stays
//     editable: it becomes the ACCOUNT's programme, and D23 item 1 lets
//     anyone buy any product. All four are required (Sam, 2026-09-23) —
//     the number because it is how a payer is reached, and Paystack does
//     not hand back the one it takes for mobile money.
//   - signed in — no form. The account's email is shown and the payment
//     goes to that account through init-upgrade, which runs the full
//     student gate itself.
//
// The layout is MyNclex's checkout (Sam, 2026-09-23): the package and the
// details on the left, the order summary with Pay and "What happens next"
// on the right — see checkout-form.tsx for what was and was not carried.
//
// After Pay, nothing is new: Paystack, then /payment-confirmation as it
// stands, setup form included. The account-at-payment work (D31, D33) and
// the confirmation page's own rate limit (D35) are separate slices.
//
// ⚠ COURSE ROWS ARE READ WITH THE SERVICE ROLE, as on both selling pages:
// `courses_select` is `auth.uid() is not null`, so a signed-out visitor
// reads nothing from `courses` — no titles for the card, and no scope to
// prefill the programme from.
//
// ⚠ "NOT FOR SALE" IS DECIDED BY isForSale(), the same rule the server's
// init doors now apply. A trial, a free product, an archived one and an
// unknown id all get the same plain message; the page does not say which.

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { findProfileByAuthId } from '@/lib/auth/profile';
import { getCourses, getOpenPrograms, getProducts } from '@/lib/catalogue/queries';
import { courseScopeMap, isForOpenProgramme, isForSale, programmesOf } from '@/lib/catalogue/for-sale';
import { formatMinor } from '@/lib/money/format-minor';
import { PublicTopBar } from '@/components/shell/public-top-bar';
import { PublicFooter } from '@/components/shell/public-footer';
import { ProductCard } from '@/components/catalogue/product-card';
import type { ServerSupabaseClient } from '@/lib/access';
import { planPurchase, type PurchasePlan } from '@/lib/subscriptions/access-rows';
import { CheckoutForm } from './checkout-form';
import '@/styles/checkout.css';

export const metadata: Metadata = {
  title: 'Checkout | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

/**
 * The signed-in buyer, or null. Softer than requireStudent(): a visitor
 * with no session is a buyer too, so nothing here redirects. A profile
 * that is missing or deactivated is treated as signed out — the upgrade
 * door would refuse it anyway.
 */
async function signedInBuyer(
  supabase: ServerSupabaseClient,
): Promise<{ userId: string; email: string; programId: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await findProfileByAuthId(supabase, user.id);
  if (!profile || profile.active === false) return null;
  return { userId: profile.user_id, email: profile.email, programId: profile.program_id ?? '' };
}

function dayMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * The words before Pay for a signed-in buyer (02, Premium goes first):
 * when the new days begin and what they pause, by the same packing the
 * payment will run. Null when they simply begin now and pause nothing.
 */
function startsNote(plan: PurchasePlan | null, productName: string): { text: string; startsLater: string | null } | null {
  if (!plan) return null;
  if (plan.waits_for) {
    const on = dayMonthYear(plan.start_utc);
    return { text: `Starts ${on}, when your ${plan.waits_for} ends.`, startsLater: on };
  }
  if (!plan.pauses.length) return null;
  const pauses = plan.pauses.map(
    (p) =>
      `Your ${p.product_name} pauses today, and its ${p.days_left} day${p.days_left === 1 ? '' : 's'} left continue on ${dayMonthYear(p.resumes_utc)}, when ${productName} ends.`,
  );
  return { text: ['Starts today.', ...pauses].join(' '), startsLater: null };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const wanted = decodeURIComponent(productId).trim().toUpperCase();

  const supabase = await createClient();
  const [programs, products, courses, buyer] = await Promise.all([
    // Open to the public only (02 C5a): the chooser and "every programme"
    // count what a visitor may choose.
    getOpenPrograms(supabase),
    getProducts(supabase),
    getCourses(createServiceRoleClient()),
    signedInBuyer(supabase),
  ]);

  // For sale, and for an open programme (02 C5a) — the server's two
  // payment doors ask the same.
  const openIds = programs.map((p) => p.program_id);
  const product =
    products.find(
      (p) => p.product_id.toUpperCase() === wanted && isForSale(p) && isForOpenProgramme(p, courseScopeMap(courses), openIds),
    ) ?? null;

  // "Change package" goes back to the page the buyer most likely came from.
  const backHref = product?.is_premium ? '/premium-prep' : '/subscribe';

  if (!product) {
    return (
      <div className="chk-page">
        <PublicTopBar />
        <main className="chk">
          <h1>Checkout</h1>
          <div className="card chk-empty">
            <p>This package isn&apos;t available to buy.</p>
            <Link href="/subscribe" className="btn btn-accent">
              See every package
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const plan = buyer ? await planPurchase(createServiceRoleClient(), buyer.userId, product.product_id, product.duration_days).catch((err) => {
    console.error('checkout planPurchase:', err);
    return null;
  }) : null;
  const starts = startsNote(plan, product.name);

  const courseTitle = new Map(courses.map((c) => [c.course_id, c.title]));
  const forProgrammes = programmesOf(product, courseScopeMap(courses), programs.length);
  const defaultProgram = forProgrammes.length === 1 ? forProgrammes[0] : '';
  const buyerProgram = buyer
    ? programs.find((p) => p.program_id === buyer.programId)?.program_name || buyer.programId
    : '';

  return (
    <div className="chk-page">
      <PublicTopBar />

      <main className="chk">
        <h1>Checkout</h1>

        <CheckoutForm
          changeHref={backHref}
          productId={product.product_id}
          productName={product.name}
          durationDays={product.duration_days}
          amountLabel={formatMinor(product.price_minor, product.currency)}
          programs={programs.map((p) => ({ id: p.program_id, name: p.program_name || p.program_id }))}
          defaultProgram={defaultProgram}
          buyer={buyer ? { email: buyer.email, programName: buyerProgram } : null}
          startsNote={starts?.text ?? null}
          startsLater={starts?.startsLater ?? null}
        >
          {/* h3: under the page's h1 and the section's "Your package" h2. */}
          <ProductCard
            product={product}
            courseTitle={courseTitle}
            headingLevel={3}
            as="div"
            withContinue={false}
          />
        </CheckoutForm>
      </main>

      <PublicFooter />
    </div>
  );
}
