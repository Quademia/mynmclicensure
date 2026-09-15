// app/subscribe/page.tsx — legacy/mynmclicensure/subscribe.html.
//
// The public pay-first door (doc 01, flow A). The server half: the
// programmes and the ACTIVE products, read with the anon client (both
// readable before login), and whether a session is present — legacy's
// detectSignedInUser() showed the "use the Upgrade page" box for a
// signed-in visitor. The client half is the page's script.
//
// The "paid plans are paused" switch is lifted (Sam, 2026-09-11), so
// the paused panel is not rendered.

import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getPrograms, getProducts } from '@/lib/catalogue/queries';
import { SubscribeClient } from './subscribe-client';
import '@/styles/subscribe.css';

export const metadata: Metadata = {
  title: 'Subscribe | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function SubscribePage() {
  const supabase = await createClient();
  const [programs, products, userRes] = await Promise.all([
    getPrograms(supabase),
    getProducts(supabase),
    supabase.auth.getUser(),
  ]);

  return <SubscribeClient programs={programs} products={products} signedIn={!!userRes.data.user} />;
}
