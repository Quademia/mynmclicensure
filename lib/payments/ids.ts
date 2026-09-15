// lib/payments/ids.ts
//
// The payments Worker's id makers, transcribed (rebuild.md §7.1):
//   QAC_ + 12 upper hex of a UUID   (payments.reference — the Paystack reference)
//   U_   + 10 upper hex of a UUID   (users.user_id for an account created at setup;
//                                    register.html made 'U_' + 16 hex — both kept,
//                                    as the two SUB_ makers are)
//   a bare 32-hex UUID              (payments.setup_token)
// Same prefixes, same lengths, same case, so a reference in a support
// conversation reads the same on both sides of the rebuild.

export function makePaymentReference(): string {
  const part = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  return `QAC_${part}`;
}

export function makePaymentUserId(): string {
  const part = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  return `U_${part}`;
}

export function makeSetupToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}
