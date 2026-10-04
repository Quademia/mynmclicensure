# 01 — Accounts and sign-in

How a person gets one account and signs in; how devices, lockouts and
passwords work; and the admin's security pages. What the account holds
on top of the free account — the trial or a package — is in 03 and 02.

Detail and history: `archive/product-plan/04-access-control.md`,
`archive/product-plan/rebuild.md` §10, and Sam's ten auth rulings of
2026-09-18 in `archive/product-plan/post-rebuild-diagnosis.md`.

## How it works

### One account, three ways in

- **Registering grants nothing by itself** (Sam, 2026-10-04). The
  student chooses one of three: **a free account**, **the trial**, or
  **a package**. It is one account in all three, the free account
  always underneath (03).
- **The trial's door is today's register page**, reached from a trial
  card; the free account's door and the screens come with the
  redesign and the home page (03 F3).
- **The package's door is checkout**: the buyer pays first and the
  payment makes the account (02, D31).
- **Free Full Access** is only ever the admin's grant (02).
- **Two roles**, student and admin; any other is refused at sign-in. An
  admin passes every student gate. After sign-in each lands on their
  own dashboard.

### Registering

- One step on the server: the login is made, the profile written, the
  grant (if any), the welcome email; then a "now sign in" screen. If
  the profile fails, the login is removed.
- **A school is required**, picked from the regulator's list; "My
  school isn't listed" is allowed, and an admin matches the typed name
  later (10, D50). The student can change school on the profile at any
  time.
- **A programme not Open to the public is refused** (02 C5a, built
  2026-10-04): "This programme is not open yet."
- **The email is lowercased and unique.** The student's own browser may
  change only the profile's fields. **The phone number is changed
  through the server**, which clears its verification (03; 12, `users`).
  *(to build: F4b)*

### Signing in

- **Three doors**: email and password, Google, and an email link. A
  wrong password says "Invalid email or password", never whether the
  account exists. A sign-in with no profile here says so and signs out;
  Google and the email link never make a profile.
- **A deactivated account is refused at sign-in** with "This account
  has been deactivated", logged as a refusal so the admin can see it.
  *(to build)*
- **Lockout**: 5 failures in 10 minutes or 10 in 24 hours, counted on
  the email, the device and the address; per address 20 in 10 minutes,
  50 in 24 hours. Password resets 3 an hour per email. If the check
  itself fails, sign-in is refused with "try again"; the log never
  blocks a sign-in.
- **Every attempt is logged** — the email, the outcome and reason, a
  hashed device fingerprint, a hashed address, the time.

### Devices

- **At most two devices live**; a third sign-in signs out the oldest.
  A device lasts 7 days. Rows are never deleted, only marked inactive.
  Each device is labelled ("Windows · Chrome").
- **A device signed out in the middle of a sitting finishes that
  sitting**; the next page refuses it (Sam, 2026-09-18). *(to build: 6)*

### Passwords

- Forgot password answers the same whether or not the email is known.
- **After a reset the student is signed in straight away** (Sam,
  2026-09-18). *(to build: 8)*
- The reset, email-link and invite emails come from the app in
  Quademia's own templates (10). *(to build)*

### For the admin

- **Invite by email**, in place of Create User (Sam, 2026-09-18): a
  student or an admin, an optional package; the invitee sets a password
  from the link and finishes the profile on arrival; inviting an admin
  is type-to-confirm. *(to build)*
- **Last sign-in** — written at every sign-in, shown in the Users
  drawer, a filter for dormant accounts on the Users list. *(to build)*
- **A Security page, done fully** (Sam, 2026-09-18: "we do it fully if
  we are doing it"). *(to build)*
  - **Sessions** — a panel in the Users drawer and a list across the
    platform, Revoke on every live row.
  - **Login events** — filters by email, person, outcome and date;
    Lift the block.
  - **Reset requests** — Send reset link on every row; Lift the block;
    the admin's own sends logged.

### One Quademia account

- The sign-in table is shared by all of Quademia's apps (Sam,
  2026-09-15). Register offers "sign in to add this product" to an email
  already known; a sign-in with no profile here offers "complete your
  profile". Before MyTeacher copies this register page. *(to build)*

### Who can read what

- A student reads only their own rows. The sign-in log, the reset
  requests and the lockout counters are invisible to the browser;
  devices are readable by their owner and an admin.

## Open

- **Email confirmation at sign-up** — parked under the port's "like for
  like" rule, which ended on 2026-09-16; the email work (10) already
  allows for it. To re-rule.
- **The sign-in check's round trips** — six before a protected page
  shows (D28); the fix is in code, waiting only on Sam's word.
- **A phone number format check** on register, checkout and profile —
  any 9 digits are taken today (10-03, unruled); the trial's verified
  number already uses one form (03).
