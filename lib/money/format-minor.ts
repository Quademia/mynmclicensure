// lib/money/format-minor.ts
//
// One money voice (AGENTS.md UI convention #4): amounts are stored as
// integer minor units and rendered as `GHS 150.00`, never `₵150`. The
// two decimals and the en-GB grouping are the legacy admin Products
// page's formatPrice(); the legacy Premium Prep page used a currency
// symbol instead, which the convention forbids.

export function formatMinor(minor: number | null | undefined, currency?: string | null): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return '—';
  const major = minor / 100;
  const amount = major.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cur = (currency || 'GHS').toUpperCase();
  return `${cur} ${amount}`;
}
