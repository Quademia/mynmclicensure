# Prod Workers Deployment Guide

Deploy both workers on the **prod Cloudflare account**.

---

## 1. Licensure Payment Worker

### Step 1: Authenticate Wrangler with the prod account
```bash
npx wrangler login
```
Log in with the prod Cloudflare email when the browser opens.

### Step 2: Deploy
```bash
cd mynmclicensure/workers/payment-worker
npx wrangler deploy --config wrangler.prod.jsonc
```

### Step 3: Set secrets
```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.prod.jsonc
npx wrangler secret put PAYSTACK_SECRET_KEY --config wrangler.prod.jsonc
```

### Step 4: Note the worker URL
URL will be: `https://qacademy-licensure-payment-worker.mybackpacc.workers.dev`
Confirm this matches `PAYMENTS_API_BASE` prod value in `mynmclicensure/js/config.js`.

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
