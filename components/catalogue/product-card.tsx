// components/catalogue/product-card.tsx — one package for sale (DS20).
//
// The card /premium-prep and /subscribe each used to write for itself,
// under `.prep-*` and `.subp-*`, line for line the same (2026-09-22).
// One copy now, on the design system's `.card`; the checkout is its
// third user. Styles in styles/components.css.
//
// A Server Component, like both pages that render it: nothing here
// holds state, so nothing hydrates. The Continue button is a link.
//
// The checkout (02 C4) shows the one product being bought: a single
// card, not a list item, and no Continue — the page's own Pay button is
// the way on. Hence `as` and `withContinue`.

import Link from 'next/link';
import { formatMinor } from '@/lib/money/format-minor';
import type { Product } from '@/lib/catalogue/types';

export function ProductCard({
  product,
  courseTitle,
  headingLevel,
  as = 'li',
  withContinue = true,
}: {
  product: Product;
  /** course_id → title. An id with no title falls back to the id. */
  courseTitle: Map<string, string>;
  /** The page's outline decides it: h2 under the page title on
   *  /premium-prep, h3 under a band heading on /subscribe. */
  headingLevel: 2 | 3;
  /** 'li' inside a grid of cards; 'div' for the checkout's one card. */
  as?: 'li' | 'div';
  withContinue?: boolean;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const Box = as;
  const titles = product.courses
    .map((id) => courseTitle.get(id) ?? id)
    .sort((a, b) => a.localeCompare(b));

  return (
    <Box className="card product-card">
      <Heading className="product-card-name">{product.name}</Heading>

      <p className="product-card-price">
        <span className="product-card-amount">
          {formatMinor(product.price_minor, product.currency)}
        </span>
        <span className="badge badge-neutral">{product.duration_days} days</span>
      </p>

      <p className="product-card-unlocks">
        Unlocks {titles.length} course{titles.length === 1 ? '' : 's'}
      </p>
      <ul className="product-card-courses">
        {titles.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>

      {withContinue ? (
        <Link
          href={`/checkout/${product.product_id}`}
          className="btn btn-accent btn-lg product-card-cta"
        >
          Continue
        </Link>
      ) : null}
    </Box>
  );
}
