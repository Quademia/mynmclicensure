# Subscriptions

## What a Subscription Is

A subscription is what gives a student access to courses on QAcademy. When a student buys a product (like "RN Premium 30 Days"), a subscription is created that unlocks specific courses for a set number of days.

Without an active subscription covering a course, a student cannot start quizzes or access study material for that course. They can still log in and see their dashboard, but course content is gated behind a valid subscription.

## Product Kinds

Every product has a kind that determines how it works:

- **PAID** — a real purchase. The student pays money (via Paystack), gets a subscription that gives full access to the courses listed in that product for a set number of days.
- **TRIAL** — given automatically when a student registers. No payment needed. Gives limited access so the student can explore the platform before deciding to pay.
- **FREE** — no payment needed, access granted directly. Used for special promotions or courtesy access.

Important: the product kind describes how the product was obtained. The subscription itself is always either ACTIVE, EXPIRED, or CANCELLED — the status column never says "TRIAL."

## How Trial Works

When a new student registers on QAcademy, the platform automatically gives them a trial subscription:

1. Student fills in the registration form and picks their programme (e.g. RN)
2. The system looks up the trial product for that programme (e.g. RN_TRIAL)
3. A trial subscription is created and activated immediately
4. The student can now log in and explore

Each programme has its own trial product, so an RN student gets RN-specific trial content and an RM student gets RM-specific trial content.

Trial access covers a limited set of courses — enough to try some quizzes and get a feel for the platform, but not the complete course list. This is intentional: the trial is a taste, not the full meal.

## Stacked Subscriptions

A student may have multiple subscriptions over time. Perhaps they bought a 30-day plan, it is about to expire, and they buy another 30-day plan. Or an admin grants them extra days as a goodwill gesture.

When this happens, QAcademy adds up the remaining days across all active subscriptions that cover the same course. The expiry date the student sees is today plus that total.

**Example:** A student has an active subscription with 10 days left, and they buy another 30-day subscription for the same product. The system extends the existing subscription to 40 days from today. The student sees "40 days remaining" — no days are lost.

This stacking approach is fair to the student. If they pay early (before their current plan expires), they do not lose the remaining days on the old plan.

## Subscription Statuses

- **ACTIVE** — the subscription is currently valid. The student has access to the courses it covers.
- **EXPIRED** — the subscription's time ran out. The student no longer has access through this subscription. (They might still have access through a different active subscription.)
- **CANCELLED** — the subscription was manually stopped, usually by admin.
- **REVOKED** — removed by admin, typically for a policy reason such as a refund or a terms violation.

## How Access Is Checked

When a student opens a course, the system checks:

1. Find all this student's subscriptions
2. Filter to ones that are ACTIVE and have not expired yet
3. Check if any of those subscriptions cover the course the student is trying to open
4. If yes — the student gets access
5. If no — the student sees a prompt to upgrade their subscription

This check happens every time a student opens a course page. It is not cached, so if a subscription expires while the student is studying, they will see the upgrade prompt the next time they navigate.

## Admin Controls

Admins have full control over subscriptions:

- **Grant a subscription** — used for cash payments made outside Paystack, corrections, gifts, or sponsor arrangements. Admin picks the student, the product, and optionally a custom start date. If the student already has an active subscription for that product, it gets extended rather than duplicated.
- **Update a subscription** — change the start date, expiry date, status, source, or product. Useful for correcting mistakes or adjusting dates.
- **Revoke a subscription** — immediately removes access. The subscription status changes to REVOKED.
- **Sync expired subscriptions** — a manual button on the admin subscriptions page. It checks all ACTIVE subscriptions and flips any that have passed their expiry date to EXPIRED. This is run on each admin visit because the platform does not have automatic background jobs on the free tier.
