# Prod Supabase Auth & Storage Setup

Do these in the **prod Supabase dashboard**.

---

## 1. Auth Settings

Go to: Authentication → URL Configuration

| Field | Value |
|-------|-------|
| Site URL | `https://qacademynurseshub.pages.dev` |
| Redirect URLs | Add: `https://qacademynurseshub.pages.dev/reset-password.html` |

---

## 2. SMTP (Custom emails via Resend)

Go to: Authentication → SMTP Settings → Enable Custom SMTP

| Field | Value |
|-------|-------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key (the prod one: `re_xxxx`) |
| Sender email | `noreply@qacademynurses.com` |
| Sender name | `QAcademy Educational Consult` |

---

## 3. Email Templates

Go to: Authentication → Email Templates

Copy the same branded templates from the dev project. There are 4:

| Template | Subject |
|----------|---------|
| Confirm signup | Verify your QAcademy email address |
| Reset password | Reset your QAcademy password |
| Magic link | Your QAcademy login link |
| Change email | Confirm your new QAcademy email address |

---

## 4. Email Confirmation

For now, keep email confirmation **OFF** (same as dev).
Turn ON before real users — requires "check inbox" screen + login error handling.

---

## 5. Google OAuth (if needed)

Go to: Authentication → Providers → Google

You'll need separate Google OAuth credentials for the prod domain.
The redirect URI will be: `https://qizhyhjeqhaybyddsuni.supabase.co/auth/v1/callback`

Skip this for now if not needed immediately.

---

## 6. Storage Bucket

Go to: Storage → New Bucket

| Field | Value |
|-------|-------|
| Name | `rationale-images` |
| Public | Yes |

Then add a policy:
- Name: `rationale images access`
- Operation: ALL
- Definition: `true`

This bucket stores question rationale images. URL format:
`https://qizhyhjeqhaybyddsuni.supabase.co/storage/v1/object/public/rationale-images/[filename]`
