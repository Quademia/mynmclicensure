# Prod Workers Deployment Guide

Deploy both workers on the **prod Cloudflare account**.

---

## 1. Payments Worker

### Step 1: Authenticate Wrangler with the prod account
```bash
npx wrangler login
```
Log in with the prod Cloudflare email when the browser opens.

### Step 2: Create the prod wrangler config
In the **prod repo** (qacademy), create `payments-worker/wrangler.prod.jsonc`:
```jsonc
{
  "name": "qacademy-prod-payment-workers",
  "main": "src/index.js",
  "compatibility_date": "2026-03-17",
  "workers_dev": true,
  "preview_urls": false,
  "observability": {
    "enabled": true,
    "logs": {
      "invocation_logs": true
    }
  },
  "vars": {
    "SUPABASE_URL": "https://qizhyhjeqhaybyddsuni.supabase.co",
    "APP_BASE_URL": "https://qacademynurseshub.pages.dev",
    "APP_ORIGIN": "https://qacademynurseshub.pages.dev"
  },
  "ratelimits": [
    {
      "name": "RATE_LIMITER",
      "namespace_id": "1001",
      "simple": {
        "limit": 5,
        "period": 60
      }
    }
  ]
}
```

### Step 3: Deploy
```bash
cd payments-worker
npm install
npx wrangler deploy --config wrangler.prod.jsonc
```

### Step 4: Set secrets
After deploying, set the two secrets:
```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.prod.jsonc
# Paste the service role key from the prod Supabase project
# (Dashboard → Project Settings → API → service_role key)

npx wrangler secret put PAYSTACK_SECRET_KEY --config wrangler.prod.jsonc
# Paste your Paystack LIVE secret key (sk_live_xxx)
# Use TEST key (sk_test_xxx) if you want to test first
```

### Step 5: Note the worker URL
After deploy, Wrangler will print something like:
```
https://qacademy-prod-payment-workers.xxx.workers.dev
```
You need this URL for `config.js` (PAYMENTS_API_BASE prod value).

---

## 2. Licensure Email Worker

### Step 1: Deploy
```bash
cd mynmclicensure/workers/email-worker
npx wrangler deploy --config wrangler.prod.jsonc
```

### Step 2: Set secrets
```bash
npx wrangler secret put RESEND_API_KEY --config wrangler.prod.jsonc
npx wrangler secret put EMAIL_SECRET --config wrangler.prod.jsonc
```

### Step 3: Note the worker URL
URL will be: `https://qacademy-licensure-email-worker.mybackpacc.workers.dev`
Confirm this matches `EMAIL_WORKER_URL` prod value in `mynmclicensure/js/config.js`.

---

## 3. MyTeacher Email Worker

### Step 1: Deploy
```bash
cd myteacher/workers/email-worker
npx wrangler deploy --config wrangler.prod.jsonc
```

### Step 2: Set secrets
```bash
npx wrangler secret put RESEND_API_KEY --config wrangler.prod.jsonc
npx wrangler secret put EMAIL_SECRET --config wrangler.prod.jsonc
```

### Step 3: Note the worker URL
URL will be: `https://qacademy-myteacher-email-worker.mybackpacc.workers.dev`
Confirm this matches `EMAIL_WORKER_URL` prod value in `myteacher/js/config.js`.

---

## 4. Update config.js

After deploying all three workers, confirm the URLs in each product's `config.js` match the deployed workers:
- `mynmclicensure/js/config.js` — `PAYMENTS_API_BASE` and `EMAIL_WORKER_URL` (prod values)
- `myteacher/js/config.js` — `EMAIL_WORKER_URL` (prod value)
- Set `EMAIL_SECRET` in each `config.js` to the value used when running `wrangler secret put EMAIL_SECRET` for that product's worker

Then commit, push to main, merge to production, and the mirror will update the prod repo.
