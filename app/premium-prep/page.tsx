// app/premium-prep/page.tsx — legacy/mynmclicensure/premium-prep.html.
//
// The server half: the programmes and the ACTIVE products, read with
// the anon client (both readable before login), handed to the client
// half, which is the page's two-step script. Which products are premium
// is `products.is_premium` since §8 S14 (2026-09-22); the legacy naming
// rule it replaced — the id ending `_2026_PREP` (Sam, 2026-09-11) —
// carried a year and would have expired in 2027. Which PROGRAMME a
// premium product belongs to is still read from its id; D23 item 2 rules
// the real answer and it belongs to the shop slice.

import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getPrograms, getProducts } from '@/lib/catalogue/queries';
import { PublicTopBar } from '@/components/shell/public-top-bar';
import { PublicFooter } from '@/components/shell/public-footer';
import { PremiumPrepClient } from './premium-prep-client';
import '@/styles/premium-prep.css';

export const metadata: Metadata = {
  title: 'NMC 2026 Premium Prep | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function PremiumPrepPage() {
  const supabase = await createClient();
  const [programs, products] = await Promise.all([getPrograms(supabase), getProducts(supabase)]);

  // The bar and the footer are Server Components rendered AROUND the
  // client half, not from inside it (2026-09-22): they ship no
  // JavaScript, and the footer reads the parent-site origin and the
  // clock on the server, where neither is a hydration risk.
  return (
    <div className="prep-page">
      <PublicTopBar />
      <PremiumPrepClient programs={programs} products={products} />
      <PublicFooter />
    </div>
  );
}
