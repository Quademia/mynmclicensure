# QAcademy — Restructure & Config-Driven Paths Plan
*Audited & finalised: March 2026*

---

## Context

This plan reorganises the project from a flat `student/`, `admin/`, `runner/` structure into a proper `mynmclicensure/` product folder (mirroring `myteacher/`). Three JS files are renamed for consistency. A central path config (`js/paths.js`) is introduced so all dynamic paths are config-driven — future product cloning only requires changing one object.

### Audit additions (vs original plan)
- `api.js` is shared by 2 myteacher pages — 4 functions copied to `teacher-api.js` first
- 5 missed path references added (subscribe.html, payment-confirmation.html, admin preview buttons, runner feedback links)
- 3 pre-existing broken links in student/dashboard.html fixed
- `startsWith()` checks in student-sidebar.js addressed
- `register.html` api.js reference addressed

---

## Part 1 — Create `js/paths.js` (config-driven paths)

New file. Simple global const, no modules:

```js
const LICENSURE = {
  admin:   '/mynmclicensure/admin',
  student: '/mynmclicensure/student',
  runner:  '/mynmclicensure/runner',
};
```

All JS files that build URLs dynamically will reference `LICENSURE.x + '/page.html'`.
Static HTML `href` attributes will hardcode the full new path.

---

## Part 2 — Decouple myteacher from api.js

Copy these 4 functions from `js/api.js` into `js/teacher-api.js`:
- `getPrograms()`
- `getUserById(userId)`
- `updateUserProfile(userId, fields)`
- `uploadProfileImage(userId, file, prefix)`

Then remove `<script src="/js/api.js">` from:
- `myteacher/teacher/profile.html`
- `myteacher/student/profile.html`

These pages already load `teacher-api.js` which will now contain the needed functions.

---

## Part 3 — JS Files to Rename

Rename in place inside `js/` using `git mv`:

| Old filename | New filename |
|---|---|
| `js/api.js` | `js/mynmclicensure-api.js` |
| `js/admin-sidebar.js` | `js/mynmclicensure-admin-sidebar.js` |
| `js/student-sidebar.js` | `js/mynmclicensure-student-sidebar.js` |

**JS files that stay unchanged:**
- `js/config.js`
- `js/guard.js` — only references `/login.html`, `/router.html`, `/myteacher/...` (all root paths, unaffected)
- `js/paths.js` (new)
- `js/teacher-api.js` (updated in Part 2)
- `js/myteacher-admin-nav.js` (updated in Part 6)
- `js/myteacher-teacher-nav.js`
- `js/myteacher-student-nav.js`

---

## Part 4 — Folders & Files to Move

Create the new folder structure, then `git mv` all files:

```
mynmclicensure/
  admin/    ← 12 files from admin/
  student/  ← 14 files from student/
  runner/   ← 2 files from runner/
```

### Admin files (12)
dashboard, users, subscriptions, products, courses, announcements, fixed-quizzes, mock-exams, question-bank, config, messages, payments

### Student files (14)
dashboard, announcements, course, fixed-quizzes, mock-exams, learning-history, quiz-builder, upgrade, profile, messages, telegram, offline-pack-builder, my-offline-packs, offline-pack-renderer

### Runner files (2)
instant, timed

### Files that stay at root (do not move)
```
index.html, router.html, subscribe.html, payment-confirmation.html,
login.html, register.html, forgot-password.html, reset-password.html
```

---

## Part 5 — Path Changes Inside Files

### Config-driven changes (JS files using LICENSURE const)

#### `js/mynmclicensure-admin-sidebar.js`
Replace 12 hardcoded nav links in template literal with `${LICENSURE.admin}/X.html`.

#### `js/mynmclicensure-student-sidebar.js`
- Replace 13 nav links with `${LICENSURE.student}/X.html`
- Update `startsWith()` checks: `'/student/course'` → `LICENSURE.student + '/course'`, etc.
- Update dynamic course link: `'/student/course.html?id='` → `LICENSURE.student + '/course.html?id='`
- Leave `/myteacher/student/dashboard.html` link unchanged

#### `router.html`
Add `<script src="/js/paths.js"></script>` before inline script. Update DEST object:
```js
studentLicensure : LICENSURE.student + '/dashboard.html',
adminLicensure   : LICENSURE.admin + '/dashboard.html',
```

---

### Script src changes (all moved HTML files)

#### Every file in `mynmclicensure/admin/` (12 pages)
| Find | Replace with |
|---|---|
| `/js/api.js` | `/js/mynmclicensure-api.js` |
| `/js/admin-sidebar.js` | `/js/mynmclicensure-admin-sidebar.js` |

Add `<script src="/js/paths.js"></script>` before the sidebar script.

