# SPRINT: MyTeacher Clean Split
Created: April 2026  
Status: NOT STARTED  
Project: qacademy-gamma  
Branch: dev

════════════════════════════════════════════════════════════
## CONTEXT & GOAL
════════════════════════════════════════════════════════════

We are splitting MyTeacher from MyNMC Licensure into fully 
independent infrastructure. Currently both products share 
one public.users table, one sessions table, one auth_events 
table, one reset_requests table, one guard.js, and one 
login page.

After this sprint, each product will be completely 
self-contained. Licensure is NEVER touched. Everything 
we do is additive until Batch 4.

Auth layer (Supabase auth.users) stays shared — it is the 
login identity for both products and never changes.

════════════════════════════════════════════════════════════
## KEY PRINCIPLES FOR THIS SPRINT
════════════════════════════════════════════════════════════

1. Licensure files are never modified — not a single line
2. Additive first — new tables and files before any 
   existing file is touched
3. MyTeacher pages will use myteacher-guard.js — 
   not guard.js
4. All MyTeacher auth infrastructure points to new tables
5. public.users is NOT renamed in this sprint — 
   that is a future sprint
6. No real users exist yet — no data migration needed

════════════════════════════════════════════════════════════
## REFERENCE — EXISTING public.users SCHEMA
(myteacher_users is an exact copy with one change)
════════════════════════════════════════════════════════════

```sql
CREATE TABLE users (
  user_id              TEXT PRIMARY KEY,
  auth_id              UUID,
  username             TEXT,
  email                TEXT NOT NULL,
  phone_number         TEXT,
  name                 TEXT,
  forename             TEXT,
  surname              TEXT,
  program_id           TEXT,
  cohort               TEXT,
  level                TEXT,
  role                 TEXT NOT NULL DEFAULT 'STUDENT',
  active               BOOLEAN NOT NULL DEFAULT true,
  avatar_url           TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  signup_source        TEXT DEFAULT 'SUPABASE_AUTH',
  created_utc          TIMESTAMPTZ DEFAULT NOW(),
  last_login_utc       TIMESTAMPTZ
);
```

Only change for myteacher_users:
  signup_source default → 'MYTEACHER'

════════════════════════════════════════════════════════════
## REFERENCE — EXISTING TABLES BEING MIRRORED
════════════════════════════════════════════════════════════

sessions → teacher_sessions (same columns)  
auth_events → teacher_auth_events (same columns)  
reset_requests → teacher_reset_requests (same columns)

Existing sessions columns:
  session_id, user_id, kind, issued_utc, expires_utc,
  last_seen_utc, device_label, ua_hash, ip_hash, 
  login_via, active

Existing auth_events columns:
  event_id, event_type, identifier, user_id, fp_hash,
  ua_hash, device_label, fail_reason, created_utc

Existing reset_requests columns:
  request_id, email, user_exists, status, fp_hash,
  device_label, used, used_utc, created_utc

════════════════════════════════════════════════════════════
## REFERENCE — EXISTING HELPER FUNCTIONS BEING MIRRORED
════════════════════════════════════════════════════════════

Existing:
  auth_user_role() → reads from public.users
  auth_user_id()   → reads from public.users

New (to create):
  myteacher_user_role() → reads from myteacher_users
  myteacher_user_id()   → reads from myteacher_users

════════════════════════════════════════════════════════════
## REFERENCE — EXISTING FILES BEING MIRRORED
════════════════════════════════════════════════════════════

guard.js         → myteacher-guard.js  
auth.js          → myteacher-auth.js  
router.html      → myteacher/router.html  
login.html       → myteacher/login.html  
forgot-password  → myteacher/forgot-password.html  

════════════════════════════════════════════════════════════
## BATCH 1 — DATABASE ONLY (LOWEST RISK)
════════════════════════════════════════════════════════════
Use Supabase MCP to create all tables and functions.
Nothing existing is touched in this batch.

**STEP 1 — Create myteacher_users table**
  - Exact copy of public.users
  - signup_source default = 'MYTEACHER'
  - Add indexes: auth_id, email, role

**STEP 2 — Create teacher_sessions table**
  - Exact copy of sessions table
  - Add same indexes as sessions

**STEP 3 — Create teacher_auth_events table**
  - Exact copy of auth_events table
  - Add same indexes as auth_events

