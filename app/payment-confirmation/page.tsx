// app/payment-confirmation/page.tsx — legacy/mynmclicensure/payment-confirmation.html.
//
// Where Paystack sends the payer back (the callback address the two
// init actions hand to Paystack), and where the admin's setup link
// points (9b). Public — the payer has no session yet — and nothing is
// read on the server: the page's script verifies the reference from
// the address and drives everything from the reply.

import type { Metadata } from 'next';
import { ConfirmationClient } from './confirmation-client';
import '@/styles/payment-confirmation.css';

export const metadata: Metadata = {
  title: 'Payment Confirmation | MyNMCLicensure',
};

export default function PaymentConfirmationPage() {
  return <ConfirmationClient />;
}