#### Every file in `mynmclicensure/student/` (14 pages)
| Find | Replace with |
|---|---|
| `/js/api.js` | `/js/mynmclicensure-api.js` |
| `/js/student-sidebar.js` | `/js/mynmclicensure-student-sidebar.js` |

Add `<script src="/js/paths.js"></script>` before the sidebar script.

#### Every file in `mynmclicensure/runner/` (2 pages)
| Find | Replace with |
|---|---|
| `/js/api.js` | `/js/mynmclicensure-api.js` |

Add `<script src="/js/paths.js"></script>` before inline scripts.

---

### Cross-reference changes (per-file)

#### `mynmclicensure/admin/dashboard.html`
| Find | Replace with |
|---|---|
| `/admin/users.html` | `/mynmclicensure/admin/users.html` |
| `/admin/subscriptions.html` | `/mynmclicensure/admin/subscriptions.html` |
| `/admin/payments.html` | `/mynmclicensure/admin/payments.html` |
| `/admin/products.html` | `/mynmclicensure/admin/products.html` |
| `/admin/courses.html` | `/mynmclicensure/admin/courses.html` |
| `/admin/announcements.html` | `/mynmclicensure/admin/announcements.html` |
| `/admin/question-bank.html` | `/mynmclicensure/admin/question-bank.html` |
| `/admin/config.html` | `/mynmclicensure/admin/config.html` |
| `/admin/fixed-quizzes.html` | `/mynmclicensure/admin/fixed-quizzes.html` |

#### `mynmclicensure/admin/payments.html`
| Find | Replace with |
|---|---|
| `/admin/users.html` (inline JS) | Use `LICENSURE.admin + '/users.html'` |

#### `mynmclicensure/admin/subscriptions.html`
| Find | Replace with |
|---|---|
| `/admin/payments.html` (inline JS) | Use `LICENSURE.admin + '/payments.html'` |

#### `mynmclicensure/admin/fixed-quizzes.html` *(missed in original plan)*
| Find | Replace with |
|---|---|
| `/runner/instant.html` (preview window.open) | Use `LICENSURE.runner + '/instant.html'` |

#### `mynmclicensure/admin/mock-exams.html` *(missed in original plan)*
| Find | Replace with |
|---|---|
| `/runner/instant.html` (preview window.open) | Use `LICENSURE.runner + '/instant.html'` |

#### `mynmclicensure/runner/instant.html`
| Find | Replace with |
|---|---|
| `/runner/timed.html` | Use `LICENSURE.runner + '/timed.html'` |
| `/runner/instant.html` | Use `LICENSURE.runner + '/instant.html'` |
| `/student/fixed-quizzes.html` | Hardcode `/mynmclicensure/student/fixed-quizzes.html` (onclick) |
| `/student/messages.html` *(missed)* | Use `LICENSURE.student + '/messages.html'` |

#### `mynmclicensure/runner/timed.html`
| Find | Replace with |
|---|---|
| `/runner/instant.html` | Use `LICENSURE.runner + '/instant.html'` |
| `/runner/timed.html` | Use `LICENSURE.runner + '/timed.html'` |
| `/student/fixed-quizzes.html` | Hardcode `/mynmclicensure/student/fixed-quizzes.html` (onclick) |
| `/student/messages.html` *(missed)* | Use `LICENSURE.student + '/messages.html'` |

#### `mynmclicensure/student/dashboard.html`
| Find | Replace with |
|---|---|
| `/runner/instant.html` | `/mynmclicensure/runner/instant.html` |
| `/student/course.html` | `/mynmclicensure/student/course.html` |
| `/student/learning-history.html` | `/mynmclicensure/student/learning-history.html` |
| `/student/my-offline-packs.html` | `/mynmclicensure/student/my-offline-packs.html` |
| `/student/messages.html` | `/mynmclicensure/student/messages.html` |
| `/student/telegram.html` | `/mynmclicensure/student/telegram.html` |
| `/student/announcements.html` | `/mynmclicensure/student/announcements.html` |

**Bug fixes:**
| Broken href | Fix to |
|---|---|
| `/fixed-quizzes.html` (missing prefix) | `/mynmclicensure/student/fixed-quizzes.html` |
| `/quiz-builder.html` (missing prefix) | `/mynmclicensure/student/quiz-builder.html` |
| `/subscription.html` (dead link) | `/mynmclicensure/student/upgrade.html` |

#### `mynmclicensure/student/course.html`
| Find | Replace with |
|---|---|
| `/runner/instant.html` | `/mynmclicensure/runner/instant.html` |
| `/runner/timed.html` | `/mynmclicensure/runner/timed.html` |
| `/student/mock-exams.html` | `/mynmclicensure/student/mock-exams.html` |
| `/student/fixed-quizzes.html` | `/mynmclicensure/student/fixed-quizzes.html` |
| `/student/dashboard.html` | `/mynmclicensure/student/dashboard.html` |
| `/student/messages.html` | `/mynmclicensure/student/messages.html` |