**STEP 4 — Create teacher_reset_requests table**
  - Exact copy of reset_requests table
  - Add same indexes as reset_requests

**STEP 5 — Create myteacher_user_id() function**
  - SECURITY DEFINER
  - Reads user_id from myteacher_users where 
    auth_id = auth.uid()
  - Mirror of existing auth_user_id()

**STEP 6 — Create myteacher_user_role() function**
  - SECURITY DEFINER
  - Reads role from myteacher_users where 
    auth_id = auth.uid()
  - Mirror of existing auth_user_role()

**STEP 7 — Write RLS policies for all four new tables**

  myteacher_users:
    - Public SELECT for registration check (email exists)
    - Users read/update their own row
    - ADMIN reads all

  teacher_sessions:
    - Users read/update their own sessions
      (join to myteacher_users via auth_id)
    - Users insert their own sessions
    - ADMIN reads all

  teacher_auth_events:
    - Fully locked — no direct browser access
    - Only RPCs can write to it

  teacher_reset_requests:
    - Fully locked — no direct browser access
    - Only RPCs can write to it

**STEP 8 — Update db/schema.sql**
  - Add all four new tables with comments
  - Mark public.users as 'Licensure only'

**STEP 9 — Update db/rls.sql**
  - Add all new RLS policies

**VERIFY BATCH 1:**
  - [ ] All four tables visible in Supabase table editor
  - [ ] Test insert on myteacher_users succeeds
  - [ ] Both helper functions visible in Database → Functions
  - [ ] RLS enabled on all four tables

════════════════════════════════════════════════════════════
## BATCH 2 — NEW JS INFRASTRUCTURE (MEDIUM RISK)
════════════════════════════════════════════════════════════
New files only. Nothing existing is modified.

**STEP 10 — Create js/myteacher-guard.js**
  - Mirror of js/guard.js
  - Reads user profile from myteacher_users 
    (not public.users)
  - Reads/writes sessions to teacher_sessions 
    (not sessions)
  - Redirect to myteacher/login.html on auth failure
    (not login.html)
  - All role checks use myteacher_user_role()

**STEP 11 — Create js/myteacher-auth.js**
  - Mirror of js/auth.js
  - Writes auth events to teacher_auth_events
  - Writes reset requests to teacher_reset_requests
  - All identity lookups use myteacher_users

**VERIFY BATCH 2:**
  - [ ] Load a MyTeacher page with myteacher-guard.js 
    swapped in (test only, revert after)
  - [ ] Confirm redirect to myteacher/login.html fires
  - [ ] No console errors

════════════════════════════════════════════════════════════
## BATCH 3 — NEW PAGES (MEDIUM RISK)
════════════════════════════════════════════════════════════
New files only. Nothing existing is modified.

**STEP 12 — Create myteacher/login.html**
  - Mirror of root login.html
  - Email/password + Google OAuth + magic link
  - On success: redirectTo = myteacher/router.html
  - On forgot password: link to 
    myteacher/forgot-password.html
  - Uses myteacher-auth.js (not auth.js)
  - Add myteacher/router.html to Supabase 
    redirect URL allowlist

**STEP 13 — Create myteacher/router.html**
  - Mirror of root router.html
  - Reads role from myteacher_users 
    (not public.users)
  - TEACHER → myteacher/teacher/dashboard.html
  - STUDENT → myteacher/student/my-classes.html
  - ADMIN → (future — not needed at launch)

**STEP 14 — Create myteacher/forgot-password.html**
  - Mirror of root forgot-password.html
  - Writes to teacher_reset_requests 
    (not reset_requests)
  - Uses myteacher-auth.js

**VERIFY BATCH 3:**
  - [ ] Register a test MyTeacher user via 
    myteacher/register.html (still writes to 
    public.users at this point — that is fine)
  - [ ] Log in via myteacher/login.html
  - [ ] Confirm session row appears in teacher_sessions
  - [ ] Confirm router sends TEACHER to teacher dashboard
  - [ ] Confirm router sends STUDENT to student dashboard
  - [ ] Test forgot password flow end to end

════════════════════════════════════════════════════════════
## BATCH 4 — WIRE EXISTING MYTEACHER PAGES (HIGHER RISK)
════════════════════════════════════════════════════════════
Existing files are modified for the first time here.
Do one page at a time. Verify after each.

