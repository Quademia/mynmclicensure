// app/(app)/student/upgrade/page.tsx — legacy student/upgrade.html
// (slice 9b).
//
// The server half: the gate, then what legacy's initPage loaded — the
// student's active subscriptions with their product names, the
// programmes (their trial ids hide the trial products) and the ACTIVE
// products — handed to the client half, which is the page's script.
// Legacy's page was a standalone card with its own topbar (the title,
// the subtitle, the user pill) and no sidebar; here it sits inside the
// student chrome, the card kept as it was, no .top-nav row (as the
// profile page kept its own header).

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getCourses, getPrograms, getProducts } from '@/lib/catalogue/queries';
import { courseScopeMap, isForOpenProgramme } from '@/lib/catalogue/for-sale';
import { getActiveSubscriptionsWithProduct } from '@/lib/subscriptions/queries';
import { UpgradeClient } from './upgrade-client';
import '@/styles/student-upgrade.css';

export const metadata: Metadata = {
  title: 'Upgrade Access | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function UpgradePage() {
  const { supabase, profile } = await requireStudent();

  const [subscriptions, programs, allProducts, courses] = await Promise.all([
    getActiveSubscriptionsWithProduct(supabase, profile.user_id),
    getPrograms(supabase),
    getProducts(supabase),
    getCourses(supabase),
  ]);

  // A closed programme's packages are not offered (02 C5a); the payment
  // door refuses them too.
  const openIds = programs.filter((p) => p.is_open).map((p) => p.program_id);
  const scope = courseScopeMap(courses);
  const products = allProducts.filter((p) => isForOpenProgramme(p, scope, openIds));

  return (
    <UpgradeClient
      profile={{
        name: profile.name,
        forename: profile.forename,
        surname: profile.surname,
        email: profile.email,
        program_id: profile.program_id,
      }}
      subscriptions={subscriptions}
      programs={programs}
      products={products}
    />
  );
}
