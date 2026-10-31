# 01 — Accounts and sign-in

How a person gets one account and signs in; how devices, lockouts and
passwords work; and the admin's security pages. What the account holds
on top of the free account — the trial or a package — is in 03 and 02.

Detail and history: `archive/product-plan/04-access-control.md`,
`archive/product-plan/rebuild.md` §10, and Sam's ten auth rulings of
2026-09-18 in `archive/product-plan/post-rebuild-diagnosis.md`.

## How it works

### One account, two ways in, one floor

- **Two ways in** (Sam, 2026-10-04, replacing the morning's "three ways
  in"): **registering starts the 14-day trial** — today's register page,
  which already does this — and **buying a package makes the account**
  at checkout (02, D31). There is no free account door. The only
  way-in wording on any page is **Start your 14-day trial** (Sam,
  2026-10-05); the floor's public name is Free forever (03).
- **The free account is the floor**: every account keeps it for good,
  and a student whose trial or package ends lands on it — the account
  kept, free practice forever, the rest locked, not gone (03). Why: one
  sign-up gives everything a student can try, with no choice between
  "free" and "trial" before they know the difference; the offer fits a
  line — "start your 14-day trial, then free practice, forever" (the
  reverse trial Grammarly, Notion and Duolingo use); and the door is
  already built.
- **Free Full Access** is only ever the admin's grant (02).
- **Two roles**, student and admin; any other is refused at sign-in. An
  admin passes every student gate. After sign-in each lands on their
  own dashboard.

### Registering

- One step on the server: the login is made, the profile written, the
  programme's trial granted (after the SMS check, F4b), the welcome
  email; then **the student is signed in on that device** and goes
  through the welcome screen to the dashboard (Sam, 2026-10-31, in place
  of signing out to a "now sign in" screen: typing the email and
  password again straight after making them is a wasted step on weak
  data). If the profile fails, the login is removed.
- **The register page** (Sam, 2026-10-31; 01.15) is on the sign-in
  page's look — the same frame and photo: "Start your N-day trial." /
  "Then free practice, forever. No card needed.", the button "Start your
  N-day trial", **the password typed once with Show** (over typing it
  twice: on a phone, seeing it catches a slip; its hint "At least 8
  characters (remember it to sign in)." — no strength rules or meter,
  Sam 2026-10-31: in legacy the password was one of the main things
  students struggled with and asked the admin about), and legacy's "Almost
  done!" in the app's own dialog before the account is made. An email
  already in the sign-in table is told so in our words; one known only
  to another Quademia app is 01.7's.
- **A school is required** — the region first, then the school from
  the regulator's list. **Suggested schools** (Sam, 2026-10-20, in
  place of typing a name the admin matches later; settles D50): under
  "Not listed?", the schools other students suggested in that region,
  to pick from; still not there, **Add your school** — its name and
  town (the region already chosen), a simple word check against rude
  names. A suggestion is offered to the next student who says not
  listed and never shown with the listed ones; the admin approves it
  onto the list, merges it into a listed school (its students move
  there) or removes it. Why: three students from one school typed three
  spellings, and the school boards (05) need one; a suggestion picked
  by classmates arrives as one name with a place. The student changes
  school on Profile at any time, the same steps. *(to build, with the
  leaderboards)*
- **A programme not Open to the public is refused** (02 C5a, built
  2026-10-04): "This programme is not open yet."
- **The email is lowercased and unique.** The student's own browser may
  change only the profile's fields. **The phone number is changed
  through the server**, which clears its verification (03; 12, `users`).
  *(to build: F4b)*

### Signing in

- **Three doors**: email and password, Google, and an emailed code (a
  link until 01.13). A
  wrong password says "Invalid email or password", never whether the
  account exists. A sign-in with no profile here says so and signs out;
  Google and the email link never make a profile.
- **The sign-in page** (Sam, 2026-10-30, after Claude's own sign-in
  page; canvas https://claude.ai/artifact/5vmaSLpvdCZtyxKhchQCTU):
  layout B — on a computer the words and the card on the left, one of
  Sam's Cloudinary photos on the right; on a phone the card alone, no
  photo. The card: email, password and Sign in first; then "or", Continue
  with Google and Email me a sign-in code as two equal buttons (Sam: so
  the code reads as a real option). Under it "New here? Start your
  N-day trial" and **"Can't sign in? Message us on WhatsApp"** — the
  support number the emails carry (01.10; drawn so, Sam's "proceed"). A
  phone signed out by a sign-in elsewhere is told why above the card.
  The page's entry: 11.
- **An emailed code, not an emailed link** (Sam, 2026-10-30): six
  digits typed in the same tab. A link tapped in the Gmail app signs the
  student in inside Gmail's own browser, not the tab or the installed
  app they started from; MyNclex made the same change. *(to build:
  01.13)* Until then the button sends the link, and an unknown email gets
  the same answer as a known one and no sign-in row: Supabase's default
  made a bare one in the sign-in table shared with the old site and
  MyTeacher.
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
  2026-09-18): "Save and sign in" saves the password, signs every other
  device out and this one in. Forgot and reset are on the sign-in page's
  look (01.15); forgot answers in the card's place, as the emailed
  sign-in does, and a used or old link says so with "Send me a new link".
- The reset, email-link and invite emails come from the app in
  Quademia's own templates (10). *(to build)*

### For the admin

- **Invite by email**, in place of Create User (Sam, 2026-09-18): a
  student or an admin, an optional package; the invitee sets a password
  from the link and finishes the profile on arrival; inviting an admin
  is type-to-confirm. *(to build)*
- **Last sign-in** — written at every sign-in, shown in the Users
  drawer, a filter for dormant accounts on the Users list. *(to build)*
- **Schools not on the list** (Sam, 2026-10-20) — each suggested school
  with its region and town and how many students picked it: **Approve**
  (it joins the list), **Merge** (a listed school under another
  spelling; its students move there) or **Remove** (a joke or a mistake;
  its students choose again). The names typed before suggested schools
  arrive here as suggestions to tidy. *(to build, with the leaderboards)*
- **Remove picture** on a student's row (Sam, 2026-10-20) — takes the
  profile photo off entirely: profile pictures can be abused, and the
  leaderboards show them (05). *(to build, with the leaderboards)*
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