**STEP 15 — Update all MyTeacher teacher pages**
  Files: myteacher/teacher/*.html
  Change: replace guard.js with myteacher-guard.js
  in script load order on every teacher page

**STEP 16 — Update all MyTeacher student pages**
  Files: myteacher/student/*.html
  Change: replace guard.js with myteacher-guard.js
  in script load order on every student page

**STEP 17 — Update myteacher/register.html**
  Change: write new users to myteacher_users 
  instead of public.users
  Also: create teacher_profiles row as before 
  (teacher_id stays the same — it is the user_id 
  from myteacher_users)

**STEP 18 — Update js/myteacher-api.js**
  Change: anywhere user identity is read 
  (user_id, role lookups), point to myteacher_users
  instead of public.users
  Note: only provide changed function blocks — 
  not a full file rewrite

**STEP 19 — Update RLS on teacher_class_members**
  Change: policy joins to myteacher_users 
  instead of public.users

**STEP 20 — Update RLS on teacher_quiz_attempts**
  Change: policy joins to myteacher_users 
  instead of public.users

**VERIFY BATCH 4:**
  - [ ] Full end-to-end MyTeacher flow:
    Register teacher → log in → create class → 
    student joins → quiz runs → results show
  - [ ] Open Licensure login in separate browser tab
  - [ ] Confirm Licensure login works completely 
    independently
  - [ ] Confirm no console errors on any MyTeacher page

════════════════════════════════════════════════════════════
## BATCH 5 — ROOT LOGIN PAGE (HIGH VISIBILITY)
════════════════════════════════════════════════════════════

**STEP 21 — Update root login.html**
  Change: replace login form with product selector
  Two buttons only:
    [ MyNMC Licensure ] → mynmclicensure/login.html
    [ MyTeacher ]       → myteacher/login.html
  No database lookups
  No auth logic
  Just a signpost

**VERIFY BATCH 5:**
  - [ ] Visit root login — both buttons navigate correctly
  - [ ] Licensure users can log in end to end
  - [ ] MyTeacher users can log in end to end

════════════════════════════════════════════════════════════
## BATCH 6 — DOCUMENTATION (NO RISK)
════════════════════════════════════════════════════════════

**STEP 22 — Update db/schema.sql**
  Add comment to public.users: 
  'MyNMC Licensure users only. 
   MyTeacher users are in myteacher_users.'

**STEP 23 — Update CLONING.md**
  Document:
  - Split architecture overview
  - Two login pages and what each serves
  - New tables and what they mirror
  - myteacher-guard.js vs guard.js
  - Supabase redirect URL allowlist entries needed
  - Two sets of helper functions

**STEP 24 — Update BUILD_LIST.md**
  Mark sprint complete

════════════════════════════════════════════════════════════
## FILES CHANGED SUMMARY
════════════════════════════════════════════════════════════

**NEW FILES:**

  db/ (via Supabase MCP):
  - myteacher_users table
  - teacher_sessions table
  - teacher_auth_events table
  - teacher_reset_requests table
  - myteacher_user_id() function
  - myteacher_user_role() function

  js/:
  - myteacher-guard.js
  - myteacher-auth.js

  myteacher/:
  - login.html
  - router.html
  - forgot-password.html

**MODIFIED FILES:**
  - myteacher/register.html
  - myteacher/teacher/*.html (guard script swap)
  - myteacher/student/*.html (guard script swap)
  - js/myteacher-api.js (identity lookups only)
  - login.html (root — becomes product selector)
  - db/schema.sql (comments + new tables)
  - db/rls.sql (new policies)
  - CLONING.md
  - BUILD_LIST.md

**NEVER TOUCHED:**
  - guard.js
  - auth.js
  - router.html (root)
  - mynmclicensure/ (entire folder)
  - public.users table
  - sessions table
  - auth_events table
  - reset_requests table

════════════════════════════════════════════════════════════
## FUTURE SPRINT (NOT THIS SPRINT)
════════════════════════════════════════════════════════════

- Rename public.users → licensure_users
- Rename root router.html → licensure-router.html
- Migrate any test users from public.users 
  to myteacher_users
- MyTeacher admin page for managing myteacher_users
- pg_cron cleanup for teacher_sessions
