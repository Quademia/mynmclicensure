# Access Control

## Who Can Access What

QAcademy has three roles, and each one can see and do different things:

### Student
- Can access their own dashboard, courses, quizzes, results, profile, and messages
- Can only see their own data — quiz attempts, subscriptions, learning history
- Cannot see other students' information, even if they try
- Can access MyTeacher classes they have joined

### Admin
- Can see and manage everything on the platform
- Can view all users, subscriptions, payments, announcements, quizzes, and content
- Can grant or revoke subscriptions, activate or deactivate accounts, and handle support messages
- Has access to both MyNMC Licensure admin pages and general platform management

### Teacher
- Can only access MyTeacher — they do not see the NMC Licensure admin area
- Can manage their own classes, questions, quizzes, and results
- Cannot see other teachers' data
- Cannot access student accounts outside of their own classes

## How a Student Gets Course Access

Access to a specific course depends on subscriptions:

1. Every product contains a list of courses it unlocks
2. When a student buys that product, they get a subscription
3. As long as that subscription is ACTIVE and has not expired, the student can access those courses
4. If the subscription expires or is revoked, access stops

When a student tries to open a course page, the system checks all their active subscriptions. If any subscription covers that course, the student gets in. If none do, they see an upgrade prompt directing them to buy a plan.

## What Happens When a Subscription Expires

When a student's subscription runs out:

- They can still log in to the platform
- They can still see their dashboard
- They can still view their quiz history and past results
- They **cannot** start new quizzes on courses that are no longer covered
- They **cannot** access course pages for expired courses
- They see a prompt to renew or upgrade their subscription

The student does not lose their history. All their past attempts, scores, and progress are preserved. They just cannot take new quizzes until they resubscribe.

## What the Trial Gives Access To

When a student registers without paying, they get a trial subscription automatically. This trial:

- Covers a limited set of courses (not the full list available to paid subscribers)
- Gives enough access to explore the platform, try a few quizzes, and see how things work
- Has a set duration (determined by the trial product's configuration)
- Is meant as a taster — students are expected to upgrade to a paid plan for full access

Each programme has its own trial product, so the trial courses are relevant to the student's specific nursing programme.

## Device Sessions — Concurrent Login Control

Each user can be logged in on a maximum of 2 devices at the same time. This prevents credential sharing — a student cannot give their login to multiple friends and have them all use the platform simultaneously.

### How It Works

When a student logs in, the system creates a **session record** in the database. This record tracks:

- Which user it belongs to
- When the login happened and when it expires (7 days from login)
- What device and browser were used (e.g. "Windows · Chrome", "iOS · Safari")
- Whether the session is still active

If a student is already logged in on 2 devices and logs in on a 3rd, the system **automatically kicks out the oldest session**. The student on the kicked device will be redirected to the login page the next time they navigate to any page.

### What Students Experience

- Logging in on a phone and a laptop works fine (2 devices)
- Logging in on a 3rd device works, but the first device gets signed out
- Logging out properly frees up a device slot
- If a student clears their browser or loses a device, the old session expires after 7 days automatically

### What Admins Can See

Admins can view all active sessions across the platform. Session records are never deleted — they are marked inactive on logout or when kicked. This provides an audit trail of login activity.

### Technical Details

- Sessions are stored in the `sessions` table
- Each session has a unique ID (format: `SESS_` + random string) stored in the browser's localStorage
- On every page load, `guardPage()` verifies the session is still active and not expired
- The last-seen timestamp is updated on each page load (fire-and-forget, does not slow down the page)
- Session verification adds one lightweight database query per page load

## Login Rate Limiting — Brute Force Protection

Every time someone tries to log in — whether they get in or not — the platform records the attempt. This includes the email they used, what device they were on, when it happened, and whether it succeeded or failed. All of this is stored in the `auth_events` table.

If someone enters the wrong password 5 times within 10 minutes, the platform temporarily blocks further login attempts for that email. They see a message telling them how long to wait before they can try again. If they keep trying and reach 10 failed attempts in 24 hours, the block extends to 24 hours.

This protects student accounts from being broken into by someone guessing passwords repeatedly. It also gives you a record of suspicious activity — for example, if someone tried 20 different emails at 3am, you would see that in the database.

The protection works even if the email does not belong to any account. Someone trying random emails to find valid accounts will still get blocked after 5 attempts from the same device.

A student who genuinely forgets their password and tries a few times will not be affected — they get 5 attempts before any block kicks in. If they do get blocked, the message tells them exactly how long to wait.

### What Gets Recorded

Every login attempt creates a record with:
- The email address used
- Whether the login succeeded or failed
- Why it failed (wrong password, or blocked by rate limit)
- A device fingerprint (a code that identifies the device without revealing personal information)
- The date and time

### What Admins Can See

The `auth_events` table in the database contains every login attempt across the platform. This is useful for:
- Investigating reports of unauthorised access ("someone logged into my account")
- Spotting attack patterns (many failed attempts from the same device targeting different emails)
- Confirming when a student last successfully logged in

### Technical Details

- Login attempts are logged via the `log_auth_event` database function
- Rate limit checks use the `check_login_rate_limit` database function
- Both functions run with elevated permissions (SECURITY DEFINER) so they can access the locked-down table
- The table cannot be read or written to directly from the browser — only through these two functions
- If the rate limit check itself fails for any reason, login proceeds normally (fail-open design — we never accidentally lock everyone out)
- Device fingerprints are built from screen size, timezone, language, and browser platform, then hashed for privacy

---

## Row Level Security — How Data Is Protected

Every table in the database has rules that control who can read or write to it. These rules are enforced at the database level, not just in the website code. This means even if someone tried to access the database directly (bypassing the website), the rules would still apply.

Here is how it works in practice:

- **A student can only see their own rows.** If Student A queries the attempts table, they only get back their own attempts. Student B's data is invisible to them, even if they know Student B's ID.
- **A teacher can only see their own classes, quizzes, and students.** Teacher X cannot see Teacher Y's classes or question bank.
- **An admin can see everything.** This is intentional — admins need full visibility to manage the platform.
- **The payment worker uses a special server key** that bypasses all these rules. This is also intentional and safe — the payment worker runs on a secure server (not in anyone's browser) and needs unrestricted access to create accounts, activate subscriptions, and update payment records.

These rules exist as a safety net. Even if there were a bug in the website code, the database itself would prevent data leaks between users.
