# 02 — Packages and payments

What is sold and to whom — programmes and packages — how a buyer pays
through Paystack, and how a payment or an admin's grant becomes access
to each course with its own end date. The trial's limits are in 03.

Detail and history: `archive/product-plan/01-payments.md`,
`archive/product-plan/02-subscriptions.md` (C1–C5) and the payment
findings D4, D20, D23, D31–D36 in `archive/product-plan/post-rebuild-diagnosis.md`.

## How it works

### Programmes

- **Seven programmes** (Sam, 2026-10-04), each with the General Paper:
  RN, RM, RMHN, RPHN; **RCN**, new, its courses and bank to come; **NAC**
  ("Nursing Assistant Clinical", course Basic Clinical Nursing) and
  **NAP** ("Nursing Assistant Preventive", course Basic Preventive
  Nursing), split from NACNAP. NAC, NAP and RCN exist, closed, with
  working names (C5a, 2026-10-04).
- **The switch-over, on the day NAC and NAP open — one step** *(to
  build: C5b)*: NACNAP's two courses move to NAC and NAP and the General
  Paper takes in NAC, NAP and RCN; NACNAP's four packages become a NAC
  set and a NAP set (copied at today's prices, corrected later); NAC and
  NAP opened, NACNAP closed — its students keep their access. One step,
  because a package's programme is read from its courses: moved early,
  NACNAP's packages would vanish from the shop; left behind, a NAC
  package would show as NACNAP's.
- **Open to the public — one switch per programme** (C5a, built
  2026-10-04). Open: the programme shows on the home page, at
  registration and in the shop. Closed: hidden, and the server refuses
  it at registration and at checkout ("This programme is not open
  yet."); **its packages follow it** — hidden from the shop, Premium
  Prep and the in-app Packages page, "not available to buy" at
  checkout, and refused at both payment doors (a package is open when
  it is for at least one open programme, or for everyone — the General
  Paper alone); the admin can still grant its packages for testing; closing
  stops new sign-ups only. A new programme starts closed; the rest open
  in batches as each bank is ready. The tick on the admin's Courses
  page, beside the programme's name, comes with its redesign *(to
  build: 02.9)*; until then it is set by hand.

### Packages

- **A package is a bag of courses** (may cross programmes, so a package
  has no programme of its own — it is for the programmes its courses
  are in, General Paper apart). It carries a kind (paid, trial, free), a
  status, a price in GHS, a length in days, and premium yes / no.
- **Each package carries four limits** — builder quizzes, offline packs
  per course, papers (all, or the trial paper only), mocks (yes / no) —
  copied onto each receipt by the database when it is written (03; 12,
  `products` and `subscriptions`).
  Free Full Access and paid packages: unlimited · 5 · all · yes. Built
  in the database (F4a, 2026-10-04); the admin's package form gets the
  four fields with its redesign *(to build: 03.1)*.
- **Mock exams open only on Premium Prep packages** — the ones marked
  premium (Sam, 2026-10-04: "the most important thing is that mock is
  for premium prep products"): mocks are seasonal, built for the main
  August/September sitting. Full Access, the single-course packages and
  Free Full Access carry no mocks; a tester is granted a Premium Prep
  package. Packages already bought keep what they came with. Product
  names are labels Sam changes at will. *(to build: 02.10 — the mocks
  limit follows the premium mark; new packages start without)*
- **Premium Prep includes the premium channel** for its programme (Sam,
  2026-10-04: "yes we need the groups") — the human layer the platform
  does not replace (08). Mocks and the channel are what set it apart
  from Full Access, which is the app alone.
- **Premium Prep is open all year, never a batch** (Sam, 2026-10-04):
  bought any day, its 240 days counted from then, every buyer in the
  same channel for their programme. A batch, a season or a resit
  ("August/September batch") is words on the public page, changed by
  Sam; underneath it is the same package. Why: the NMC sits several
  times a year, with resits; a question bank sells by length from any
  day (as UWorld and Archer Review do); batches suit live classes, and
  Sam runs the channel alone. Later audiences work the same way — KNUST
  or UCC affiliate exams, level 100 or 200: a package with its courses
  and a group or none, on its own public page (when picked up: accounts
  and the public lists are grouped by NMC programme today).
- **The public pages' words** — Premium Prep's text, a season banner —
  become Sam's to edit with their redesign *(to build: 02.11)*.
- **Bought means kept**: editing a package changes it for new buyers
  only.
- **The package is the only unit of sale, one per payment.**
- **For sale** means paid, active and priced above 0. The shop, checkout
  and both payment doors check it; the in-app Packages page and Premium
  Prep check it too. *(to build: the last two)*

### Buying

- **The shop**: anyone may buy any package; choosing a programme
  reorders the list and hides nothing; each card lists its courses;
  premium packages on Premium Prep, linked by a band. Sales pages read
  only the columns they show.
- **Checkout is one page for every package and every buyer** (Sam,
  2026-09-22): a new buyer gives email (twice), a WhatsApp number and a
  programme; a signed-in buyer sees "Paying as". The server repeats every
  check; nothing is kept in the browser.
- **Pay first** (Sam, 2026-09-18) — a buyer who has paid finishes the
  rest.
- **The price comes from the package, never the browser**; on Paystack's
  reply the amount and the currency are both checked. Paystack's reply
  is trimmed before it is saved (card type and last four digits kept).
- **Two doors report a payment** — the buyer's browser coming back and
  Paystack's signed webhook — and **only one receipt can ever exist per
  payment**, so both arriving is safe.
- **The account is made at payment** (Sam, 2026-09-18): when the payment
  is seen paid, the server makes the account from the email, phone and
  programme given, activates the package, and emails a set-password
  link; an email already known gets the package added. Money never sits
  paid without an account; the setup link and its rescue go. *(to
  build: D31)*
- **The same browser sees the password form**; another browser sees the
  status and "we've emailed you a link to set your password". Checking a
  payment tells status and package only, nothing personal. *(to build:
  D33)*
- **The confirmation page** is built on the server: five states, a
  receipt, nothing kept in the browser; it checks every 3 s for a
  minute, then every 10 s to three minutes; on success "Buy another
  package".
- **A nightly sweep** checks payments left unfinished for about an hour
  with Paystack: paid ones activated, the rest marked abandoned; nothing
  deleted. The admin sees in progress, abandoned and paid. *(to build:
  D34)*
- **Limits**: starting a payment and the password step 10 a minute per
  address; checking 30 a minute per payment; if the check fails,
  "Payments are briefly unavailable".

### Access

- **A receipt records what was bought or granted**; under it **one
  access row per course**, each with its own start, end and revoked
  date. The gate reads only those rows. The browser cannot write either.
- **Written only by rule**: the trial (when the student takes it, 03), a
  payment's activation, and the admin's Grant, Update and Revoke — one
  Grant dialog on the Users drawer and the Subscriptions page, always
  the whole package, with a preview of the dates. Grant emails "access
  assigned", Revoke "access removed".
- **The chain** (Sam, 2026-09-19): for one student and one course, the
  paid and free receipts line up — each starts at the later of its own
  start and the previous one's end, keeping its length. Every write
  re-packs the chain: a revoke pulls the later ones forward, an
  extension pushes them back. A renewal is a receipt of its own. Trials
  sit outside the chain.
- **A subscription is live by its dates** — started and not yet ended
  — everywhere: the gate, the profile, the Packages page, announcements'
  scope, messaging's targeting, the Users drawer and the admin
  dashboard's count (the last four since 02.1, 2026-10-04). The status
  word ACTIVE outlasts the end date until an admin presses Sync expired,
  and nothing reads it alone any more; a receipt queued to start later
  is not live either.
- **Expiry reminders**: a daily job emails a student whose access is
  ending, through the outbox (10); a status line on the admin
  dashboard; no run-now button. *(to build)*
- Payments, receipts and access rows are never deleted.

### For the admin

- **Subscriptions**: each receipt's rows, marked Live, Queued, Ended or
  Revoked; who granted it.
- **Payments**: every payment, the trimmed raw view, the rescue, revenue.
- **Courses**: the form suggests a code from programme and title,
  overwritable. *(to build)*
- Deferred until a real support case asks: editing one course's row by
  hand (Sam, 2026-09-19).

## Storage

Written on the tables in `12-tables.md`:

- `programs` — Open to the public — ticked 2026-10-04, built (C5a).
- `products` and `subscriptions` — the four limits and their copy;
  trials 14 days — ticked 2026-10-04 (03 F4).
- `payments` — the setup columns and a status go, "abandoned" comes
  (D31, D34): ruled 2026-09-18, no tick recorded — see Open.

## Open

- **For C5b**: NAC and NAP package prices (prices parked until Sam's
  real numbers, 2026-10-04) and RCN's courses.
- **Does D31 / D34's change to the payments table need its own tick?**
- **Signed-out visitors cannot read courses**, so public pages read them
  with the server's key — open the policy (a storage tick) or keep the
  workaround (since 2026-09-22).
- A draft or archived course inside a package is kept on save — keep or
  drop (Sam to rule).
- A premium package whose id matches no programme vanishes from Premium
  Prep without a word (2026-09-22).
- The checkout and confirmation-page wording — all new, not approved
  (2026-09-23).
- An account made at payment has no school (checkout asks email,
  WhatsApp and programme), and the my-school board needs one (05 G1b):
  ask at checkout, as Elite Nurses does, or at first sign-in.
- A course's programmes as a link table (D23 item 6) — ruled "when
  convenient" on 2026-09-18, never queued: queue or drop.
- The Sync button on Subscriptions — does it go once every reader uses
  the date?
- Parked: a price per course (the package stays the unit); a basket
  (one package per payment until buyers are seen paying twice a day).
