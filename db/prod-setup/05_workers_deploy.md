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

## 2. Email Worker

The dev email worker already accepts the prod origin (updated ALLOWED_ORIGINS).
Both dev and prod sites can share the same email worker since:
- It sends via Resend (shared account)
- CORS now allows both origins
- The EMAIL_SECRET is checked per-request

**If you want a separate prod email worker instead:**

### Step 1: Create config
In the prod repo, create `workers/email-worker/wrangler.prod.jsonc`:
```jsonc
{
  "name": "qacademy-prod-email-worker",
  "main": "index.js",
  "compatibility_date": "2024-01-01"
}
```

### Step 2: Deploy
```bash
cd workers/email-worker
npx wrangler deploy --config wrangler.prod.jsonc
```

### Step 3: Set secrets
```bash
npx wrangler secret put RESEND_API_KEY --config wrangler.prod.jsonc
# Paste the PROD Resend API key (the second key you created)

npx wrangler secret put EMAIL_SECRET --config wrangler.prod.jsonc
# Generate a new secret: run this in terminal:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste the output. This value must also go into config.js as the prod EMAIL_SECRET.
```

### Step 4: Note the worker URL
After deploy, note the URL for `config.js` (EMAIL_WORKER_URL prod value).

---

## 3. Update config.js

After deploying both workers, update `js/config.js` with the real URLs:
- Replace `PROD_PAYMENTS_WORKER_URL_HERE` with the payments worker URL
- Replace `PROD_EMAIL_WORKER_URL_HERE` with the email worker URL (or keep the dev URL if sharing)
- Replace `PROD_EMAIL_SECRET_HERE` with the prod email secret

Then commit, push to main, merge to production, and the mirror will update the prod repo.
