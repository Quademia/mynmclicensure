// app/premium-prep/page.tsx — legacy/mynmclicensure/premium-prep.html.
//
// The server half: the programmes and the ACTIVE products, read with
// the anon client (both readable before login), handed to the client
// half, which is the page's two-step script. The match between a
// programme and its premium product is the legacy naming rule — the
// product id ends in `_2026_PREP` — carried as is (Sam, 2026-09-11).

import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getPrograms, getProducts } from '@/lib/catalogue/queries';
import { PremiumPrepClient } from './premium-prep-client';
import '@/styles/premium-prep.css';

export const metadata: Metadata = {
  title: 'NMC 2026 Premium Prep | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function PremiumPrepPage() {
  const supabase = await createClient();
  const [programs, products] = await Promise.all([getPrograms(supabase), getProducts(supabase)]);

  return <PremiumPrepClient programs={programs} products={products} />;
}