#### `mynmclicensure/student/learning-history.html`
| Find | Replace with |
|---|---|
| `/runner/instant.html` | `/mynmclicensure/runner/instant.html` |
| `/runner/timed.html` | `/mynmclicensure/runner/timed.html` |
| `/student/learning-history.html` | `/mynmclicensure/student/learning-history.html` |

#### `mynmclicensure/student/fixed-quizzes.html`
| Find | Replace with |
|---|---|
| `/runner/instant.html` | `/mynmclicensure/runner/instant.html` |
| `/runner/timed.html` | `/mynmclicensure/runner/timed.html` |

#### `mynmclicensure/student/mock-exams.html`
| Find | Replace with |
|---|---|
| `/runner/instant.html` | `/mynmclicensure/runner/instant.html` |
| `/runner/timed.html` | `/mynmclicensure/runner/timed.html` |

#### `mynmclicensure/student/quiz-builder.html`
| Find | Replace with |
|---|---|
| `/runner/instant.html` | `/mynmclicensure/runner/instant.html` |
| `/runner/timed.html` | `/mynmclicensure/runner/timed.html` |

#### `mynmclicensure/student/offline-pack-builder.html`
| Find | Replace with |
|---|---|
| `/student/dashboard.html` | `/mynmclicensure/student/dashboard.html` |
| `/student/my-offline-packs.html` | `/mynmclicensure/student/my-offline-packs.html` |

#### `mynmclicensure/student/my-offline-packs.html`
| Find | Replace with |
|---|---|
| `/student/dashboard.html` | `/mynmclicensure/student/dashboard.html` |
| `/student/offline-pack-builder.html` | `/mynmclicensure/student/offline-pack-builder.html` |

---

### Root HTML files

#### `register.html` *(missed in original plan)*
| Find | Replace with |
|---|---|
| `/js/api.js` | `/js/mynmclicensure-api.js` |

#### `subscribe.html` *(missed in original plan)*
| Find | Replace with |
|---|---|
| `/student/upgrade.html` | `/mynmclicensure/student/upgrade.html` |
| `/js/api.js` | `/js/mynmclicensure-api.js` |

#### `payment-confirmation.html` *(missed in original plan)*
| Find | Replace with |
|---|---|
| `/student/dashboard.html` | `/mynmclicensure/student/dashboard.html` |

---

## Part 6 — `myteacher-admin-nav.js`

Hardcode (myteacher pages do not load paths.js):

| Find | Replace with |
|---|---|
| `href="/admin/dashboard.html"` (2 occurrences) | `href="/mynmclicensure/admin/dashboard.html"` |

---

## Part 7 — Verification Checklist

After execution, verify before pushing:

- [ ] Grep for stale `/admin/`, `/student/`, `/runner/` paths — zero hits outside `myteacher/` and `guard.js`
- [ ] `router.html` correctly routes to both new dashboards
- [ ] Admin sidebar links all resolve correctly
- [ ] Student sidebar links all resolve correctly (including course dropdown)
- [ ] `myteacher-admin-nav.js` switch link goes to correct admin dashboard
- [ ] Runner instant <-> timed cross-redirects work
- [ ] Runner feedback link opens correct messages page
- [ ] Admin preview buttons open runner at correct path
- [ ] Learning history Resume/Review/Retake buttons launch correct runner
- [ ] Quiz builder launches correct runner after building
- [ ] Fixed quizzes and mock exams launch correct runner
- [ ] Offline pack builder links back to correct pages
- [ ] Dashboard quick-links (fixed-quizzes, quiz-builder, upgrade) work
- [ ] All admin pages load with correct sidebar
- [ ] All student pages load with correct sidebar
- [ ] myteacher profile pages load without errors (api.js removed)
- [ ] register.html, subscribe.html, payment-confirmation.html links work
- [ ] No 404s on any navigation path
- [ ] Browser console: zero missing-script errors

---

## Part 8 — What Does NOT Change

- `myteacher/` — entire folder untouched (except removing api.js from 2 profile pages)
- `js/config.js` — untouched
- `js/guard.js` — untouched (only references root paths)
- `js/myteacher-teacher-nav.js` — untouched
- `js/myteacher-student-nav.js` — untouched (switch link points to `/router.html`)
- `payments-worker/` — entirely separate deployment, untouched
- Worker API endpoints in api.js (`/admin/subscriptions/grant` etc.) — CloudFlare Worker routes, NOT file paths
- `css/style.css` — untouched
- `images/` — untouched
- All Supabase tables, RLS policies, config keys — no changes

---

## Commit Strategy

Single commit — the app is broken between file moves and path updates, so no intermediate commits.

---
