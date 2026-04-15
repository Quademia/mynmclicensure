export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      console.log({
        route: url.pathname,
        method: request.method
      });

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(request, env)
        });
      }

if (request.method === 'POST' && url.pathname === '/admin/subscriptions/grant') {
  return await handleAdminGrantSubscription(request, env);
}

if (request.method === 'POST' && url.pathname === '/admin/subscriptions/update') {
  return await handleAdminUpdateSubscription(request, env);
}

if (request.method === 'POST' && url.pathname === '/admin/subscriptions/revoke') {
  return await handleAdminRevokeSubscription(request, env);
}

if (request.method === 'POST' && url.pathname === '/admin/subscriptions/sync-expired') {
  return await handleAdminSyncExpiredSubscriptions(request, env);
}

if (request.method === 'POST' && url.pathname === '/payments/init-public') {
  return await handleInitPublic(request, env);
}

if (request.method === 'POST' && url.pathname === '/payments/init-upgrade') {
  return await handleInitUpgrade(request, env);
}

if (request.method === 'POST' && url.pathname === '/payments/setup-complete') {
  return await handleSetupComplete(request, env);
}

if (request.method === 'GET' && url.pathname === '/payments/verify') {
  return await handleVerify(request, env);
}

      return json(
        { ok: false, error: 'not_found' },
        404,
        corsHeaders(request, env)
      );
    } catch (err) {
      console.error('Worker fatal error:', {
        message: err?.message || String(err),
        stack: err?.stack || null
      });

      return json(
        {
          ok: false,
          error: 'server_error',
          message: err?.message || 'Unexpected worker error'
        },
        500,
        corsHeaders(request, env)
      );
    }
  }
};

/* ============================================================
 * CORS / RESPONSE HELPERS
 * ============================================================ */

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.APP_ORIGIN || '').trim();

  if (!allowed) {
    console.error('CORS: APP_ORIGIN env var is not set. Rejecting request.');
    return { 'Content-Type': 'application/json' };
  }

  const allowOrigin = origin === allowed ? origin : null;

  if (!allowOrigin) {
    console.warn(`CORS: Origin rejected — got "${origin}", expected "${allowed}"`);
    return { 'Content-Type': 'application/json' };
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

async function checkRateLimit(env, request) {
  if (!env.RATE_LIMITER) return { ok: true };
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    return { ok: success };
  } catch (err) {
    console.warn('Rate limiter error (fail open):', err?.message);
    return { ok: true };
  }
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function addDaysIso(baseIso, days) {
  const d = new Date(baseIso);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString();
}

function makeRef(prefix = 'QAC') {
  const part = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  return `${prefix}_${part}`;
}

function makeId(prefix) {
  const part = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  return `${prefix}_${part}`;
}

function makeSetupToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

/* ============================================================
 * SUPABASE REST HELPERS
 * Uses SERVICE ROLE key inside Worker
 * ============================================================ */

function sbBase(env) {
  return `${env.SUPABASE_URL}/rest/v1`;
}

function sbHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
}

function buildFilterParams(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, val]) => {
    if (!val) return;
    params.set(key, val);
  });

  return params;
}

async function sbSelect(env, table, { select = '*', filters = {}, order = '', limit = '' } = {}) {
  const params = buildFilterParams(filters);
  params.set('select', select);
  if (order) params.set('order', order);
  if (limit) params.set('limit', String(limit));

  const res = await fetch(`${sbBase(env)}/${table}?${params.toString()}`, {
    method: 'GET',
    headers: sbHeaders(env)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase select failed on ${table}: ${text}`);
  }

  return text ? JSON.parse(text) : [];
}

async function sbMaybeOne(env, table, opts = {}) {
  const rows = await sbSelect(env, table, { ...opts, limit: 1 });
  return rows[0] || null;
}

async function sbInsert(env, table, payload) {
  const res = await fetch(`${sbBase(env)}/${table}`, {
    method: 'POST',
    headers: {
      ...sbHeaders(env),
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase insert failed on ${table}: ${text}`);
  }

  const rows = text ? JSON.parse(text) : [];
  return rows[0] || null;
}

