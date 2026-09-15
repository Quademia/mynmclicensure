# Payments

## What the Payment System Does

Students pay to get access to QAcademy's question banks and study tools. A payment buys a product — for example "RN Premium 30 Days" — which gives the student a subscription that unlocks specific courses for a set number of days.

Payments are processed through Paystack, a payment gateway widely used in Ghana that supports mobile money and card payments.

## Two Payment Flows

### Flow A — New Student (No Account Yet)

This is the most common flow. A student who has never used QAcademy before:

1. Visits the subscribe page on the website
2. Fills in their email address, phone number, programme, and picks a product
3. Clicks Pay — the page redirects them to Paystack to complete payment
4. After paying, Paystack sends them back to the payment confirmation page
5. The system checks with Paystack that the payment actually went through
6. If a QAcademy account already exists for that email — the subscription is activated immediately
7. If no account exists yet — the page shows a short setup form
8. The student fills in their name, creates a password, and confirms their programme
9. The system creates their account and activates their subscription
10. The student can now log in and start studying

We capture the student's email before they have an account because Paystack needs an email to process the payment. The account is created afterwards, on the confirmation page.

### Flow B — Existing Student Upgrading

A student who already has an account and wants to buy more access:

1. Logs in and goes to the upgrade page
2. Picks a product
3. Gets redirected to Paystack to pay
4. Returns to the payment confirmation page
5. The system verifies the payment and activates the subscription immediately

No setup form is needed because the student already has an account.

## Payment Statuses

Every payment goes through a series of statuses:

- **INIT** — the payment has been started. The student clicked Pay and was sent to Paystack, but we have not heard back yet. This is the starting point for every payment.
- **PAID** — Paystack confirmed the money came through, but we have not activated the student's subscription yet. This usually resolves within seconds, but can get stuck if something goes wrong during activation.
- **SETUP_REQUIRED** — the payment is confirmed and the money is received, but there is no QAcademy account for this email address. The student needs to complete the setup form on the confirmation page to create their account.
- **ACTIVATED** — everything is done. The payment is confirmed, the account exists, and the subscription is active. The student has access.
- **FAILED** — something went wrong. This could be an amount mismatch, a Paystack error, or a technical problem. Admin needs to investigate.

## The Setup Token

When a payment lands in SETUP_REQUIRED, the system generates a setup token — think of it as a secret ticket that proves "this person paid, and they are allowed to create an account."

The setup token exists because at this point there is no logged-in session — the student does not have an account yet. The token is the only thing linking the payment to the person sitting at the confirmation page.

**Why it expires:** The token is valid for 48 hours. After that, it stops working. This is a security measure — if someone bookmarks the setup link and comes back weeks later, or if the link is shared, the expired token prevents misuse.

**What happens if it expires:** The student contacts support. Admin clicks Retry Activation on the payment row, which generates a fresh token with a new 48-hour window. Admin then copies the new setup link and sends it to the student.

## How Admin Recovers a Stuck Payment

Sometimes a payment gets stuck — the student closed the page, lost internet, or something went wrong technically. Here is how admin fixes it:

1. Go to **Admin → Payments** and find the stuck payment row
2. Look at the status:
   - **PAID** means the money came through but the subscription was not activated. Click **Retry Activation** — this tells the system to try activating again. If the student has an account, it will activate. If not, it moves to SETUP_REQUIRED.
   - **SETUP_REQUIRED** means the money is confirmed but the student has not created their account yet. Click **Retry Activation** first — this refreshes the setup token (giving a new 48-hour window). Then click **Copy Setup Link** to get the link, and send it to the student via WhatsApp or email.

The correct rescue sequence is always: **Retry Activation first**, then **Copy Setup Link**. Retry Activation is what refreshes the token — if you copy the link before retrying, you might send an expired link.

## Subscription Extension

If a student pays for a product they already have an active subscription for, the system does not create a duplicate. Instead, it extends the existing subscription by adding the new product's duration onto the current expiry date.

For example: a student has 10 days left on their RN Premium subscription and buys another 30-day RN Premium. Their subscription is extended to 40 days from today. No days are lost.

## Security

The payment system is designed to keep sensitive information safe:

- **Why a separate worker exists:** The payment worker runs on Cloudflare's servers, not in the student's browser. This is where the Paystack secret key and the Supabase admin key live. These keys never touch the browser — they stay on the server.
- **CORS protection:** The worker only accepts requests from the QAcademy website (qacademy-gamma.pages.dev). Requests from any other website are rejected. If the allowed origin is not configured, all requests are rejected as a safety measure.
- **Rate limiting:** Each IP address can make at most 5 requests per 60 seconds to the payment endpoints. This prevents automated abuse. Normal students making one payment at a time will never hit this limit.
- **Token expiry:** Setup tokens expire after 48 hours. Old tokens cannot be reused. Every time admin clicks Retry Activation, a completely new token is generated.
