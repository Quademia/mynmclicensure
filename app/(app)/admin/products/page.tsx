// app/(app)/admin/products/page.tsx — legacy admin/products.html.
//
// The server half: the gate, then the three lists the page loaded on
// init — every product (archived included), the ACTIVE courses (the
// picker) and the programmes (the picker's group headers) — handed to
// the client half, which is the page's script.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { getAllProducts, getCourses, getPrograms } from '@/lib/catalogue/queries';
import { PageHeader } from '@/components/shell/page-header';
import { ProductsClient } from './products-client';
import '@/styles/admin-catalogue.css';

export const metadata: Metadata = {
  title: 'Products | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const { supabase } = await requireAdmin();
  const [products, courses, programs] = await Promise.all([
    getAllProducts(supabase),
    getCourses(supabase),
    getPrograms(supabase),
  ]);

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Manage subscription products and course bundles"
      />
      <ProductsClient products={products} courses={courses} programs={programs} />
    </>
  );
}