async function sbPatch(env, table, payload, filters = {}) {
  const params = buildFilterParams(filters);

  const res = await fetch(`${sbBase(env)}/${table}?${params.toString()}`, {
    method: 'PATCH',
    headers: {
      ...sbHeaders(env),
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase patch failed on ${table}: ${text}`);
  }

  const rows = text ? JSON.parse(text) : [];
  return rows[0] || null;
}

/* ============================================================
 * PAYSTACK HELPERS
 * ============================================================ */

async function paystackInitialize(env, payload) {
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok || !data?.status) {
    throw new Error(data?.message || 'Paystack initialize failed');
  }

  return data;
}

async function paystackVerify(env, reference) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await res.json();

  if (!res.ok || !data?.status) {
    throw new Error(data?.message || 'Paystack verify failed');
  }

  return data;
}
/* ============================================================
 * SUPABASE AUTH ADMIN HELPERS
 * Server-side only
 * ============================================================ */

function sbAuthBase(env) {
  return `${env.SUPABASE_URL}/auth/v1`;
}

function sbAuthHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
}

function makeUserId() {
  return makeId('U');
}

async function authAdminCreateUser(env, { email, password, forename, surname, phoneNumber = '' }) {
  const fullName = [forename, surname].filter(Boolean).join(' ').trim();

  const payload = {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      forename,
      surname,
      name: fullName,
      phone_number: phoneNumber || null
    }
  };

  const res = await fetch(`${sbAuthBase(env)}/admin/users`, {
    method: 'POST',
    headers: sbAuthHeaders(env),
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase auth create user failed: ${text}`);
  }

  const data = text ? JSON.parse(text) : null;

  // Supabase may return { user: {...} } depending on endpoint version
  return data?.user || data || null;
}
/* ============================================================
 * DATA HELPERS
 * ============================================================ */

async function getProductById(env, productId, requireActive = true) {
  const filters = {
    product_id: `eq.${productId}`
  };

  if (requireActive) {
    // products.status is lowercase in your current new stack
    filters.status = 'eq.active';
  }

  return sbMaybeOne(env, 'products', {
    select: 'product_id,name,duration_days,price_minor,currency,status',
    filters
  });
}

async function getUserByEmail(env, email) {
  return sbMaybeOne(env, 'users', {
    select: 'user_id,email,auth_id,forename,surname,name,active,program_id',
    filters: {
      email: `eq.${email}`
    }
  });
}

async function getUserById(env, userId) {
  return sbMaybeOne(env, 'users', {
    select: 'user_id,email,auth_id,forename,surname,name,active,program_id',
    filters: {
      user_id: `eq.${userId}`
    }
  });
}
async function getUserByAuthId(env, authId) {
  return sbMaybeOne(env, 'users', {
    select: 'user_id,email,auth_id,forename,surname,name,active,program_id,phone_number,role',
    filters: {
      auth_id: `eq.${authId}`
    }
  });
}

/**
 * Reads Bearer token from the request.
 * Example header:
 *   Authorization: Bearer eyJ...
 */
function getBearerToken(request) {
  const raw = String(request.headers.get('Authorization') || '').trim();
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

/**
 * Validates the logged-in Supabase session token and returns
 * the Auth user tied to that token.
 *
 * Important:
 * - We are NOT trusting any user_id sent from the browser.
 * - We resolve the current user server-side from the real session token.
 */
async function authGetUserFromAccessToken(env, accessToken) {
  if (!accessToken) return null;

  const res = await fetch(`${sbAuthBase(env)}/user`, {
    method: 'GET',
    headers: {
      // This identifies the Supabase project for the Auth API call
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,

      // This MUST be the logged-in user's real access token
      Authorization: `Bearer ${accessToken}`,

      'Content-Type': 'application/json'
    }
  });

  const text = await res.text();

  if (!res.ok) {
    console.warn('authGetUserFromAccessToken failed', {
      status: res.status,
      body: text || ''
    });
    return null;
  }

  return text ? JSON.parse(text) : null;
}
async function getPaymentByReference(env, reference) {
  return sbMaybeOne(env, 'payments', {
    select: '*',
    filters: {
      reference: `eq.${reference}`
    }
  });
}

async function getSubscriptionByPaymentRef(env, reference) {
  return sbMaybeOne(env, 'subscriptions', {
    select: '*',
    filters: {
      source: 'eq.PAYSTACK',
      source_ref: `eq.${reference}`
    }
  });
}
const ADMIN_SUB_STATUSES = ['ACTIVE', 'EXPIRED', 'REVOKED'];
const ADMIN_SUB_SOURCES  = ['SELF_TRIAL_SIGNUP', 'PAYSTACK', 'ADMIN'];

async function sbPatchMany(env, table, payload, filters = {}) {
  const params = buildFilterParams(filters);

  const res = await fetch(`${sbBase(env)}/${table}?${params.toString()}`, {
    method: 'PATCH',
    headers: {
      ...sbHeaders(env),
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase patch failed on ${table}: ${text}`);
  }

  return text ? JSON.parse(text) : [];
}

function normalizeUpper(val) {
  return String(val || '').trim().toUpperCase();
}

function isDateOnlyString(val) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(val || '').trim());
}

function dateOnlyToStartIso(val) {
  const s = String(val || '').trim();
  if (!isDateOnlyString(s)) return '';
  return `${s}T00:00:00.000Z`;
}

function dateOnlyToEndIso(val) {
  const s = String(val || '').trim();
  if (!isDateOnlyString(s)) return '';
  return `${s}T23:59:59.999Z`;
}

async function getSubscriptionById(env, subscriptionId) {
  return sbMaybeOne(env, 'subscriptions', {
    select: '*',
    filters: {
      subscription_id: `eq.${subscriptionId}`
    }
  });
}

async function getActiveSubscriptionForUserProduct(env, { userId, productId, excludeSubscriptionId = '' }) {
  const filters = {
    user_id: `eq.${userId}`,
    product_id: `eq.${productId}`,
    status: 'eq.ACTIVE',
    expires_utc: `gt.${nowIso()}`
  };

  if (excludeSubscriptionId) {
    filters.subscription_id = `neq.${excludeSubscriptionId}`;
  }

  return sbMaybeOne(env, 'subscriptions', {
    select: 'subscription_id,user_id,product_id,start_utc,expires_utc,status,source,source_ref',
    filters
  });
}

async function requireAdminFromRequest(request, env, body = null) {
  const accessToken =
    getBearerToken(request) ||
    String(body?.access_token || '').trim();

  if (!accessToken) {
    return {
      ok: false,
      response: json(
        {
          ok: false,
          error: 'missing_access_token',
          message: 'Admin session required'
        },
        401,
        corsHeaders(request, env)
      )
    };
  }

  const authUser = await authGetUserFromAccessToken(env, accessToken);

  if (!authUser?.id) {
    return {
      ok: false,
      response: json(
        {
          ok: false,
          error: 'invalid_or_expired_session',
          message: 'Please sign in again and retry'
        },
        401,
        corsHeaders(request, env)
      )
    };
  }

  const adminUser = await getUserByAuthId(env, authUser.id);

  if (!adminUser) {
    return {
      ok: false,
      response: json(
        {
          ok: false,
          error: 'user_profile_not_found',
          message: 'Signed-in user found, but no matching users row exists'
        },
        404,
        corsHeaders(request, env)
      )
    };
  }

  if (adminUser.active === false || adminUser.active === 'false') {
    return {
      ok: false,
      response: json(
        {
          ok: false,
          error: 'user_inactive',
          message: 'Your account is inactive'
        },
        403,
        corsHeaders(request, env)
      )
    };
  }

  if (String(adminUser.role || '').trim().toUpperCase() !== 'ADMIN') {
    return {
      ok: false,
      response: json(
        {
          ok: false,
          error: 'forbidden',
          message: 'Admin role required'
        },
        403,
        corsHeaders(request, env)
      )
    };
  }

  return {
    ok: true,
    accessToken,
    authUser,
    adminUser
  };
}
/* ============================================================
 * ACTIVATION HELPER
 * Rule:
 * - If same payment reference already activated, return it
 * - If same product already ACTIVE and unexpired, extend it
 * - Else create new ACTIVE subscription
 * ============================================================ */

async function activatePaymentForUser(env, payment, user) {
  if (!payment?.reference) {
    throw new Error('activatePaymentForUser: missing payment reference');
  }

  if (!user?.user_id) {
    throw new Error('activatePaymentForUser: missing user');
  }

  // Idempotency 1: if this payment reference already has a subscription, reuse it
  const existingByRef = await getSubscriptionByPaymentRef(env, payment.reference);
  if (existingByRef) {
    await sbPatch(
      env,
      'payments',
      {
        user_id: user.user_id,
        subscription_id: existingByRef.subscription_id,
        status: 'ACTIVATED',
        activated_utc: payment.activated_utc || nowIso()
      },
      { reference: `eq.${payment.reference}` }
    );

    return {
      mode: 'existing_by_ref',
      subscription: existingByRef
    };
  }

  const product = await getProductById(env, payment.product_id, false);
  if (!product) {
    throw new Error('Activation failed: product not found');
  }

  const currentTime = nowIso();

  // Find same-product ACTIVE + unexpired subscription
  const activeSameProduct = await sbMaybeOne(env, 'subscriptions', {
    select: '*',
    filters: {
      user_id: `eq.${user.user_id}`,
      product_id: `eq.${payment.product_id}`,
      status: 'eq.ACTIVE',
      expires_utc: `gt.${currentTime}`
    },
    order: 'expires_utc.desc'
  });

  if (activeSameProduct) {
    const newExpiryIso = addDaysIso(activeSameProduct.expires_utc, product.duration_days);

    const updatedSub = await sbPatch(
      env,
      'subscriptions',
      {
        expires_utc: newExpiryIso,
        status: 'ACTIVE',
        source: 'PAYSTACK',
        source_ref: payment.reference,
        expiry_reminded: false
      },
      { subscription_id: `eq.${activeSameProduct.subscription_id}` }
    );

    await sbPatch(
      env,
      'payments',
      {
        user_id: user.user_id,
        subscription_id: updatedSub.subscription_id,
        status: 'ACTIVATED',
        activated_utc: nowIso()
      },
      { reference: `eq.${payment.reference}` }
    );

    return {
      mode: 'extended',
      subscription: updatedSub
    };
  }

  const startIso = currentTime;
  const expiresIso = addDaysIso(startIso, product.duration_days);

  const newSubscription = await sbInsert(env, 'subscriptions', {
    subscription_id: makeId('SUB'),
    user_id: user.user_id,
    product_id: payment.product_id,
    start_utc: startIso,
    expires_utc: expiresIso,
    status: 'ACTIVE',
    source: 'PAYSTACK',
    source_ref: payment.reference,
    expiry_reminded: false
  });

  await sbPatch(
    env,
    'payments',
    {
      user_id: user.user_id,
      subscription_id: newSubscription.subscription_id,
      status: 'ACTIVATED',
      activated_utc: nowIso()
    },
    { reference: `eq.${payment.reference}` }
  );

  return {
    mode: 'created',
    subscription: newSubscription
  };
}

/* ============================================================
 * ROUTE: POST /payments/init-public
 * Body:
 * {
 *   email: "user@example.com",
 *   product_id: "RN_PREMIUM_30D",
 *   program_id: "RN",
 *   phone_number: "233..."
 * }
 * ============================================================ */

async function handleInitPublic(request, env) {
  const body = await readJson(request);

  if (!body) {
    return json(
      { ok: false, error: 'invalid_json' },
      400,
      corsHeaders(request, env)
    );
  }

  const rl = await checkRateLimit(env, request);
  if (!rl.ok) {
    return json(
      { ok: false, error: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' },
      429,
      corsHeaders(request, env)
    );
  }

  const email = String(body.email || '').trim().toLowerCase();
  const productId = String(body.product_id || '').trim();
  const programId = String(body.program_id || '').trim();
  const phoneNumber = String(body.phone_number || '').trim();

  if (!email || !productId) {
    return json(
      { ok: false, error: 'missing_required_fields', message: 'email and product_id are required' },
      400,
      corsHeaders(request, env)
    );
  }

  const product = await getProductById(env, productId, true);
  if (!product) {
    return json(
      { ok: false, error: 'product_not_found_or_inactive' },
      404,
      corsHeaders(request, env)
    );
  }

  const reference = makeRef('QAC');
  const callbackUrl = new URL('/mynmclicensure/payment-confirmation.html', env.APP_BASE_URL).toString();

  const paymentRow = await sbInsert(env, 'payments', {
    reference,
    status: 'INIT',
    email,
    user_id: null,
    product_id: product.product_id,
    product_name: product.name,
    amount_minor_expected: product.price_minor,
    currency: product.currency,
    amount_minor_paid: null,
    paid_utc: null,
    activated_utc: null,
    subscription_id: null,
    failure_note: null,
    raw: null,
    setup_token: null,
    setup_created_utc: null,
    setup_completed_utc: null,
    program_id: programId || null,
    phone_number: phoneNumber || null
  });

  try {
    const initPayload = {
      email,
      amount: product.price_minor,
      currency: product.currency,
      reference,
      callback_url: callbackUrl,
      metadata: {
        product_id: product.product_id,
        product_name: product.name,
        program_id: programId || null,
        phone_number: phoneNumber || null
      }
    };

    const initResult = await paystackInitialize(env, initPayload);

    await sbPatch(
      env,
      'payments',
      {
        raw: {
          init: initResult
        }
      },
      { reference: `eq.${reference}` }
    );

    return json(
      {
        ok: true,
        reference,
        authorization_url: initResult?.data?.authorization_url || '',
        access_code: initResult?.data?.access_code || '',
        payment: paymentRow
      },
      200,
      corsHeaders(request, env)
    );
  } catch (err) {
    await sbPatch(
      env,
      'payments',
      {
        status: 'FAILED',
        failure_note: err.message || 'Paystack initialize failed'
      },
      { reference: `eq.${reference}` }
    );

    return json(
      {
        ok: false,
        error: 'paystack_init_failed',
        message: err.message || 'Could not initialize payment'
      },
      500,
      corsHeaders(request, env)
    );
  }
}
/* ============================================================
 * ROUTE: POST /payments/init-upgrade
 * Body:
 * {
 *   product_id: "RM_2026_PREP",
 *   callback_url: "https://qacademy-gamma.pages.dev/mynmclicensure/payment-confirmation.html" // optional
 * }
 *
 * Auth:
 * - Requires a real logged-in Supabase access token in:
 *     Authorization: Bearer <access_token>
 *
 * Behaviour:
 * - Validates the current session token server-side
 * - Resolves the public users row by auth_id
 * - Creates an INIT payment row tied to the existing user
 * - Starts Paystack
 * - Returns authorization_url
 * ============================================================ */
async function handleInitUpgrade(request, env) {
  const body = await readJson(request);

  if (!body) {
    return json(
      { ok: false, error: 'invalid_json' },
      400,
      corsHeaders(request, env)
    );
  }

  const rl = await checkRateLimit(env, request);
  if (!rl.ok) {
    return json(
      { ok: false, error: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' },
      429,
      corsHeaders(request, env)
    );
  }

  const accessToken =
    getBearerToken(request) ||
    String(body.access_token || '').trim(); // optional fallback for testing only

  const productId = String(body.product_id || '').trim().toUpperCase();
  const callbackUrlInput = String(body.callback_url || '').trim();

  if (!accessToken) {
    return json(
      {
        ok: false,
        error: 'missing_access_token',
        message: 'A logged-in session is required for upgrade payments'
      },
      401,
      corsHeaders(request, env)
    );
  }

  if (!productId) {
    return json(
      {
        ok: false,
        error: 'missing_product_id'
      },
      400,
      corsHeaders(request, env)
    );
  }

  // 1) Resolve the current Auth user from the real session token
  const authUser = await authGetUserFromAccessToken(env, accessToken);

  if (!authUser?.id) {
    return json(
      {
        ok: false,
        error: 'invalid_or_expired_session',
        message: 'Please sign in again and retry'
      },
      401,
      corsHeaders(request, env)
    );
  }

  // 2) Resolve the matching public profile row
  const publicUser = await getUserByAuthId(env, authUser.id);

  if (!publicUser) {
    return json(
      {
        ok: false,
        error: 'user_profile_not_found',
        message: 'Signed-in Auth user found, but no matching users row exists'
      },
      404,
      corsHeaders(request, env)
    );
  }

  if (publicUser.active === false || publicUser.active === 'false') {
    return json(
      {
        ok: false,
        error: 'user_inactive'
      },
      403,
      corsHeaders(request, env)
    );
  }

  // 3) Load the product being purchased
  const product = await getProductById(env, productId, true);

  if (!product) {
    return json(
      {
        ok: false,
        error: 'product_not_found_or_inactive'
      },
      404,
      corsHeaders(request, env)
    );
  }

  const email = String(publicUser.email || authUser.email || '').trim().toLowerCase();

  if (!email) {
    return json(
      {
        ok: false,
        error: 'user_email_missing'
      },
      400,
      corsHeaders(request, env)
    );
  }

  const reference = makeRef('QAC');
  const callbackUrl =
    callbackUrlInput ||
    new URL('/mynmclicensure/payment-confirmation.html', env.APP_BASE_URL).toString();

  // 4) Create the payment audit row first
  await sbInsert(env, 'payments', {
    reference,
    status: 'INIT',
    email,
    user_id: publicUser.user_id,
    product_id: product.product_id,
    product_name: product.name,
    amount_minor_expected: product.price_minor,
    currency: product.currency,
    amount_minor_paid: null,
    paid_utc: null,
    activated_utc: null,
    subscription_id: null,
    failure_note: null,
    raw: {
      flow: 'upgrade',
      created_by: 'handleInitUpgrade'
    },
    setup_token: null,
    setup_created_utc: null,
    setup_completed_utc: null,
    program_id: publicUser.program_id || null,
    phone_number: publicUser.phone_number || null
  });

  // 5) Start Paystack
  try {
    const initPayload = {
      email,
      amount: product.price_minor,
      currency: product.currency,
      reference,
      callback_url: callbackUrl,
      metadata: {
        flow: 'upgrade',
        user_id: publicUser.user_id,
        auth_id: authUser.id,
        product_id: product.product_id,
        product_name: product.name,
        program_id: publicUser.program_id || null,
        phone_number: publicUser.phone_number || null
      }
    };

    const initResult = await paystackInitialize(env, initPayload);

    await sbPatch(
      env,
      'payments',
      {
        raw: {
          flow: 'upgrade',
          init: initResult
        }
      },
      { reference: `eq.${reference}` }
    );

    return json(
      {
        ok: true,
        reference,
        authorization_url: initResult?.data?.authorization_url || '',
        access_code: initResult?.data?.access_code || '',
        email,
        user_id: publicUser.user_id,
        product_id: product.product_id,
        product_name: product.name,
        amount_minor_expected: product.price_minor,
        currency: product.currency
      },
      200,
      corsHeaders(request, env)
    );
  } catch (err) {
    await sbPatch(
      env,
      'payments',
      {
        status: 'FAILED',
        failure_note: err?.message || 'Paystack initialize failed',
        raw: {
          flow: 'upgrade',
          init_error: err?.message || 'Paystack initialize failed'
        }
      },
      { reference: `eq.${reference}` }
    );

    return json(
      {
        ok: false,
        error: 'paystack_init_failed',
        message: err?.message || 'Could not initialize payment'
      },
      500,
      corsHeaders(request, env)
    );
  }
}
/* ============================================================
 * ROUTE: GET /payments/verify?reference=QAC_XXXX
 * Behaviour:
 * - If already ACTIVATED, return immediately
 * - If PAID / SETUP_REQUIRED, try local activation first
 * - Else verify with Paystack
 * - If verified and user exists -> activate
 * - If verified and no user exists -> SETUP_REQUIRED
 * ============================================================ */

async function handleVerify(request, env) {
  const url = new URL(request.url);
  const reference = String(url.searchParams.get('reference') || '').trim();

  if (!reference) {
    return json(
      { ok: false, error: 'missing_reference' },
      400,
      corsHeaders(request, env)
    );
  }

  const rl = await checkRateLimit(env, request);
  if (!rl.ok) {
    return json(
      { ok: false, error: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' },
      429,
      corsHeaders(request, env)
    );
  }

  let payment = await getPaymentByReference(env, reference);
  if (!payment) {
    return json(
      { ok: false, error: 'payment_not_found' },
      404,
      corsHeaders(request, env)
    );
  }

  // Fast path: already activated
  if (payment.status === 'ACTIVATED' && payment.subscription_id) {
    return json(
      {
        ok: true,
        status: 'ACTIVATED',
        reference: payment.reference,
        subscription_id: payment.subscription_id,
        requires_setup: false
      },
      200,
      corsHeaders(request, env)
    );
  }

  // Fast path: already paid / setup required -> try local activation first
  if (payment.status === 'PAID' || payment.status === 'SETUP_REQUIRED') {
    const existingUser =
      (payment.user_id && await getUserById(env, payment.user_id)) ||
      await getUserByEmail(env, payment.email);

    if (existingUser) {
      const activation = await activatePaymentForUser(env, payment, existingUser);

      return json(
        {
          ok: true,
          status: 'ACTIVATED',
          reference: payment.reference,
          subscription_id: activation.subscription.subscription_id,
          activation_mode: activation.mode,
          requires_setup: false
        },
        200,
        corsHeaders(request, env)
      );
    }

    // No user yet -> keep / move to SETUP_REQUIRED
    const setupToken = makeSetupToken();

    payment = await sbPatch(
      env,
      'payments',
      {
        status: 'SETUP_REQUIRED',
        setup_token: setupToken,
        setup_created_utc: nowIso()
      },
      { reference: `eq.${payment.reference}` }
    );

return json(
  {
    ok: true,
    status: 'SETUP_REQUIRED',
    reference: payment.reference,
    requires_setup: true,
    setup_token: payment.setup_token,
    email: payment.email || '',
    product_id: payment.product_id || '',
    product_name: payment.product_name || '',
    amount_minor_expected: payment.amount_minor_expected || null,
    currency: payment.currency || '',
    phone_number: payment.phone_number || '',
    program_id: payment.program_id || ''
  },
  200,
  corsHeaders(request, env)
);
  }

  // Hard stop if already marked failed
  if (payment.status === 'FAILED') {
    return json(
      {
        ok: false,
        status: 'FAILED',
        reference: payment.reference,
        failure_note: payment.failure_note || 'Payment already marked failed'
      },
      400,
      corsHeaders(request, env)
    );
  }

  // Normal verify path from INIT
  try {
    const verifyResult = await paystackVerify(env, reference);
    const tx = verifyResult?.data || {};

    const gatewayStatus = String(tx.status || '').toLowerCase();
    const amountPaid = Number(tx.amount || 0);
    const paidEmail = String(tx.customer?.email || payment.email || '').trim().toLowerCase();

    // If not yet successful, leave row in INIT and return a soft response
    if (gatewayStatus !== 'success') {
      return json(
        {
          ok: false,
          status: payment.status || 'INIT',
          reference,
          message: `Payment not successful yet. Gateway status: ${gatewayStatus || 'unknown'}`
        },
        409,
        corsHeaders(request, env)
      );
    }

    // Amount mismatch = terminal failure for this reference
    if (amountPaid !== Number(payment.amount_minor_expected || 0)) {
      await sbPatch(
        env,
        'payments',
        {
          status: 'FAILED',
          amount_minor_paid: amountPaid,
          failure_note: `Amount mismatch. Expected ${payment.amount_minor_expected}, got ${amountPaid}`,
          raw: {
            ...(payment.raw || {}),
            verify: verifyResult
          }
        },
        { reference: `eq.${reference}` }
      );

      return json(
        {
          ok: false,
          error: 'amount_mismatch',
          reference
        },
        400,
        corsHeaders(request, env)
      );
    }

    payment = await sbPatch(
      env,
      'payments',
      {
        status: 'PAID',
        email: paidEmail || payment.email,
        amount_minor_paid: amountPaid,
        paid_utc: payment.paid_utc || nowIso(),
        raw: {
          ...(payment.raw || {}),
          verify: verifyResult
        }
      },
      { reference: `eq.${reference}` }
    );

    const existingUser =
      (payment.user_id && await getUserById(env, payment.user_id)) ||
      await getUserByEmail(env, payment.email);

    if (existingUser) {
      const activation = await activatePaymentForUser(env, payment, existingUser);

      return json(
        {
          ok: true,
          status: 'ACTIVATED',
          reference: payment.reference,
          subscription_id: activation.subscription.subscription_id,
          activation_mode: activation.mode,
          requires_setup: false
        },
        200,
        corsHeaders(request, env)
      );
    }

    const setupToken = makeSetupToken();

    payment = await sbPatch(
      env,
      'payments',
      {
        status: 'SETUP_REQUIRED',
        setup_token: setupToken,
        setup_created_utc: nowIso()
      },
      { reference: `eq.${payment.reference}` }
    );

 return json(
  {
    ok: true,
    status: 'SETUP_REQUIRED',
    reference: payment.reference,
    requires_setup: true,
    setup_token: payment.setup_token,
    email: payment.email || '',
    product_id: payment.product_id || '',
    product_name: payment.product_name || '',
    amount_minor_expected: payment.amount_minor_expected || null,
    currency: payment.currency || '',
    phone_number: payment.phone_number || '',
    program_id: payment.program_id || ''
  },
  200,
  corsHeaders(request, env)
);
  } catch (err) {
    await sbPatch(
      env,
      'payments',
      {
        failure_note: err.message || 'Verify failed'
      },
      { reference: `eq.${reference}` }
    );

    return json(
      {
        ok: false,
        error: 'verify_failed',
        message: err.message || 'Could not verify payment'
      },
      500,
      corsHeaders(request, env)
    );
  }
}
/* ============================================================
 * ROUTE: POST /payments/setup-complete
 * Body:
 * {
 *   reference: "QAC_XXXX",
 *   setup_token: "...",
 *   forename: "Sam",
 *   surname: "Owusu",
 *   password: "StrongPassword123",
 *   phone_number: "233...",
 *   program_id: "RM"
 * }
 *
 * Behaviour:
 * - Requires payment to be PAID or SETUP_REQUIRED
 * - Validates setup token
 * - Creates Supabase Auth user
 * - Creates public users row
 * - Activates subscription using existing helper
 * ============================================================ */

async function handleSetupComplete(request, env) {
  const body = await readJson(request);

  if (!body) {
    return json(
      { ok: false, error: 'invalid_json' },
      400,
      corsHeaders(request, env)
    );
  }

  const rl = await checkRateLimit(env, request);
  if (!rl.ok) {
    return json(
      { ok: false, error: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' },
      429,
      corsHeaders(request, env)
    );
  }

  const reference = String(body.reference || '').trim();
  const setupToken = String(body.setup_token || '').trim();
  const forename = String(body.forename || '').trim();
  const surname = String(body.surname || '').trim();
  const password = String(body.password || '');
  const phoneNumberInput = String(body.phone_number || '').trim();
  const programIdInput = String(body.program_id || '').trim();

  if (!reference) {
    return json(
      { ok: false, error: 'missing_reference' },
      400,
      corsHeaders(request, env)
    );
  }

  if (!setupToken) {
    return json(
      { ok: false, error: 'missing_setup_token' },
      400,
      corsHeaders(request, env)
    );
  }

  if (!forename || !surname || !password) {
    return json(
      { ok: false, error: 'missing_required_fields', message: 'forename, surname and password are required' },
      400,
      corsHeaders(request, env)
    );
  }

  if (password.length < 8) {
    return json(
      { ok: false, error: 'password_policy_failed', message: 'Password must be at least 8 characters' },
      400,
      corsHeaders(request, env)
    );
  }

  let payment = await getPaymentByReference(env, reference);

  if (!payment) {
    return json(
      { ok: false, error: 'payment_not_found' },
      404,
      corsHeaders(request, env)
    );
  }

  if (payment.status === 'ACTIVATED' && payment.subscription_id) {
    return json(
      {
        ok: true,
        status: 'ACTIVATED',
        reference: payment.reference,
        subscription_id: payment.subscription_id,
        user_id: payment.user_id || null
      },
      200,
      corsHeaders(request, env)
    );
  }

  if (payment.status === 'FAILED') {
    return json(
      {
        ok: false,
        error: 'payment_failed',
        reference: payment.reference,
        failure_note: payment.failure_note || ''
      },
      400,
      corsHeaders(request, env)
    );
  }

  if (payment.status !== 'PAID' && payment.status !== 'SETUP_REQUIRED') {
    return json(
      {
        ok: false,
        error: 'payment_not_ready_for_setup',
        reference: payment.reference,
        status: payment.status || 'INIT'
      },
      409,
      corsHeaders(request, env)
    );
  }

  if (String(payment.setup_token || '').trim() !== setupToken) {
    return json(
      { ok: false, error: 'invalid_setup_token' },
      403,
      corsHeaders(request, env)
    );
  }

  const SETUP_TOKEN_LIFETIME_MS = 48 * 60 * 60 * 1000; // 48 hours
  const setupCreatedAt = payment.setup_created_utc ? new Date(payment.setup_created_utc).getTime() : 0;
  if (!setupCreatedAt || (Date.now() - setupCreatedAt) > SETUP_TOKEN_LIFETIME_MS) {
    console.warn(`setup_token_expired: reference=${payment.reference}, created=${payment.setup_created_utc}`);
    return json(
      {
        ok: false,
        error: 'setup_token_expired',
        message: 'This setup link has expired. Please contact support to get a new one sent to you.'
      },
      403,
      corsHeaders(request, env)
    );
  }

  const finalProgramId = programIdInput || String(payment.program_id || '').trim();
  const finalPhoneNumber = phoneNumberInput || String(payment.phone_number || '').trim() || null;

  if (!finalProgramId) {
    return json(
      { ok: false, error: 'missing_program_id' },
      400,
      corsHeaders(request, env)
    );
  }

  // Idempotency / recovery:
  // if a matching user already exists now, reuse it and activate.
  let existingUser =
    (payment.user_id && await getUserById(env, payment.user_id)) ||
    await getUserByEmail(env, String(payment.email || '').trim().toLowerCase());

  try {
    if (!existingUser) {
      const authUser = await authAdminCreateUser(env, {
        email: String(payment.email || '').trim().toLowerCase(),
        password,
        forename,
        surname,
        phoneNumber: finalPhoneNumber || ''
      });

      if (!authUser?.id) {
        throw new Error('Supabase auth create user returned no user id');
      }

      const publicUser = await sbInsert(env, 'users', {
        user_id: makeUserId(),
        auth_id: authUser.id,
        email: String(payment.email || '').trim().toLowerCase(),
        forename,
        surname,
        name: [forename, surname].filter(Boolean).join(' ').trim(),
        program_id: finalProgramId,
        phone_number: finalPhoneNumber,
        role: 'STUDENT',
        active: true,
        signup_source: 'PAYSTACK_SETUP',
        created_utc: nowIso()
      });

      existingUser = publicUser;
    }

    payment = await sbPatch(
      env,
      'payments',
      {
        user_id: existingUser.user_id,
        phone_number: finalPhoneNumber,
        program_id: finalProgramId,
        setup_completed_utc: payment.setup_completed_utc || nowIso(),
        raw: {
          ...((payment.raw && typeof payment.raw === 'object') ? payment.raw : {}),
          setup_complete: {
            ok: true,
            user_id: existingUser.user_id,
            email: String(payment.email || '').trim().toLowerCase(),
            program_id: finalProgramId,
            phone_number: finalPhoneNumber
          }
        }
      },
      { reference: `eq.${payment.reference}` }
    );

    const activation = await activatePaymentForUser(env, payment, existingUser);

    return json(
      {
        ok: true,
        status: 'ACTIVATED',
        reference: payment.reference,
        subscription_id: activation.subscription.subscription_id,
        activation_mode: activation.mode,
        user_id: existingUser.user_id,
        requires_setup: false
      },
      200,
      corsHeaders(request, env)
    );
  } catch (err) {
    const msg = err?.message || 'setup_complete_failed';

    await sbPatch(
      env,
      'payments',
      {
        failure_note: `setup_complete_failed: ${msg}`,
        raw: {
          ...((payment.raw && typeof payment.raw === 'object') ? payment.raw : {}),
          setup_complete: {
            ok: false,
            error: msg
          }
        }
      },
      { reference: `eq.${payment.reference}` }
    );

    return json(
      {
        ok: false,
        error: 'setup_complete_failed',
        message: msg
      },
      500,
      corsHeaders(request, env)
    );
  }
}
/* ============================================================
 * ADMIN SUBSCRIPTIONS
 * Trusted admin-only writes
 * ============================================================ */

async function handleAdminGrantSubscription(request, env) {
  const body = await readJson(request);

  if (!body) {
    return json({ ok: false, error: 'invalid_json' }, 400, corsHeaders(request, env));
  }

  const adminCtx = await requireAdminFromRequest(request, env, body);
  if (!adminCtx.ok) return adminCtx.response;

  const userId = String(body.user_id || '').trim();
  const productId = normalizeUpper(body.product_id);
  const startDate = String(body.start_date || '').trim();

  if (!userId) {
    return json(
      { ok: false, error: 'missing_user_id', message: 'Target user is required' },
      400,
      corsHeaders(request, env)
    );
  }

  if (!productId) {
    return json(
      { ok: false, error: 'missing_product_id', message: 'Product is required' },
      400,
      corsHeaders(request, env)
    );
  }

  const targetUser = await getUserById(env, userId);
  if (!targetUser) {
    return json(
      { ok: false, error: 'user_not_found', message: 'Target user was not found' },
      404,
      corsHeaders(request, env)
    );
  }

  if (targetUser.active === false || targetUser.active === 'false') {
    return json(
      { ok: false, error: 'user_inactive', message: 'Target user is inactive' },
      400,
      corsHeaders(request, env)
    );
  }

  const product = await getProductById(env, productId, true);
  if (!product) {
    return json(
      { ok: false, error: 'product_not_found_or_inactive', message: 'Product not found or inactive' },
      404,
      corsHeaders(request, env)
    );
  }

  const durationDays = Number(product.duration_days || 0);
  if (!durationDays || durationDays <= 0) {
    return json(
      { ok: false, error: 'product_duration_invalid', message: 'Product duration is invalid' },
      400,
      corsHeaders(request, env)
    );
  }

  // Check whether the user already has the same product active and unexpired.
  // If yes, we EXTEND it instead of blocking or creating a duplicate row.
  const existing = await getActiveSubscriptionForUserProduct(env, { userId, productId });

  if (existing) {
    const nowMs = Date.now();
    const currentExpiryMs = new Date(existing.expires_utc).getTime();
    const baseIso = currentExpiryMs > nowMs ? existing.expires_utc : nowIso();
    const newExpiresIso = addDaysIso(baseIso, durationDays);

    const updated = await sbPatch(
      env,
      'subscriptions',
      {
        expires_utc: newExpiresIso,
        status: 'ACTIVE',
        source: 'ADMIN',
        source_ref: 'admin_grant'
      },
      {
        subscription_id: `eq.${existing.subscription_id}`
      }
    );

    return json(
      {
        ok: true,
        mode: 'extended_existing',
        subscription: updated,
        granted_by_user_id: adminCtx.adminUser.user_id
      },
      200,
      corsHeaders(request, env)
    );
  }

  // No active same-product row exists, so create a fresh one.
  // If admin provided a start date, use midnight UTC of that date.
  let startIso = nowIso();
  if (startDate) {
    startIso = dateOnlyToStartIso(startDate);
    if (!startIso) {
      return json(
        { ok: false, error: 'invalid_start_date', message: 'Start date must be YYYY-MM-DD' },
        400,
        corsHeaders(request, env)
      );
    }
  }

  const expiresIso = addDaysIso(startIso, durationDays);

  const inserted = await sbInsert(env, 'subscriptions', {
    subscription_id: makeId('SUB'),
    user_id: userId,
    product_id: productId,
    start_utc: startIso,
    expires_utc: expiresIso,
    status: 'ACTIVE',
    source: 'ADMIN',
    source_ref: 'admin_grant',
    expiry_reminded: false
  });

  return json(
    {
      ok: true,
      mode: 'created_new',
      subscription: inserted,
      granted_by_user_id: adminCtx.adminUser.user_id
    },
    200,
    corsHeaders(request, env)
  );
}

async function handleAdminUpdateSubscription(request, env) {
  const body = await readJson(request);

  if (!body) {
    return json({ ok: false, error: 'invalid_json' }, 400, corsHeaders(request, env));
  }

  const adminCtx = await requireAdminFromRequest(request, env, body);
  if (!adminCtx.ok) return adminCtx.response;

  const subscriptionId = String(body.subscription_id || '').trim();
  const productId = normalizeUpper(body.product_id);
  const startDate = String(body.start_date || '').trim();
  const expiryDate = String(body.expiry_date || '').trim();
  const status = normalizeUpper(body.status);
  const source = normalizeUpper(body.source);
  const sourceRefInput = String(body.source_ref || '').trim();

  if (!subscriptionId) {
    return json(
      { ok: false, error: 'missing_subscription_id', message: 'Subscription ID is required' },
      400,
      corsHeaders(request, env)
    );
  }

  if (!productId) {
    return json(
      { ok: false, error: 'missing_product_id', message: 'Product is required' },
      400,
      corsHeaders(request, env)
    );
  }

  if (!isDateOnlyString(startDate)) {
    return json(
      { ok: false, error: 'invalid_start_date', message: 'Start date must be YYYY-MM-DD' },
      400,
      corsHeaders(request, env)
    );
  }

  if (!isDateOnlyString(expiryDate)) {
    return json(
      { ok: false, error: 'invalid_expiry_date', message: 'Expiry date must be YYYY-MM-DD' },
      400,
      corsHeaders(request, env)
    );
  }

  if (!ADMIN_SUB_STATUSES.includes(status)) {
    return json(
      { ok: false, error: 'invalid_status', message: `Allowed statuses: ${ADMIN_SUB_STATUSES.join(', ')}` },
      400,
      corsHeaders(request, env)
    );
  }

  if (!ADMIN_SUB_SOURCES.includes(source)) {
    return json(
      { ok: false, error: 'invalid_source', message: `Allowed sources: ${ADMIN_SUB_SOURCES.join(', ')}` },
      400,
      corsHeaders(request, env)
    );
  }

  const existing = await getSubscriptionById(env, subscriptionId);
  if (!existing) {
    return json(
      { ok: false, error: 'subscription_not_found', message: 'Subscription not found' },
      404,
      corsHeaders(request, env)
    );
  }

  const product = await getProductById(env, productId, false);
  if (!product) {
    return json(
      { ok: false, error: 'product_not_found', message: 'Product not found' },
      404,
      corsHeaders(request, env)
    );
  }

  const startIso = dateOnlyToStartIso(startDate);
  const expiresIso = dateOnlyToEndIso(expiryDate);

  if (!startIso || !expiresIso) {
    return json(
      { ok: false, error: 'invalid_dates', message: 'Start and expiry dates are required' },
      400,
      corsHeaders(request, env)
    );
  }

  if (new Date(expiresIso).getTime() <= new Date(startIso).getTime()) {
    return json(
      { ok: false, error: 'invalid_date_range', message: 'Expiry date must be after start date' },
      400,
      corsHeaders(request, env)
    );
  }

  if (status === 'ACTIVE' && new Date(expiresIso).getTime() > Date.now()) {
    const duplicate = await getActiveSubscriptionForUserProduct(env, {
      userId: existing.user_id,
      productId,
      excludeSubscriptionId: subscriptionId
    });

    if (duplicate) {
      return json(
        {
          ok: false,
          error: 'duplicate_active_subscription',
          message: 'Another active unexpired subscription already exists for this user and product'
        },
        409,
        corsHeaders(request, env)
      );
    }
  }

  const finalSourceRef =
    source === 'ADMIN'
      ? (sourceRefInput || 'admin_grant')
      : (sourceRefInput || null);

  const updated = await sbPatch(
    env,
    'subscriptions',
    {
      product_id: productId,
      start_utc: startIso,
      expires_utc: expiresIso,
      status,
      source,
      source_ref: finalSourceRef
    },
    {
      subscription_id: `eq.${subscriptionId}`
    }
  );

  return json(
    {
      ok: true,
      subscription: updated,
      updated_by_user_id: adminCtx.adminUser.user_id
    },
    200,
    corsHeaders(request, env)
  );
}

async function handleAdminRevokeSubscription(request, env) {
  const body = await readJson(request);

  if (!body) {
    return json({ ok: false, error: 'invalid_json' }, 400, corsHeaders(request, env));
  }

  const adminCtx = await requireAdminFromRequest(request, env, body);
  if (!adminCtx.ok) return adminCtx.response;

  const subscriptionId = String(body.subscription_id || '').trim();

  if (!subscriptionId) {
    return json(
      { ok: false, error: 'missing_subscription_id', message: 'Subscription ID is required' },
      400,
      corsHeaders(request, env)
    );
  }

  const existing = await getSubscriptionById(env, subscriptionId);
  if (!existing) {
    return json(
      { ok: false, error: 'subscription_not_found', message: 'Subscription not found' },
      404,
      corsHeaders(request, env)
    );
  }

  const updated = await sbPatch(
    env,
    'subscriptions',
    {
      status: 'REVOKED'
    },
    {
      subscription_id: `eq.${subscriptionId}`
    }
  );

  return json(
    {
      ok: true,
      subscription: updated,
      revoked_by_user_id: adminCtx.adminUser.user_id
    },
    200,
    corsHeaders(request, env)
  );
}

async function handleAdminSyncExpiredSubscriptions(request, env) {
  const body = await readJson(request).catch(() => null);

  const adminCtx = await requireAdminFromRequest(request, env, body || {});
  if (!adminCtx.ok) return adminCtx.response;

  const due = await sbSelect(env, 'subscriptions', {
    select: 'subscription_id',
    filters: {
      status: 'eq.ACTIVE',
      expires_utc: `lt.${nowIso()}`
    }
  });

  if (!due.length) {
    return json(
      {
        ok: true,
        updated_count: 0
      },
      200,
      corsHeaders(request, env)
    );
  }

  const updated = await sbPatchMany(
    env,
    'subscriptions',
    {
      status: 'EXPIRED'
    },
    {
      status: 'eq.ACTIVE',
      expires_utc: `lt.${nowIso()}`
    }
  );

  return json(
    {
      ok: true,
      updated_count: updated.length
    },
    200,
    corsHeaders(request, env)
  );
}
