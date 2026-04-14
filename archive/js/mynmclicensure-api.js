// ============================================================
// QAcademy — api.js
// Shared data access layer. All Supabase queries live here.
// Pages call these functions and use only the fields they need.
// ============================================================


// ── Secure ID & shuffle helpers ─────────────────────────────
function makeSecureId(prefix, byteLength = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return prefix + hex.toUpperCase();
}

function secureShuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const rand = (bytes[0] * 16777216 + bytes[1] * 65536 +
                  bytes[2] * 256 + bytes[3]) / 4294967296;
    const j = Math.floor(rand * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


// ------------------------------------------------------------
// PROGRAMMES
// Returns: array of { program_id, program_name }
// Used by: register page, admin filters, quiz builder
// ------------------------------------------------------------
async function getPrograms() {
    const { data, error } = await db
        .from('programs')
        .select('program_id, program_name, trial_product_id')
        .order('program_name');

    if (error) { console.error('getPrograms:', error); return []; }
    return data || [];
}


// ------------------------------------------------------------
// PRODUCTS (ACTIVE ONLY)
// Returns: array of all active products
// Used by: grant subscription modal, payment page, student-facing pages
// ------------------------------------------------------------
async function getProducts() {
  const { data, error } = await db
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('name');

  if (error) { console.error('getProducts:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// PRODUCTS (ALL — ADMIN ONLY)
// Returns: ALL products regardless of status (active + archived)
// Reason: admin products page needs to show and manage archived
//         products too. Student-facing pages use getProducts().
// Used by: admin/products.html, admin/subscriptions.html filters
// ------------------------------------------------------------
async function getAllProducts() {
  const { data, error } = await db
    .from('products')
    .select('*')
    .order('name');

  if (error) { console.error('getAllProducts:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// COURSES
// Returns: array of all active course fields
// Used by: student dashboard, quiz builder, admin courses
// ------------------------------------------------------------
async function getCourses() {
  const { data, error } = await db
    .from('courses')
    .select('*')
    .eq('status', 'active')
    .order('title');

  if (error) { console.error('getCourses:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// COURSES (ALL — ADMIN ONLY)
// Returns: ALL courses regardless of status (active, draft, archived)
// Reason: admin courses page needs to show and manage all statuses.
//         Student-facing pages use getCourses().
// Used by: admin/courses.html
// ------------------------------------------------------------
async function getAllCourses() {
  const { data, error } = await db
    .from('courses')
    .select('*')
    .order('title');

  if (error) { console.error('getAllCourses:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// GET SINGLE COURSE BY ID
// Returns: single course object or null
// Used by: student/course.html
// ------------------------------------------------------------
async function getCourseById(courseId) {
  const { data, error } = await db
    .from('courses')
    .select('*')
    .eq('course_id', courseId)
    .maybeSingle();

  if (error) { console.error('getCourseById:', error); return null; }
  return data;
}


// ------------------------------------------------------------
// USERS — LIST
// Returns: { users, total } — users is the current page, total is the full match count
// Reason: loading full data for hundreds of users is wasteful
// searchTerm: matches name or email (leave blank for all)
// roleFilter: 'STUDENT' | 'TEACHER' | 'ADMIN' | '' for all
// programFilter: program_id | '' for all
// page: page index starting at 0 (default 0)
// pageSize: rows per page (default 50)
// Used by: admin users page, admin subscriptions page
// ------------------------------------------------------------
async function getUsers(searchTerm = '', roleFilter = '', programFilter = '', page = 0, pageSize = 50) {
  let query = db
    .from('users')
    .select(`
      user_id,
      name,
      forename,
      surname,
      email,
      role,
      program_id,
      active,
      created_utc,
      level,
      cohort
    `, { count: 'exact' })
    .order('created_utc', { ascending: false });

  if (roleFilter) query = query.eq('role', roleFilter);
  if (programFilter) query = query.eq('program_id', programFilter);

  if (searchTerm) {
    const term = `%${searchTerm}%`;
    query = query.or(`name.ilike.${term},forename.ilike.${term},surname.ilike.${term},email.ilike.${term}`);
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, count, error } = await query;
  if (error) { console.error('getUsers:', error); return { users: [], total: 0 }; }

  return { users: data || [], total: count || 0 };
}


// ------------------------------------------------------------
// USERS — BATCH BY IDS
// Returns: array of user objects for the given user_id array
// Reason: pages that join payments → users need user details
//         for a small batch without loading the full users table
// Used by: admin/payments.html (attach user to each payment row)
// ------------------------------------------------------------
async function getUsersByIds(userIds) {
  if (!userIds || userIds.length === 0) return [];

  // Deduplicate
  const unique = [...new Set(userIds)];

  const { data, error } = await db
    .from('users')
    .select('user_id, name, forename, surname, email, program_id')
    .in('user_id', unique);

  if (error) { console.error('getUsersByIds:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// PAYMENTS — PAGINATED LIST
// Returns: paginated payment rows (no user join — no FK exists)
// Reason: payments table grows unbounded; loading all at once
//         is wasteful and slow for admins resolving issues
// searchTerm: matches reference or email (user search is client-side)
// statusFilter: 'ACTIVATED' | 'PAID' | 'SETUP_REQUIRED' | 'FAILED' | 'INIT' | ''
// productFilter: product_id | '' for all
// programFilter: program_id | '' for all (filtered client-side via joined user)
// dateFrom / dateTo: ISO date strings | '' for no limit
// page: page index starting at 0 (default 0)
// pageSize: rows per page (default 50)
// Returns: { payments, total }
// Used by: admin/payments.html
// ------------------------------------------------------------
async function getPaymentsPaginated(searchTerm = '', statusFilter = '', productFilter = '', programFilter = '', dateFrom = '', dateTo = '', page = 0, pageSize = 50) {
  let query = db
    .from('payments')
    .select(`
      reference,
      status,
      email,
      user_id,
      product_id,
      product_name,
      amount_minor_expected,
      currency,
      amount_minor_paid,
      paid_utc,
      activated_utc,
      subscription_id,
      failure_note,
      raw,
      setup_token,
      setup_created_utc,
      setup_completed_utc,
      program_id,
      phone_number
    `, { count: 'exact' })
    .order('paid_utc', { ascending: false, nullsFirst: false });

  if (statusFilter)  query = query.eq('status', statusFilter);
  if (productFilter) query = query.eq('product_id', productFilter);
  if (dateFrom)      query = query.gte('paid_utc', dateFrom);
  if (dateTo)        query = query.lte('paid_utc', dateTo);

  // Search reference and email only (no FK join to users table)
  if (searchTerm) {
    const term = `%${searchTerm}%`;
    query = query.or(`reference.ilike.${term},email.ilike.${term}`);
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, count, error } = await query;
  if (error) { console.error('getPaymentsPaginated:', error); return { payments: [], total: 0 }; }

  return { payments: data || [], total: count || 0 };
}


// ------------------------------------------------------------
// PAYMENTS — STATUS COUNTS
// Returns: { ACTIVATED, PAID, SETUP_REQUIRED, FAILED, INIT }
// Each value is the count of payments with that status.
// Uses head:true so zero rows are transferred — only counts.
// Used by: admin/payments.html stats row
// ------------------------------------------------------------
async function getPaymentStatusCounts() {
  const statuses = ['ACTIVATED', 'PAID', 'SETUP_REQUIRED', 'FAILED', 'INIT'];

  const results = await Promise.all(
    statuses.map(s =>
      db.from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', s)
        .then(({ count, error }) => {
          if (error) { console.error(`getPaymentStatusCounts(${s}):`, error); return 0; }
          return count || 0;
        })
    )
  );

  const counts = {};
  statuses.forEach((s, i) => { counts[s] = results[i]; });
  return counts;
}


// ------------------------------------------------------------
// USER — SINGLE (FULL DETAIL)
// Returns: complete user object including:
//   - all user profile fields
//   - active subscription (with product details)
//   - full subscription history
// Pages pick only the fields they need from this
// Used by: admin user panel, student dashboard, messaging
// ------------------------------------------------------------
async function getUserById(userId) {
  // Full user profile
  const { data: user, error: userError } = await db
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (userError || !user) {
    console.error('getUserById - user not found:', userError);
    return null;
  }

  // Active subscription with full product details joined
  const { data: activeSubscription } = await db
    .from('subscriptions')
    .select(`
      *,
      products (
        product_id,
        name,
        kind,
        duration_days,
        price_minor,
        currency,
        courses_included,
        telegram_group_keys
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .order('expires_utc', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Full subscription history (all past and current)
  const { data: subscriptionHistory } = await db
    .from('subscriptions')
    .select(`
      *,
      products ( name, kind )
    `)
    .eq('user_id', userId)
    .order('start_utc', { ascending: false });

  // Return everything together — pages use what they need
  return {
    ...user,
    activeSubscription: activeSubscription || null,
    subscriptionHistory: subscriptionHistory || []
  };
}


// ------------------------------------------------------------
// ASSIGN SUBSCRIPTION
// Grants a product subscription to a user
// Calculates expiry automatically from product.duration_days
// Returns: { success: true, subscriptionId } or { success: false, message }
// Used by: admin users page, admin subscriptions page
// ------------------------------------------------------------
async function assignSubscription(userId, productId, startDate = null) {
  // Get product to calculate expiry date and kind
  const { data: product, error: productError } = await db
    .from('products')
    .select('duration_days, kind')
    .eq('product_id', productId)
    .maybeSingle();

  if (productError || !product) {
    return { success: false, message: 'Product not found.' };
  }

  const start = startDate ? new Date(startDate) : new Date();
  const expires = new Date(start);
  expires.setDate(expires.getDate() + product.duration_days);

  const subscriptionId = makeSecureId('SUB_');

  const { error } = await db
    .from('subscriptions')
    .insert({
      subscription_id : subscriptionId,
      user_id         : userId,
      product_id      : productId,
      start_utc       : start.toISOString(),
      expires_utc     : expires.toISOString(),
      status          : 'ACTIVE',
      source          : 'ADMIN',
      source_ref      : 'admin_grant',
      expiry_reminded : false
    });

  if (error) {
    console.error('assignSubscription:', error);
    return { success: false, message: error.message };
  }

  return { success: true, subscriptionId };
}

// ------------------------------------------------------------
// WORKER HELPERS — TRUSTED ADMIN ACTIONS
// Uses the existing backend worker as the secure write boundary
// ------------------------------------------------------------
function workerBaseUrl() {
  const raw = String(PAYMENTS_API_BASE || '').trim();
  if (!raw) throw new Error('Missing PAYMENTS_API_BASE in /js/config.js');
  return raw.replace(/\/+$/, '');
}

async function workerAuthedJson(path, { method = 'GET', body = null } = {}) {
  const { data: { session }, error: sessionError } = await db.auth.getSession();

  if (sessionError || !session?.access_token) {
    return { success: false, message: 'Please sign in again.' };
  }

  const headers = {
    Authorization: `Bearer ${session.access_token}`
  };

  if (body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(workerBaseUrl() + path, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    return {
      success: false,
      message: data?.message || data?.error || `Request failed (${res.status})`,
      data
    };
  }

  return { success: true, data };
}

async function adminGrantSubscription(userId, productId, startDate = null) {
  return workerAuthedJson('/admin/subscriptions/grant', {
    method: 'POST',
    body: {
      user_id: userId,
      product_id: productId,
      start_date: startDate || null
    }
  });
}

async function adminUpdateSubscription(payload) {
  return workerAuthedJson('/admin/subscriptions/update', {
    method: 'POST',
    body: {
      subscription_id: payload.subscription_id,
      product_id: payload.product_id,
      start_date: payload.start_date,
      expiry_date: payload.expiry_date,
      status: payload.status,
      source: payload.source,
      source_ref: payload.source_ref || null
    }
  });
}

async function adminRevokeSubscription(subscriptionId) {
  return workerAuthedJson('/admin/subscriptions/revoke', {
    method: 'POST',
    body: {
      subscription_id: subscriptionId
    }
  });
}

async function adminSyncExpiredSubscriptions() {
  return workerAuthedJson('/admin/subscriptions/sync-expired', {
    method: 'POST',
    body: {}
  });
}
// ------------------------------------------------------------
// USER ACCOUNT ACTIONS
// All return: { success: true } or { success: false, message }
// ------------------------------------------------------------

// Deactivate — user can no longer log in
async function deactivateUser(userId) {
  const { error } = await db
    .from('users')
    .update({ active: false })
    .eq('user_id', userId);

  if (error) { console.error('deactivateUser:', error); return { success: false, message: error.message }; }
  return { success: true };
}

// Reactivate a previously deactivated account
async function activateUser(userId) {
  const { error } = await db
    .from('users')
    .update({ active: true })
    .eq('user_id', userId);

  if (error) { console.error('activateUser:', error); return { success: false, message: error.message }; }
  return { success: true };
}

// Send password reset email via Supabase Auth
async function sendPasswordReset(email) {
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password.html'
  });

  if (error) { console.error('sendPasswordReset:', error); return { success: false, message: error.message }; }
  return { success: true };
}

// Update any fields on a user profile
// fields: object of column:value pairs e.g. { role: 'TEACHER', level: 'L300' }
async function updateUserProfile(userId, fields) {
  const { error } = await db
    .from('users')
    .update(fields)
    .eq('user_id', userId);

  if (error) { console.error('updateUserProfile:', error); return { success: false, message: error.message }; }
  return { success: true };
}

// Upload a profile image to Supabase Storage (profile-images bucket)
// prefix: 'student', 'teacher', 'org' — prevents collisions
// Returns: public URL string, or null on error
async function uploadProfileImage(userId, file, prefix = 'user') {
  if (!file) return null;

  const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
  if (file.size > MAX_SIZE) {
    console.error('uploadProfileImage: file too large', file.size);
    return null;
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    console.error('uploadProfileImage: invalid type', file.type);
    return null;
  }

  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${prefix}_${userId}.${ext}`;

  const { data, error } = await db.storage
    .from('profile-images')
    .upload(fileName, file, { upsert: true, contentType: file.type });

  if (error) {
    console.error('uploadProfileImage:', error);
    return null;
  }

  const { data: urlData } = db.storage.from('profile-images').getPublicUrl(fileName);
  return urlData.publicUrl;
}


// ------------------------------------------------------------
// ANNOUNCEMENTS
// Returns: all active, in-schedule announcements
// Ordered: pinned first, then by priority
// Used by: student dashboard, announcements page
// ------------------------------------------------------------
async function getAnnouncements() {
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('announcements')
    .select('*')
    .eq('status', 'active')
    .or(`start_at.is.null,start_at.lte.${now}`)
    .or(`end_at.is.null,end_at.gte.${now}`)
    .order('pinned', { ascending: false })
    .order('priority', { ascending: false });

  if (error) { console.error('getAnnouncements:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// DISMISSED ANNOUNCEMENTS
// Returns: array of announcement IDs the user has dismissed
// Used by: student dashboard, announcements page
// ------------------------------------------------------------
async function getDismissedAnnouncements(userId) {
  const { data, error } = await db
    .from('user_notice_state')
    .select('item_id')
    .eq('user_id', userId)
    .eq('state', 'dismissed');

  if (error) { console.error('getDismissedAnnouncements:', error); return []; }
  return data ? data.map(d => d.item_id) : [];
}


// ------------------------------------------------------------
// STUDENT COURSE ACCESS
// Returns a map of every course the student can access,
// with stacked expiry calculated from ALL active subscriptions.
//
// Logic:
// - Fetch all ACTIVE subscriptions
// - For each subscription, loop through courses_included
// - For each course, sum remaining days across all subs
// - Return map: { course_id: { days, expires, label } }
//
// Used by: student dashboard, course pages
// ------------------------------------------------------------
async function getStudentCourseAccess(userId) {
  const now = new Date();

  // Fetch all active subscriptions with product details
  const { data: subscriptions, error } = await db
    .from('subscriptions')
    .select(`
      *,
      products (
        product_id,
        name,
        kind,
        courses_included
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  if (error) { console.error('getStudentCourseAccess:', error); return {}; }
  if (!subscriptions || subscriptions.length === 0) return {};

  // Build course access map
  // For each course, accumulate remaining days from every
  // active subscription that includes it
  const courseMap = {};

  subscriptions.forEach(sub => {
    if (!sub.products?.courses_included) return;

    const subExpiry      = new Date(sub.expires_utc);
    const remainingMs    = subExpiry - now;
    const remainingDays  = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

    // Skip expired subscriptions (safety check)
    if (remainingDays === 0) return;

    sub.products.courses_included.forEach(courseId => {
      if (!courseMap[courseId]) {
        // First subscription covering this course
        courseMap[courseId] = {
          totalDays: remainingDays,
          // Expiry = today + total stacked days
          expires: new Date(now.getTime() + remainingDays * 24 * 60 * 60 * 1000)
        };
      } else {
        // Stack on top of existing days for this course
        courseMap[courseId].totalDays += remainingDays;
        courseMap[courseId].expires = new Date(
          now.getTime() + courseMap[courseId].totalDays * 24 * 60 * 60 * 1000
        );
      }
    });
  });

  return courseMap;
}



// ------------------------------------------------------------
// FILTER ANNOUNCEMENTS FOR STUDENT
// Takes all announcements + student profile and returns only
// the ones this specific student qualifies to see.
//
// All scope fields work as AND logic:
// - Every condition set must be matched
// - Empty/null scope = no restriction on that field
//
// Used by: student dashboard strip, student announcements page
// ------------------------------------------------------------
function filterAnnouncementsForStudent(announcements, profile, subscriptionKind) {
  return announcements.filter(a => {

    // ── 1. Audience ──────────────────────────────────────
    // If scope_audience is STUDENTS, only students see it
    // Admins/Teachers are already on different pages so this
    // is mainly a safety check
    if (a.scope_audience === 'STUDENTS' && profile.role !== 'STUDENT') {
      return false;
    }

    // ── 2. Programme ─────────────────────────────────────
    // scope_programs is an array e.g. ['RN', 'RM']
    // If set, student's program_id must be in the list
    if (a.scope_programs && a.scope_programs.length > 0) {
      if (!a.scope_programs.includes(profile.program_id)) {
        return false;
      }
    }

    // ── 3. Level ─────────────────────────────────────────
    // scope_level is stored as a comma-separated string e.g. 'L100,L300'
    // If set, student's level must be in the list
    if (a.scope_level && a.scope_level.trim() !== '') {
      const allowedLevels = a.scope_level.split(',').map(s => s.trim());
      if (!allowedLevels.includes(profile.level)) {
        return false;
      }
    }

    // ── 4. Cohort ─────────────────────────────────────────
    // scope_cohort is a single value e.g. '2024'
    // If set, student's cohort must match exactly
    if (a.scope_cohort && a.scope_cohort.trim() !== '') {
      if (profile.cohort !== a.scope_cohort.trim()) {
        return false;
      }
    }

    // ── 5. Subscription Kind ──────────────────────────────
    // scope_subscription_kind e.g. 'TRIAL' | 'PAID' | 'FREE'
    // If set, student's active subscription kind must match
    if (a.scope_subscription_kind && a.scope_subscription_kind.trim() !== '') {
      if (subscriptionKind !== a.scope_subscription_kind.trim()) {
        return false;
      }
    }

    // ── 6. Specific Products ──────────────────────────────
    // scope_product_ids is an array e.g. ['RN_FULL', 'RN_TRIAL']
    // If set, student must have an active subscription to one
    // of these specific products
    if (a.scope_product_ids && a.scope_product_ids.length > 0) {
      // subscriptionKind alone is not enough here — we need product_id
      // We pass it separately as activeProductId
      if (!a.scope_product_ids.includes(profile.activeProductId)) {
        return false;
      }
    }

    // ── 7. Specific Users ─────────────────────────────────
    // scope_user_ids is an array of specific user_ids
    // If set, only those exact users see it
    if (a.scope_user_ids && a.scope_user_ids.length > 0) {
      if (!a.scope_user_ids.includes(profile.user_id)) {
        return false;
      }
    }

    // ── Passed all checks ─────────────────────────────────
    return true;
  });
}


// ============================================================
// QUIZ ENGINE FUNCTIONS
// ============================================================


// ------------------------------------------------------------
// GET CONFIG
// Returns: config table as a plain key-value object
// e.g. { runner_questions_per_page: 1, builder_max_questions: 50 }
//
// Why: runners and quiz builder read config once on load
//      to know questions per page, autosave interval etc.
//      Values are stored as TEXT in DB — converted to numbers here.
//
// Used by: runner/instant.html, runner/timed.html,
//          student/quiz-builder.html
// ------------------------------------------------------------
async function getConfig() {
  const { data, error } = await db
    .from('config')
    .select('key, value');

  if (error) { console.error('getConfig:', error); return {}; }

  // Convert array of {key, value} rows into a plain object
  // Also convert numeric strings to actual numbers
  const result = {};
  (data || []).forEach(row => {
    const num = Number(row.value);
    result[row.key] = isNaN(num) ? row.value : num;
  });
  return result;
}


// ------------------------------------------------------------
// GET QUIZZES FOR A COURSE
// Returns: array of quiz rows for the given course_id
//
// adminMode: if true, returns ALL statuses (for admin page)
//            if false (default), returns published=true only
//
// Why: student fixed-quizzes page only shows published quizzes.
//      Admin page needs to see drafts and archived too.
//
// Used by: student/fixed-quizzes.html, admin/fixed-quizzes.html
// ------------------------------------------------------------
async function getQuizzes(courseId, adminMode = false) {
  let query = db
    .from('quizzes')
    .select('*')
    .eq('course_id', courseId)
    .order('title');

  if (!adminMode) {
    query = query.eq('published', true).eq('status', 'active');
  }

  const { data, error } = await query;
  if (error) { console.error('getQuizzes:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// QUIZZES — PAGINATED LIST
// Returns: { quizzes, total } — paginated quiz rows for admin list
// Reason: quiz table will grow; paginate to keep list view fast
// searchTerm: matches title or quiz_id (leave blank for all)
// page: page index starting at 0 (default 0)
// pageSize: rows per page (default 50)
// Used by: admin/fixed-quizzes.html pane 1
// ------------------------------------------------------------
async function getAllQuizzesPaginated(searchTerm = '', page = 0, pageSize = 50) {
  let query = db
    .from('quizzes')
    .select(`
      quiz_id,
      course_id,
      title,
      status,
      published,
      allowed_modes,
      n,
      created_at
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (searchTerm) {
    const term = `%${searchTerm}%`;
    query = query.or(`title.ilike.${term},quiz_id.ilike.${term}`);
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, count, error } = await query;
  if (error) { console.error('getAllQuizzesPaginated:', error); return { quizzes: [], total: 0 }; }

  return { quizzes: data || [], total: count || 0 };
}


// ------------------------------------------------------------
// GET ALL QUIZZES (ADMIN — ALL COURSES)
// Returns: all quiz rows regardless of course or status
//
// Why: admin/fixed-quizzes.html needs to list and manage
//      quizzes across all courses in one place.
//
// Used by: admin/fixed-quizzes.html
// ------------------------------------------------------------
async function getAllQuizzes() {
  const { data, error } = await db
    .from('quizzes')
    .select('*')
    .order('course_id')
    .order('title');

  if (error) { console.error('getAllQuizzes:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// GET SINGLE QUIZ BY ID
// Returns: single quiz row or null
//
// Why: runner needs full quiz details (item_ids, time_limit_sec,
//      shuffle, allowed_modes) right before launching.
//
// Used by: runner/instant.html, runner/timed.html,
//          admin/fixed-quizzes.html (preview)
// ------------------------------------------------------------
async function getQuizById(quizId) {
  const { data, error } = await db
    .from('quizzes')
    .select('*')
    .eq('quiz_id', quizId)
    .maybeSingle();

  if (error) { console.error('getQuizById:', error); return null; }
  return data;
}


// ============================================================
// MOCK EXAMS
// Same shape as fixed quizzes but separate table (mock_quizzes)
// for independent lifecycle management during exam periods.
// ============================================================

// ------------------------------------------------------------
// GET MOCK QUIZZES FOR COURSE
// Returns: published, active mock quizzes for a course
//
// Why: student/mock-exams.html and student/course.html need
//      mock exams filtered to the student's enrolled courses.
//      Admin mode returns all regardless of status.
//
// Used by: student/mock-exams.html, student/course.html,
//          admin/mock-exams.html
// ------------------------------------------------------------
async function getMockQuizzes(courseId, adminMode = false) {
  let query = db
    .from('mock_quizzes')
    .select('*')
    .eq('course_id', courseId)
    .order('title');

  if (!adminMode) {
    query = query.eq('published', true).eq('status', 'active');
  }

  const { data, error } = await query;
  if (error) { console.error('getMockQuizzes:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// GET ALL MOCK QUIZZES (ADMIN — ALL COURSES)
// Returns: all mock quiz rows regardless of course or status
//
// Used by: admin/mock-exams.html
// ------------------------------------------------------------
async function getAllMockQuizzes() {
  const { data, error } = await db
    .from('mock_quizzes')
    .select('*')
    .order('course_id')
    .order('title');

  if (error) { console.error('getAllMockQuizzes:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// GET SINGLE MOCK QUIZ BY ID
// Returns: single mock quiz row or null
//
// Used by: admin/mock-exams.html (edit/preview)
// ------------------------------------------------------------
async function getMockQuizById(quizId) {
  const { data, error } = await db
    .from('mock_quizzes')
    .select('*')
    .eq('quiz_id', quizId)
    .maybeSingle();

  if (error) { console.error('getMockQuizById:', error); return null; }
  return data;
}


// ------------------------------------------------------------
// SPAWN MOCK EXAM ATTEMPT
// Returns: { attempt, isResume } or null on error
//
// Identical to spawnFixedAttempt except source = 'mock'.
// Reuses the shared attempts table.
//
// Used by: student/mock-exams.html
// ------------------------------------------------------------
async function spawnMockAttempt(userId, quiz, mode) {
  const { data: existing } = await db
    .from('attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('quiz_id', quiz.quiz_id)
    .eq('mode', mode)
    .eq('status', 'in_progress')
    .maybeSingle();

  if (existing) return { attempt: existing, isResume: true };

  let orderedIds = [...(quiz.item_ids || [])];
  if (quiz.shuffle) orderedIds = shuffleArray(orderedIds);

  const attemptId = 'ATT_' + Date.now() + '_' + makeSecureId('').slice(0, 7);
  const timeLimitSec = quiz.time_limit_sec || (quiz.n * 60);

  const { data: newAttempt, error } = await db
    .from('attempts')
    .insert({
      attempt_id:        attemptId,
      user_id:           userId,
      quiz_id:           quiz.quiz_id,
      course_id:         quiz.course_id,
      mode:              mode,
      source:            'mock',
      item_ids:          orderedIds.join(','),
      n:                 orderedIds.length,
      status:            'in_progress',
      ts_iso:            new Date().toISOString(),
      duration_min:      Math.ceil(timeLimitSec / 60),
      answers_json:      JSON.stringify([]),
      display_label:     quiz.title
    })
    .select()
    .single();

  if (error) { console.error('spawnMockAttempt:', error); return null; }
  return { attempt: newAttempt, isResume: false };
}


// ------------------------------------------------------------
// GET ITEMS BY IDS
// Returns: array of question rows from the correct items table
//
// courseId: determines which table to query (e.g. 'GP' → items_gp)
// itemIds:  array of item_id strings to fetch
//
// Why: each course has its own items table. This function maps
//      the course_id to the correct table name automatically.
//      The runner calls this to load just the questions it needs.
//
// Used by: runner/instant.html, runner/timed.html,
//          getAttemptForReview()
// ------------------------------------------------------------
async function getItemsByIds(courseId, itemIds) {
  if (!itemIds || itemIds.length === 0) return [];

  // Map course_id → items table name
  // course_id is stored uppercase (e.g. 'GP', 'RN_MED')
  // table name is items_ + lowercase course_id
  const tableName = 'items_' + courseId.toLowerCase();

  const { data, error } = await db
    .from(tableName)
    .select('*')
    .in('item_id', itemIds);

  if (error) { console.error('getItemsByIds:', error); return []; }

  // Return items in the SAME ORDER as itemIds array
  // Supabase does not guarantee order when using .in()
  // so we sort manually to match the quiz item_ids order
  const itemMap = {};
  (data || []).forEach(item => { itemMap[item.item_id] = item; });
  return itemIds.map(id => itemMap[id]).filter(Boolean);
}


// ------------------------------------------------------------
// GET ITEMS BY FILTERS (ADMIN ITEM PICKER)
// Returns: array of question rows matching the given filters
//
// courseId:      which items table to query
// filters: {
//   subject, maintopic, subtopic, difficulty,
//   question_type, batch_id, keyword
// }
//
// Why: admin uses this in the quiz builder item picker to
//      search and filter the question bank before selecting items.
//
// Used by: admin/fixed-quizzes.html (item picker)
// ------------------------------------------------------------
async function getItemsByFilters(courseId, filters = {}) {
  const tableName = 'items_' + courseId.toLowerCase();

  let query = db.from(tableName).select('*');

  if (filters.subject)       query = query.eq('subject', filters.subject);
  if (filters.maintopic)     query = query.eq('maintopic', filters.maintopic);
  if (filters.subtopic)      query = query.eq('subtopic', filters.subtopic);
  if (filters.difficulty)    query = query.eq('difficulty', filters.difficulty);
  if (filters.question_type) query = query.eq('question_type', filters.question_type);
  if (filters.batch_id)      query = query.eq('batch_id', filters.batch_id);

  // Keyword search — searches across all text fields
  if (filters.keyword) {
    const kw = filters.keyword.trim();
    query = query.or(
      `stem.ilike.%${kw}%,` +
      `option_a.ilike.%${kw}%,option_b.ilike.%${kw}%,` +
      `option_c.ilike.%${kw}%,option_d.ilike.%${kw}%,` +
      `option_e.ilike.%${kw}%,option_f.ilike.%${kw}%,` +
      `rationale.ilike.%${kw}%,` +
      `maintopic.ilike.%${kw}%,subtopic.ilike.%${kw}%,` +
      `subject.ilike.%${kw}%`
    );
  }

  query = query.order('item_id');

  const { data, error } = await query;
  if (error) { console.error('getItemsByFilters:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// GET DISTINCT FILTER VALUES FOR ITEM PICKER / QUIZ BUILDER
// Returns: unique real values for dropdowns/chips
//
// Why: builder and admin picker should both use real data-driven
//      filter values from the course items table.
//
// Used by: admin/fixed-quizzes.html,
//          student/quiz-builder.html
// ------------------------------------------------------------
async function getItemFilterOptions(courseId) {
  const tableName = 'items_' + courseId.toLowerCase();

  const { data, error } = await db
    .from(tableName)
    .select('subject, maintopic, subtopic, difficulty, question_type, batch_id');

  if (error) {
    console.error('getItemFilterOptions:', error);
    return {
      subjects: [],
      maintopics: [],
      subtopics: [],
      difficulties: [],
      question_types: [],
      batch_ids: []
    };
  }

  const unique = (arr) => [...new Set(
    (arr || [])
      .map(v => String(v || '').trim())
      .filter(Boolean)
  )].sort();

  const rows = data || [];

  return {
    subjects:       unique(rows.map(r => r.subject)),
    maintopics:     unique(rows.map(r => r.maintopic)),
    subtopics:      unique(rows.map(r => r.subtopic)),
    difficulties:   unique(rows.map(r => r.difficulty)),
    question_types: unique(rows.map(r => r.question_type)),
    batch_ids:      unique(rows.map(r => r.batch_id))
  };
}

// ------------------------------------------------------------
// GET BUILDER COURSE ITEMS
// Returns: lightweight item rows for client-side builder filtering
//
// Why: Builder v1 needs multi-select topics, difficulties,
//      question types, and concept matching. That is much easier
//      to do client-side once per selected course.
//
// Used by: student/quiz-builder.html
// ------------------------------------------------------------
async function getBuilderCourseItems(courseId) {
  const tableName = 'items_' + String(courseId || '').toLowerCase();

  const { data, error } = await db
    .from(tableName)
    .select(`
      item_id,
      subject,
      maintopic,
      subtopic,
      difficulty,
      question_type,
      stem,
      rationale
    `)
    .order('item_id');

  if (error) {
    console.error('getBuilderCourseItems:', error);
    return [];
  }

  return data || [];
}
// ------------------------------------------------------------
// SPAWN FIXED ATTEMPT
// Returns: { attempt, isResume }
//
// Called when student clicks Start Practice or Start Exam
// on a fixed quiz card.
//
// Logic:
// 1. Check for existing in_progress attempt (same quiz + mode)
// 2. If found → return it with isResume: true (student resumes)
// 3. If not found → create new attempt row, return with isResume: false
//
// shuffle: if quiz.shuffle=true, question order is randomised
//          using Fisher-Yates on item_ids before storing
//
// Why: prevents duplicate attempts if student clicks twice.
//      One in_progress slot per quiz per mode per student.
//
// Used by: student/fixed-quizzes.html
// ------------------------------------------------------------
async function spawnFixedAttempt(userId, quiz, mode) {
  // Step 1 — check for existing in_progress attempt
  const { data: existing } = await db
    .from('attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('quiz_id', quiz.quiz_id)
    .eq('mode', mode)
    .eq('status', 'in_progress')
    .maybeSingle();

  if (existing) return { attempt: existing, isResume: true };

  // Step 2 — build item order (shuffle if quiz.shuffle = true)
  let orderedIds = [...(quiz.item_ids || [])];
  if (quiz.shuffle) orderedIds = shuffleArray(orderedIds);

  // Step 3 — generate attempt ID
  const attemptId = 'ATT_' + Date.now() + '_' + makeSecureId('').slice(0, 7);

  // Step 4 — calculate time limit
  const timeLimitSec = quiz.time_limit_sec || (quiz.n * 60);

  // Step 5 — insert new attempt row
  const { data: newAttempt, error } = await db
    .from('attempts')
    .insert({
      attempt_id:        attemptId,
      user_id:           userId,
      quiz_id:           quiz.quiz_id,
      course_id:         quiz.course_id,
      mode:              mode,
      source:            'fixed',
      item_ids:          orderedIds.join(','),
      n:                 orderedIds.length,
      status:            'in_progress',
      ts_iso:            new Date().toISOString(),
      duration_min:      Math.ceil(timeLimitSec / 60),
      answers_json:      JSON.stringify([]),
      display_label:     quiz.title
    })
    .select()
    .single();

  if (error) { console.error('spawnFixedAttempt:', error); return null; }
  return { attempt: newAttempt, isResume: false };
}

// ------------------------------------------------------------
// BUILDER LABEL HELPERS
// Shared helper for builder attempts so runner/history headers
// show a meaningful title instead of a generic course code.
// ------------------------------------------------------------
function canonicalDifficultyLabel(d) {
  const s = String(d || '').trim().toLowerCase();
  if (s === 'easy') return 'Easy';
  if (s === 'moderate' || s === 'medium') return 'Moderate';
  if (s === 'hard' || s === 'difficult') return 'Hard';
  return '';
}

function buildBuilderDisplayLabel(meta = {}) {
  const maintopics   = Array.isArray(meta.maintopics) ? meta.maintopics.filter(Boolean) : [];
  const difficulties = Array.isArray(meta.difficulties) ? meta.difficulties.filter(Boolean) : [];
  const n            = Number(meta.n || 0);

  const mains = [...new Set(maintopics.map(v => String(v).trim()).filter(Boolean))].sort();

  let topicPart = 'Full bank';
  if (meta.selection_mode === 'concept') {
    const selectedConcepts = Array.isArray(meta.concepts) ? meta.concepts.filter(Boolean) : [];
    const conceptQuery = String(meta.concept_query || '').trim();

    if (selectedConcepts.length === 1 && !conceptQuery) {
      topicPart = selectedConcepts[0];
    } else if (selectedConcepts.length > 1) {
      topicPart = 'Concept mix';
    } else if (conceptQuery) {
      topicPart = conceptQuery;
    } else if (mains.length === 1) {
      topicPart = mains[0];
    }
  } else {
    if (mains.length === 1) {
      topicPart = mains[0];
    } else if (mains.length === 2) {
      topicPart = `${mains[0]} & ${mains[1]}`;
    } else if (mains.length === 3) {
      topicPart = `${mains[0]}, ${mains[1]} & ${mains[2]}`;
    } else if (mains.length > 3) {
      topicPart = 'Mixed topics';
    }
  }

  const order = ['Easy', 'Moderate', 'Hard'];
  const canon = [...new Set(
    difficulties
      .map(canonicalDifficultyLabel)
      .filter(Boolean)
  )].sort((a, b) => order.indexOf(a) - order.indexOf(b));

  let diffPart = 'All difficulties';
  if (canon.length === 1) {
    diffPart = `${canon[0]} only`;
  } else if (canon.length === 2) {
    diffPart = `${canon[0]}+${canon[1]}`;
  }

  return `Custom - ${topicPart} (${diffPart}, ${n}Q)`;
}
// ------------------------------------------------------------
// SPAWN BUILDER ATTEMPT
// Returns: newly created attempt row
//
// Called when student finishes the quiz builder wizard
// and clicks Build Quiz.
//
// Why: builder quizzes are always fresh — no resume logic
//      because every builder attempt is unique to the student.
//
// meta shape (optional):
// {
//   n,
//   selection_mode,        // 'topics' | 'concept'
//   maintopics,            // array
//   subtopics,             // array
//   difficulties,          // array
//   question_types,        // array
//   concepts,              // array
//   concept_query,         // string
//   display_label,         // optional explicit override
//   duration_min_override  // optional admin/operational override
// }
//
// Used by: student/quiz-builder.html
// ------------------------------------------------------------
async function spawnBuilderAttempt(userId, courseId, itemIds, mode, meta = {}) {
  const safeIds = Array.isArray(itemIds)
    ? itemIds.map(id => String(id || '').trim()).filter(Boolean)
    : [];

  if (!safeIds.length) {
    console.error('spawnBuilderAttempt: no item IDs provided');
    return null;
  }

  const attemptId = 'ATT_' + Date.now() + '_' + makeSecureId('').slice(0, 7);

  // Default timed rule: 1 minute per question
  const defaultDurationMin = safeIds.length;
  const durationMin = Number(meta.duration_min_override) > 0
    ? Number(meta.duration_min_override)
    : defaultDurationMin;

  const displayLabel =
    String(meta.display_label || '').trim() ||
    buildBuilderDisplayLabel({
      selection_mode: meta.selection_mode || 'topics',
      maintopics: meta.maintopics || [],
      difficulties: meta.difficulties || [],
      concepts: meta.concepts || [],
      concept_query: meta.concept_query || '',
      n: Number(meta.n || safeIds.length)
    });

  const { data, error } = await db
    .from('attempts')
    .insert({
      attempt_id:    attemptId,
      user_id:       userId,
      quiz_id:       null,
      course_id:     courseId,
      mode:          mode,
      source:        'builder',
      item_ids:      safeIds.join(','),
      n:             safeIds.length,
      status:        'in_progress',
      ts_iso:        new Date().toISOString(),
      duration_min:  durationMin,
      answers_json:  JSON.stringify([]),
      display_label: displayLabel
    })
    .select()
    .single();

  if (error) {
    console.error('spawnBuilderAttempt:', error);
    return null;
  }

  return data;
}

// ============================================================
// OFFLINE PACK FUNCTIONS
// Shared by:
//   - student/offline-pack-builder.html
//   - student/offline-pack-renderer.html
//   - student/my-offline-packs.html
//
// Design:
//   - Reuse the SAME builder filtering/picking flow client-side
//   - At submit time, do offline-specific checks here
//   - Save immutable snapshot row to offline_packs
//   - Renderer reads only from saved snapshot
// ============================================================

// ------------------------------------------------------------
// OFFLINE HELPERS
// ------------------------------------------------------------
function makeOfflinePackId() {
  return 'PACK_' + Date.now() + '_' + makeSecureId('').slice(0, 8);
}

function safeArray(values) {
  return Array.isArray(values)
    ? [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))]
    : [];
}
async function getUsedOfflinePackItemIds(userId, courseId, periodStartIso = null) {
  const safeUserId = String(userId || '').trim();
  const safeCourseId = String(courseId || '').trim().toUpperCase();

  if (!safeUserId || !safeCourseId) return new Set();

  let query = db
    .from('offline_packs')
    .select('item_ids')
    .eq('user_id', safeUserId)
    .eq('course_id', safeCourseId)
    .eq('status', 'active');

  if (periodStartIso) {
    query = query.gte('created_utc', periodStartIso);
  }

  const { data, error } = await query;

  if (error) {
    console.error('getUsedOfflinePackItemIds:', error);
    return new Set();
  }

  const used = new Set();

  (data || []).forEach(row => {
    const ids = Array.isArray(row.item_ids) ? row.item_ids : [];
    ids.forEach(id => {
      const safeId = String(id || '').trim();
      if (safeId) used.add(safeId);
    });
  });

  return used;
}

async function pickOfflinePackItemIds(userId, courseId, poolItems, n, periodStartIso = null) {
  const pool = Array.isArray(poolItems) ? poolItems : [];
  const target = Math.max(0, Number(n || 0));

  if (!pool.length || target < 1) {
    return {
      item_ids: [],
      unused_selected: 0,
      reused_selected: 0,
      pool_size: pool.length
    };
  }

  const usedSet = await getUsedOfflinePackItemIds(userId, courseId, periodStartIso);

  const unusedCandidates = [];
  const usedCandidates = [];

  pool.forEach(item => {
    const itemId = String(item && item.item_id || '').trim();
    if (!itemId) return;

    if (usedSet.has(itemId)) usedCandidates.push(item);
    else unusedCandidates.push(item);
  });

  const takeUnused = Math.min(target, unusedCandidates.length);
  const needMore = Math.max(0, target - takeUnused);

  const pickedUnused = takeUnused > 0
    ? shuffleArray(unusedCandidates).slice(0, takeUnused)
    : [];

  const pickedUsed = needMore > 0
    ? shuffleArray(usedCandidates).slice(0, needMore)
    : [];

  const picked = pickedUnused.concat(pickedUsed);

  return {
    item_ids: picked.map(x => String(x.item_id || '').trim()).filter(Boolean),
    unused_selected: pickedUnused.length,
    reused_selected: pickedUsed.length,
    pool_size: pool.length
  };
}
function maskEmailForOffline(email) {
  const raw = String(email || '').trim();
  if (!raw || !raw.includes('@')) return '';
  const [name, domain] = raw.split('@');
  if (!name || !domain) return raw;

  if (name.length <= 2) {
    return `${name[0] || '*'}***@${domain}`;
  }

  return `${name.slice(0, 3)}***@${domain}`;
}

function buildOfflineOwnerLabel(name, maskedEmail) {
  const safeName = String(name || '').trim() || 'QAcademy Student';
  const safeMail = String(maskedEmail || '').trim();
  return safeMail
    ? `Prepared for: ${safeName} (${safeMail})`
    : `Prepared for: ${safeName}`;
}

function canonicalOfflineDifficultyLabel(d) {
  const s = String(d || '').trim().toLowerCase();
  if (s === 'easy') return 'Easy';
  if (s === 'moderate' || s === 'medium') return 'Moderate';
  if (s === 'hard' || s === 'difficult') return 'Hard';
  return String(d || '').trim();
}

function buildOfflinePackDisplayLabel(meta = {}) {
  const maintopics   = safeArray(meta.maintopics);
  const difficulties = safeArray(meta.difficulties).map(canonicalOfflineDifficultyLabel).filter(Boolean);
  const n            = Number(meta.n || meta.question_count || 0);

  let focus = 'Offline Pack';

  if (meta.selection_mode === 'concept') {
    const concepts = safeArray(meta.concepts);
    const q = String(meta.concept_query || '').trim();

    if (concepts.length === 1 && !q) {
      focus = concepts[0];
    } else if (concepts.length > 1) {
      focus = 'Concept Mix';
    } else if (q) {
      focus = q;
    } else if (maintopics.length === 1) {
      focus = maintopics[0];
    }
  } else {
    if (maintopics.length === 1) {
      focus = maintopics[0];
    } else if (maintopics.length > 1) {
      focus = 'Mixed Topics';
    } else {
      focus = 'Full Bank';
    }
  }

  let diffPart = 'All difficulties';
  const canon = [...new Set(difficulties)];

  if (canon.length === 1) diffPart = `${canon[0]} only`;
  else if (canon.length === 2) diffPart = `${canon[0]} + ${canon[1]}`;

  return `${focus} (${diffPart}${n > 0 ? `, ${n}Q` : ''})`;
}

function buildOfflinePackDefaultName(meta = {}) {
  return buildOfflinePackDisplayLabel(meta).slice(0, 80) || 'Offline Pack';
}

function isActiveSubscriptionNow(sub) {
  if (!sub) return false;
  if (String(sub.status || '').toUpperCase() !== 'ACTIVE') return false;

  const now = Date.now();
  const exp = sub.expires_utc ? new Date(sub.expires_utc).getTime() : null;
  if (!exp || Number.isNaN(exp)) return false;

  return exp > now;
}

function includesCourse(sub, courseId) {
  const cid = String(courseId || '').trim().toUpperCase();
  const arr = Array.isArray(sub?.products?.courses_included) ? sub.products.courses_included : [];
  return arr.map(v => String(v || '').trim().toUpperCase()).includes(cid);
}

function isTrialProduct(sub) {
  return String(sub?.products?.kind || '').trim().toUpperCase() === 'TRIAL';
}

// ------------------------------------------------------------
// OFFLINE USER / SUBS HELPERS
// ------------------------------------------------------------
async function getOfflinePackUserProfile(userId) {
  const { data, error } = await db
    .from('users')
    .select('user_id, name, forename, surname, email')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    console.error('getOfflinePackUserProfile:', error);
    return null;
  }

  const fullName =
    String(data.name || '').trim() ||
    `${String(data.forename || '').trim()} ${String(data.surname || '').trim()}`.trim() ||
    'QAcademy Student';

  return {
    user_id: data.user_id,
    owner_name: fullName,
    owner_email: String(data.email || '').trim()
  };
}

async function getSubscriptionsForOfflineCourse(userId, courseId) {
  const { data, error } = await db
    .from('subscriptions')
    .select(`
      subscription_id,
      user_id,
      product_id,
      start_utc,
      expires_utc,
      status,
      source,
      products (
        product_id,
        name,
        kind,
        courses_included
      )
    `)
    .eq('user_id', userId);

  if (error) {
    console.error('getSubscriptionsForOfflineCourse:', error);
    return [];
  }

  return (data || []).filter(sub => includesCourse(sub, courseId));
}

// ------------------------------------------------------------
// OFFLINE ALLOWANCE
// Returns:
// {
//   ok,
//   allowed,
//   blocked_reason,         // null | not_subscribed | renew_required | trial_not_allowed
//   course_id,
//   downloads_per_course,
//   used_this_period,
//   remaining,
//   period_start,
//   is_trial
// }
// ------------------------------------------------------------
async function getOfflinePackAllowance(userId, courseId) {
  const safeCourseId = String(courseId || '').trim().toUpperCase();
  const cfg = await getConfig();

  const downloadsPerCourse = Number(cfg.offline_packs_per_course) > 0
    ? Number(cfg.offline_packs_per_course)
    : 3;

  const allCourseSubs = await getSubscriptionsForOfflineCourse(userId, safeCourseId);

  if (!allCourseSubs.length) {
    return {
      success: false,
      allowed: false,
      blocked_reason: 'not_subscribed',
      course_id: safeCourseId,
      downloads_per_course: downloadsPerCourse,
      used_this_period: 0,
      remaining: 0,
      period_start: null,
      is_trial: false
    };
  }

  const activeCourseSubs = allCourseSubs.filter(isActiveSubscriptionNow);

  if (!activeCourseSubs.length) {
    return {
      success: false,
      allowed: false,
      blocked_reason: 'renew_required',
      course_id: safeCourseId,
      downloads_per_course: downloadsPerCourse,
      used_this_period: 0,
      remaining: 0,
      period_start: null,
      is_trial: false
    };
  }

  const qualifyingSubs = activeCourseSubs.filter(sub => !isTrialProduct(sub));

  if (!qualifyingSubs.length) {
    return {
      success: false,
      allowed: false,
      blocked_reason: 'trial_not_allowed',
      course_id: safeCourseId,
      downloads_per_course: downloadsPerCourse,
      used_this_period: 0,
      remaining: 0,
      period_start: null,
      is_trial: true
    };
  }

  const periodStartIso = qualifyingSubs
    .map(sub => String(sub.start_utc || '').trim())
    .filter(Boolean)
    .sort()[0] || null;

  let query = db
    .from('offline_packs')
    .select('pack_id, created_utc', { count: 'exact' })
    .eq('user_id', userId)
    .eq('course_id', safeCourseId)
    .eq('status', 'active');

  if (periodStartIso) {
    query = query.gte('created_utc', periodStartIso);
  }

  const { count, error } = await query;

  if (error) {
    console.error('getOfflinePackAllowance:', error);
    return {
      success: false,
      allowed: false,
      blocked_reason: 'allowance_check_failed',
      course_id: safeCourseId,
      downloads_per_course: downloadsPerCourse,
      used_this_period: 0,
      remaining: 0,
      period_start: periodStartIso,
      is_trial: false
    };
  }

  const usedThisPeriod = Number(count || 0);
  const remaining = Math.max(0, downloadsPerCourse - usedThisPeriod);

  return {
    success: true,
    allowed: remaining > 0,
    blocked_reason: null,
    course_id: safeCourseId,
    downloads_per_course: downloadsPerCourse,
    used_this_period: usedThisPeriod,
    remaining,
    period_start: periodStartIso,
    is_trial: false
  };
}

// ------------------------------------------------------------
// CREATE OFFLINE PACK
// payload shape:
// {
//   course_id,
//   item_ids,               // REQUIRED final chosen item IDs in order
//   question_count,         // optional
//   pack_name,              // optional
//   selection_mode,         // 'topics' | 'concept'
//   maintopics,             // array
//   subtopics,              // array
//   difficulties,           // array
//   question_types,         // array
//   concepts,               // array (not stored separately, used for naming only)
//   concept_query,          // string
//   display_label           // optional
// }
//
// Returns:
// {
//   success,
//   pack_id,
//   blocked_reason,
//   remaining,
//   pack
// }
// ------------------------------------------------------------
async function createOfflinePack(userId, payload = {}) {
  const safeCourseId = String(payload.course_id || '').trim().toUpperCase();
  const safeIds = safeArray(payload.item_ids);
  const cfg = await getConfig();

  const maxQuestions = Number(cfg.offline_max_questions) > 0
    ? Number(cfg.offline_max_questions)
    : 50;

  if (!safeCourseId) {
    return { success: false, blocked_reason: 'missing_course_id', message: 'Course is required.' };
  }

  if (!safeIds.length) {
    return { success: false, blocked_reason: 'no_items_match', message: 'No questions were selected.' };
  }

  if (safeIds.length > maxQuestions) {
    return {
      success: false,
      blocked_reason: 'question_limit_exceeded',
      message: `This offline pack exceeds the current limit of ${maxQuestions} questions.`
    };
  }

  const allowance = await getOfflinePackAllowance(userId, safeCourseId);
  if (!allowance.success) {
    return {
      success: false,
      blocked_reason: allowance.blocked_reason || 'not_allowed',
      message: 'Offline pack access is currently blocked.',
      allowance
    };
  }

  if (allowance.remaining < 1) {
    return {
      success: false,
      blocked_reason: 'limit_reached',
      message: 'You have reached your offline pack limit for this course.',
      allowance
    };
  }

  const profile = await getOfflinePackUserProfile(userId);
  if (!profile) {
    return { success: false, blocked_reason: 'user_not_found', message: 'User profile not found.' };
  }

  const packId = makeOfflinePackId();
  const ownerEmailMask = maskEmailForOffline(profile.owner_email);
  const watermark = {
    pack_id: packId,
    user_id: String(userId).trim(),
    owner_name: profile.owner_name,
    owner_email_mask: ownerEmailMask,
    owner_label: buildOfflineOwnerLabel(profile.owner_name, ownerEmailMask)
  };

  const metaForLabels = {
    n: safeIds.length,
    question_count: safeIds.length,
    selection_mode: payload.selection_mode || 'topics',
    maintopics: payload.maintopics || [],
    difficulties: payload.difficulties || [],
    concepts: payload.concepts || [],
    concept_query: payload.concept_query || ''
  };

  const displayLabel =
    String(payload.display_label || '').trim() ||
    buildOfflinePackDisplayLabel(metaForLabels);

  const packName =
    String(payload.pack_name || '').trim() ||
    buildOfflinePackDefaultName(metaForLabels);

  const insertRow = {
    pack_id:         packId,
    user_id:         String(userId).trim(),
    course_id:       safeCourseId,
    pack_name:       packName.slice(0, 120),
    selection_mode:  String(payload.selection_mode || 'topics').trim().toLowerCase() === 'concept' ? 'concept' : 'topics',
    maintopics:      safeArray(payload.maintopics),
    subtopics:       safeArray(payload.subtopics),
    difficulties:    safeArray(payload.difficulties),
    question_types:  safeArray(payload.question_types),
    concept_query:   String(payload.concept_query || '').trim() || null,
    display_label:   displayLabel,
    item_ids:        safeIds,
    question_count:  safeIds.length,
    watermark:       watermark,
    status:          'active'
  };

  const { data, error } = await db
    .from('offline_packs')
    .insert(insertRow)
    .select()
    .single();

  if (error) {
    console.error('createOfflinePack:', error);
    return { success: false, blocked_reason: 'insert_failed', message: error.message };
  }

  return {
    success: true,
    pack_id: packId,
    remaining: Math.max(0, (allowance.remaining || 0) - 1),
    pack: {
      ...data,
      created_at: data.created_utc,
      topics: data.maintopics,
      question_ids: data.item_ids
    }
  };
}

// ------------------------------------------------------------
// GET OFFLINE PACK FOR RENDER
// Returns:
// {
//   success,
//   pack,
//   items,
//   missing_item_ids
// }
// ------------------------------------------------------------
async function getOfflinePackForRender(userId, packId) {
  const { data: pack, error } = await db
    .from('offline_packs')
    .select('*')
    .eq('pack_id', packId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('getOfflinePackForRender:', error);
    return { success: false, code: 'pack_lookup_failed', message: error.message };
  }

  if (!pack) {
    return { success: false, code: 'pack_not_found', message: 'Offline pack not found.' };
  }

  if (String(pack.status || '').toLowerCase() !== 'active') {
    return { success: false, code: 'pack_inactive', message: 'This offline pack is not active.' };
  }

  const savedIds = Array.isArray(pack.item_ids) ? pack.item_ids : [];
  const items = await getItemsByIds(pack.course_id, savedIds);

  const foundSet = new Set((items || []).map(it => String(it.item_id || '').trim()));
  const missingItemIds = savedIds.filter(id => !foundSet.has(String(id || '').trim()));

  return {
    success: true,
    pack: {
      ...pack,
      created_at: pack.created_utc,
      topics: Array.isArray(pack.maintopics) ? pack.maintopics : [],
      question_ids: savedIds
    },
    items: items || [],
    missing_item_ids: missingItemIds
  };
}

// ------------------------------------------------------------
// LIST OFFLINE PACKS
// filters:
// {
//   course_id: '',
//   status: '',
//   limit: 100,
//   offset: 0
// }
//
// Returns:
// {
//   success,
//   total,
//   items: [
//     {
//       pack_id,
//       course_id,
//       course_title,
//       course_name,   // alias for old page compatibility
//       pack_name,
//       question_count,
//       status,
//       created_utc,
//       created_at     // alias for old page compatibility
//     }
//   ]
// }
// ------------------------------------------------------------
async function listOfflinePacks(userId, filters = {}) {
  const safeLimit  = Math.max(1, Math.min(Number(filters.limit || 100), 200));
  const safeOffset = Math.max(0, Number(filters.offset || 0));

  let query = db
    .from('offline_packs')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_utc', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (filters.course_id) query = query.eq('course_id', String(filters.course_id).trim().toUpperCase());
  if (filters.status)    query = query.eq('status', String(filters.status).trim().toLowerCase());

  const { data, error, count } = await query;

  if (error) {
    console.error('listOfflinePacks:', error);
    return { success: false, total: 0, items: [], message: error.message };
  }

  const rows = data || [];
  const courseIds = [...new Set(rows.map(r => String(r.course_id || '').trim()).filter(Boolean))];

  let courseTitleMap = {};
  if (courseIds.length) {
    const { data: courses } = await db
      .from('courses')
      .select('course_id, title')
      .in('course_id', courseIds);

    (courses || []).forEach(c => {
      courseTitleMap[String(c.course_id || '').trim().toUpperCase()] = String(c.title || '').trim();
    });
  }

  const items = rows.map(row => {
    const cid = String(row.course_id || '').trim().toUpperCase();
    const courseTitle = courseTitleMap[cid] || cid;

    return {
      ...row,
      course_title: courseTitle,
      course_name: courseTitle,
      created_at: row.created_utc
    };
  });

  return {
    success: true,
    total: Number(count || items.length),
    items
  };
}
// ------------------------------------------------------------
// SAVE ATTEMPT PROGRESS (AUTOSAVE)
// Returns: { success: true } or { success: false, message }
//
// Called automatically every N seconds by the runner
// and also when student clicks Save & Exit.
//
// Why: preserves student answers in case of browser close,
//      network drop or accidental navigation away.
//
// Used by: runner/instant.html, runner/timed.html
// ------------------------------------------------------------
async function saveAttemptProgress(attemptId, answersJson) {
  const { error } = await db
    .from('attempts')
    .update({
      answers_json: JSON.stringify(answersJson),
      status:       'in_progress'
    })
    .eq('attempt_id', attemptId);

  if (error) {
    console.error('saveAttemptProgress:', error);
    return { success: false, message: error.message };
  }
  return { success: true };
}
// ------------------------------------------------------------
// MARK TIMED ATTEMPT AS STARTED
// Returns: { success: true } or { success: false, message }
//
// Used by: runner/timed.html
//
// Logic:
// - called only the FIRST time the learner clicks Start Exam
// - stamps ts_iso as the official exam start time
// - sets time_taken_s = 0 so the runner can distinguish
//   "not started yet" from "already started"
// ------------------------------------------------------------
async function markTimedAttemptStarted(attemptId, startedIso) {
  const { error } = await db
    .from('attempts')
    .update({
      ts_iso:       startedIso,
      time_taken_s: 0,
      status:       'in_progress'
    })
    .eq('attempt_id', attemptId)
    .is('time_taken_s', null);

  if (error) {
    console.error('markTimedAttemptStarted:', error);
    return { success: false, message: error.message };
  }
  return { success: true };
}
// ------------------------------------------------------------
// SAVE TIMED ATTEMPT PROGRESS
// Returns: { success: true } or { success: false, message }
//
// Used by: runner/timed.html
//
// Logic:
// - saves answers_json
// - updates time_taken_s with true elapsed exam time
// - keeps status as in_progress
// ------------------------------------------------------------
async function saveTimedAttemptProgress(attemptId, answersJson, timeTakenS) {
  const { error } = await db
    .from('attempts')
    .update({
      answers_json: JSON.stringify(answersJson),
      time_taken_s: timeTakenS,
      status:       'in_progress'
    })
    .eq('attempt_id', attemptId);

  if (error) {
    console.error('saveTimedAttemptProgress:', error);
    return { success: false, message: error.message };
  }
  return { success: true };
}
// ------------------------------------------------------------
// FINISH ATTEMPT (SUBMIT)
// Returns: { success: true } or { success: false, message }
//
// Called when student clicks Submit in the runner.
// Records the final answers, score and time taken.
// Sets status to 'completed'.
//
// Used by: runner/instant.html, runner/timed.html
// ------------------------------------------------------------
async function finishAttempt(attemptId, answersJson, scoreRaw, scoreTotal, scorePct, timeTakenS) {
  const { error } = await db
    .from('attempts')
    .update({
      answers_json: JSON.stringify(answersJson),
      score_raw:    scoreRaw,
      score_total:  scoreTotal,
      score_pct:    scorePct,
      time_taken_s: timeTakenS,
      status:       'completed'
    })
    .eq('attempt_id', attemptId);

  if (error) {
    console.error('finishAttempt:', error);
    return { success: false, message: error.message };
  }
  return { success: true };
}


// ------------------------------------------------------------
// RETAKE ATTEMPT
// Returns: newly created attempt row
//
// Called when student clicks Retake on a completed quiz.
// Creates a fresh attempt using the same quiz and items
// as the original, linked back via origin_attempt_id.
//
// Why: retake is a new attempt — clean slate, same questions.
//      origin_attempt_id lets us track retake chains in history.
//
// Used by: student/fixed-quizzes.html,
//          student/learning-history.html
// ------------------------------------------------------------
async function retakeAttempt(originAttempt, userId) {
  const attemptId    = 'ATT_' + Date.now() + '_' + makeSecureId('').slice(0, 7);
  const timeLimitSec = originAttempt.duration_min * 60;

  const { data, error } = await db
    .from('attempts')
    .insert({
      attempt_id:         attemptId,
      user_id:            userId,
      quiz_id:            originAttempt.quiz_id,
      course_id:          originAttempt.course_id,
      mode:               originAttempt.mode,
      source:             'retake',
      item_ids:           originAttempt.item_ids,
      n:                  originAttempt.n,
      status:             'in_progress',
      ts_iso:             new Date().toISOString(),
      duration_min:       originAttempt.duration_min,
      answers_json:       JSON.stringify([]),
      display_label:      originAttempt.display_label,
      origin_attempt_id:  originAttempt.attempt_id
    })
    .select()
    .single();

  if (error) { console.error('retakeAttempt:', error); return null; }
  return data;
}


// ------------------------------------------------------------
// GET ATTEMPT FOR REVIEW
// Returns: { attempt, items } — full attempt + question content
//
// Called when student clicks Review on a completed attempt.
// Loads the attempt row AND fetches all question content
// so the runner can display answers in read-only mode.
//
// Why: review mode needs both the student's answers (from attempt)
//      and the full question text/options/rationale (from items table).
//
// Used by: runner/instant.html, runner/timed.html (?review=1)
// ------------------------------------------------------------
async function getAttemptForReview(attemptId) {
  // Load the attempt row
  const { data: attempt, error } = await db
    .from('attempts')
    .select('*')
    .eq('attempt_id', attemptId)
    .maybeSingle();

  if (error || !attempt) {
    console.error('getAttemptForReview — attempt not found:', error);
    return null;
  }

  // Parse item_ids from comma-separated string to array
  const itemIds = (attempt.item_ids || '').split(',').filter(Boolean);

  // Fetch all question content from the correct items table
  const items = await getItemsByIds(attempt.course_id, itemIds);

  return { attempt, items };
}


// ------------------------------------------------------------
// GET STUDENT ATTEMPTS
// Returns: array of attempt rows for a student, newest first
//
// courseId: optional — pass to filter by one course only
//           leave null/empty to get all attempts (learning history)
//
// Why: learning history page needs all attempts.
//      Fixed quizzes page needs attempts per course to compute
//      card state (not started / in progress / completed).
//
// Used by: student/learning-history.html,
//          student/fixed-quizzes.html (state machine)
// ------------------------------------------------------------
async function getStudentAttempts(userId, courseId = null) {
  let query = db
    .from('attempts')
    .select('*')
    .eq('user_id', userId)
    .order('ts_iso', { ascending: false });

  if (courseId) query = query.eq('course_id', courseId);

  const { data, error } = await query;
  if (error) { console.error('getStudentAttempts:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// STUDENT ATTEMPTS — PAGINATED LIST
// Returns: { attempts, total } — paginated attempt rows for history
// Reason: attempts table grows unbounded per student; loading all
//         at once is wasteful especially with answers_json blobs
// Selects only card-visible columns — omits item_ids and
// answers_json which are large and only needed by the runner
// filters: { courseId, status, mode, search }
// page: page index starting at 0 (default 0)
// pageSize: rows per page (default 20)
// Returns: { attempts, total }
// Used by: student/learning-history.html
// ------------------------------------------------------------
async function getStudentAttemptsPaginated(userId, filters = {}, page = 0, pageSize = 20) {
  const {
    courseId = '',
    status  = '',
    mode    = '',
    search  = ''
  } = filters;

  let query = db
    .from('attempts')
    .select(`
      attempt_id,
      user_id,
      quiz_id,
      course_id,
      mode,
      source,
      status,
      n,
      score_raw,
      score_total,
      score_pct,
      time_taken_s,
      display_label,
      ts_iso
    `, { count: 'exact' })
    .eq('user_id', userId)
    .order('ts_iso', { ascending: false });

  if (courseId) query = query.eq('course_id', courseId);
  if (status)  query = query.eq('status', status);
  if (mode)    query = query.eq('mode', mode);
  if (search)  query = query.ilike('display_label', `%${search}%`);

  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, count, error } = await query;
  if (error) { console.error('getStudentAttemptsPaginated:', error); return { attempts: [], total: 0 }; }

  return { attempts: data || [], total: count || 0 };
}


// ------------------------------------------------------------
// SHUFFLE ARRAY (Fisher-Yates)
// Returns: new shuffled array (does not mutate original)
//
// Why: used by spawnFixedAttempt when quiz.shuffle = true
//      to randomise question order at spawn time.
//      Also used by runners for option shuffling.
//
// Not exported — internal helper used by quiz engine functions
// ------------------------------------------------------------
function shuffleArray(arr) {
  return secureShuffle(arr);
}
// ------------------------------------------------------------
// GET QUIZ AVAILABILITY
// Returns: HIDDEN | UPCOMING | ACTIVE | CLOSED
//
// Full state machine:
// 1. status !== active  → HIDDEN
// 2. published !== true → HIDDEN
// 3. now < publish_at   → UPCOMING
// 4. now > unpublish_at → CLOSED
// 5. all clear          → ACTIVE
//
// Used by: student/fixed-quizzes.html, admin/fixed-quizzes.html
// ------------------------------------------------------------
function getQuizAvailability(quiz) {
  if (quiz.status !== 'active') return 'HIDDEN';
  if (!quiz.published)          return 'HIDDEN';

  const now = new Date();
  if (quiz.publish_at   && new Date(quiz.publish_at)   > now) return 'UPCOMING';
  if (quiz.unpublish_at && new Date(quiz.unpublish_at) < now) return 'CLOSED';

  return 'ACTIVE';
}


// ══════════════════════════════════════════════════════════════
// MESSAGING
// ══════════════════════════════════════════════════════════════

// ------------------------------------------------------------
// ID GENERATOR — same pattern as old stack (THR_ / MSG_ prefix)
// ------------------------------------------------------------
function _msgId(prefix) {
  return prefix + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
}

// ------------------------------------------------------------
// GET OR CREATE THREAD
// Reuse rules:
//   general  → reuse open thread for same user
//   course   → reuse open thread for same user + course_id
//   question → always create new
// Returns: { thread_id, created }
// ------------------------------------------------------------
async function ensureThread(userId, contextType, opts = {}) {
  const ct = (contextType || 'general').toLowerCase();

  // Try to reuse existing open thread (general / course only)
  if (ct !== 'question') {
    let q = db.from('messages_threads')
      .select('thread_id')
      .eq('user_id', userId)
      .eq('status', 'open')
      .eq('context_type', ct);

    if (ct === 'course' && opts.course_id) q = q.eq('course_id', opts.course_id);

    const { data } = await q.order('last_message_at', { ascending: false }).limit(1).maybeSingle();
    if (data) return { thread_id: data.thread_id, created: false };
  }

  // Create new thread
  const thread_id = _msgId('THR');
  const now = new Date().toISOString();

  const row = {
    thread_id,
    user_id:          userId,
    admin_id:         opts.admin_id || 'admin1',
    status:           'open',
    context_type:     ct,
    subject:          opts.subject || null,
    course_id:        opts.course_id || null,
    quiz_id:          opts.quiz_id || null,
    question_id:      opts.question_id || null,
    attempt_id:       opts.attempt_id || null,
    bulk_batch_id:    opts.bulk_batch_id || null,
    ref_text:         opts.ref_text || null,
    created_at:       now,
    last_message_at:  now,
    last_sender_role: opts.sender_role || 'student'
  };

  const { error } = await db.from('messages_threads').insert(row);
  if (error) { console.error('ensureThread:', error); return null; }
  return { thread_id, created: true };
}

// ------------------------------------------------------------
// SEND MESSAGE
// Inserts message row + updates thread summary
// Returns: { success, message_id } or { success: false, message }
// ------------------------------------------------------------
async function sendMessage(threadId, senderId, senderRole, bodyText) {
  const message_id = _msgId('MSG');
  const now = new Date().toISOString();

  const msg = {
    message_id,
    thread_id:     threadId,
    sender_id:     senderId,
    sender_role:   senderRole,
    body_text:     bodyText.trim(),
    created_at:    now,
    read_by_user:  senderRole === 'student',
    read_by_admin: senderRole === 'admin'
  };

  const { error: msgErr } = await db.from('messages').insert(msg);
  if (msgErr) { console.error('sendMessage:', msgErr); return { success: false, message: msgErr.message }; }

  // Update thread summary
  await db.from('messages_threads')
    .update({ last_message_at: now, last_sender_role: senderRole, status: 'open' })
    .eq('thread_id', threadId);

  return { success: true, message_id };
}

// ------------------------------------------------------------
// GET STUDENT THREADS
// Returns all threads for a student, newest first
// Each thread includes latest message preview
// ------------------------------------------------------------
async function getStudentThreads(userId) {
  const { data, error } = await db
    .from('messages_threads')
    .select('*')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false });

  if (error) { console.error('getStudentThreads:', error); return []; }
  const threads = data || [];

  // Fetch latest message per thread for preview
  if (threads.length) {
    const tids = threads.map(t => t.thread_id);
    const { data: msgs } = await db
      .from('messages')
      .select('thread_id, body_text, sender_role, created_at')
      .in('thread_id', tids)
      .order('created_at', { ascending: false });

    const latestMap = {};
    (msgs || []).forEach(m => {
      if (!latestMap[m.thread_id]) latestMap[m.thread_id] = m;
    });

    threads.forEach(t => { t._latest = latestMap[t.thread_id] || null; });
  }

  return threads;
}

// ------------------------------------------------------------
// GET THREAD MESSAGES
// Returns all messages in a thread, oldest first
// ------------------------------------------------------------
async function getThreadMessages(threadId) {
  const { data, error } = await db
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) { console.error('getThreadMessages:', error); return []; }
  return data || [];
}

// ------------------------------------------------------------
// MARK THREAD READ
// Bulk-updates all unread messages in a thread for a role
// ------------------------------------------------------------
async function markThreadRead(threadId, role) {
  const col = role === 'admin' ? 'read_by_admin' : 'read_by_user';

  const { error } = await db
    .from('messages')
    .update({ [col]: true })
    .eq('thread_id', threadId)
    .eq(col, false);

  if (error) console.error('markThreadRead:', error);
}

// ------------------------------------------------------------
// GET UNREAD COUNT (for nav badge)
// Counts threads that have at least one unread message
// ------------------------------------------------------------
async function getUnreadCountForUser(userId) {
  // Get all threads for user
  const { data: threads } = await db
    .from('messages_threads')
    .select('thread_id')
    .eq('user_id', userId)
    .eq('status', 'open');

  if (!threads || !threads.length) return 0;

  const tids = threads.map(t => t.thread_id);
  const { data: unread } = await db
    .from('messages')
    .select('thread_id')
    .in('thread_id', tids)
    .eq('read_by_user', false);

  // Count unique threads with unread messages
  const unreadThreads = new Set((unread || []).map(m => m.thread_id));
  return unreadThreads.size;
}

async function getUnreadCountForAdmin() {
  const { data: unread } = await db
    .from('messages')
    .select('thread_id')
    .eq('read_by_admin', false);

  const unreadThreads = new Set((unread || []).map(m => m.thread_id));
  return unreadThreads.size;
}

// ------------------------------------------------------------
// ADMIN: GET ALL THREADS (with student info)
// Supports DB-side filtering by context_type, status, and
// user search (name/email via pre-query on users table).
// Read filter stays client-side (_unread depends on messages).
// ------------------------------------------------------------
async function getAdminThreads(filters = {}) {

  // If search term provided, resolve matching user_ids first
  let searchUserIds = null;
  if (filters.search) {
    const term = `%${filters.search}%`;
    const { data: matchedUsers } = await db
      .from('users')
      .select('user_id')
      .or(`name.ilike.${term},forename.ilike.${term},surname.ilike.${term},email.ilike.${term}`);
    searchUserIds = (matchedUsers || []).map(u => u.user_id);
    if (!searchUserIds.length) return []; // no users match — no threads
  }

  let q = db.from('messages_threads')
    .select(`
      thread_id,
      user_id,
      admin_id,
      status,
      context_type,
      subject,
      course_id,
      quiz_id,
      question_id,
      attempt_id,
      bulk_batch_id,
      ref_text,
      created_at,
      last_message_at,
      last_sender_role
    `)
    .order('last_message_at', { ascending: false });

  if (filters.status)       q = q.eq('status', filters.status);
  if (filters.context_type) q = q.eq('context_type', filters.context_type);
  if (searchUserIds)        q = q.in('user_id', searchUserIds);

  const { data, error } = await q;
  if (error) { console.error('getAdminThreads:', error); return []; }
  const threads = data || [];

  if (!threads.length) return [];

  // Batch-fetch student info
  const userIds = [...new Set(threads.map(t => t.user_id))];
  const { data: users } = await db
    .from('users')
    .select('user_id, name, forename, surname, email, program_id')
    .in('user_id', userIds);

  const userMap = {};
  (users || []).forEach(u => { userMap[u.user_id] = u; });

  // Fetch latest message per thread for preview
  const tids = threads.map(t => t.thread_id);
  const { data: msgs } = await db
    .from('messages')
    .select('thread_id, body_text, sender_role, created_at, read_by_admin')
    .in('thread_id', tids)
    .order('created_at', { ascending: false });

  const latestMap = {};
  const unreadMap = {};
  (msgs || []).forEach(m => {
    if (!latestMap[m.thread_id]) latestMap[m.thread_id] = m;
    if (!m.read_by_admin) unreadMap[m.thread_id] = true;
  });

  threads.forEach(t => {
    t._user = userMap[t.user_id] || null;
    t._latest = latestMap[t.thread_id] || null;
    t._unread = !!unreadMap[t.thread_id];
  });

  return threads;
}

// ------------------------------------------------------------
// ADMIN: CLOSE / REOPEN THREAD
// ------------------------------------------------------------
async function closeThread(threadId) {
  const { error } = await db.from('messages_threads')
    .update({ status: 'closed' }).eq('thread_id', threadId);
  if (error) { console.error('closeThread:', error); return { success: false, message: error.message }; }
  return { success: true };
}

async function reopenThread(threadId) {
  const { error } = await db.from('messages_threads')
    .update({ status: 'open' }).eq('thread_id', threadId);
  if (error) { console.error('reopenThread:', error); return { success: false, message: error.message }; }
  return { success: true };
}

// ------------------------------------------------------------
// ADMIN: RESOLVE RECIPIENTS (for bulk send)
// AND across filter types, OR within each.
// programme, cohort, level are filtered DB-side on the users
// table. subscription_kinds and course_ids are filtered via a
// second query on subscriptions → products (joined), scoped
// to the already-narrowed user set.
// Returns: array of user_ids
// ------------------------------------------------------------
async function resolveRecipients(scope) {
  // Build a single users query with DB-side filters
  let q = db
    .from('users')
    .select('user_id')
    .eq('active', true)
    .eq('role', 'STUDENT');

  if (scope.program_ids && scope.program_ids.length) {
    q = q.in('program_id', scope.program_ids);
  }
  if (scope.cohort_ids && scope.cohort_ids.length) {
    q = q.in('cohort', scope.cohort_ids);
  }
  if (scope.level_ids && scope.level_ids.length) {
    q = q.in('level', scope.level_ids);
  }

  const { data: matchedUsers, error } = await q;
  if (error) { console.error('resolveRecipients:', error); return []; }

  let userIds = (matchedUsers || []).map(u => u.user_id);
  if (!userIds.length) return [];

  // Subscription kind filter (PAID / TRIAL / FREE)
  // Requires join through subscriptions → products — filtered on
  // the narrowed user set, not all users
  if (scope.subscription_kinds && scope.subscription_kinds.length) {
    const { data: subs } = await db
      .from('subscriptions')
      .select('user_id, products ( kind )')
      .eq('status', 'ACTIVE')
      .in('user_id', userIds);

    const wantKinds = new Set(scope.subscription_kinds.map(k => k.toUpperCase()));
    const matchedIds = new Set();
    (subs || []).forEach(s => {
      const kind = (s.products && s.products.kind || '').toUpperCase();
      if (wantKinds.has(kind)) matchedIds.add(s.user_id);
    });
    userIds = userIds.filter(id => matchedIds.has(id));
    if (!userIds.length) return [];
  }

  // Course entitlement filter
  // Also requires subscriptions → products join
  if (scope.course_ids && scope.course_ids.length) {
    const { data: subs } = await db
      .from('subscriptions')
      .select('user_id, products ( courses_included )')
      .eq('status', 'ACTIVE')
      .in('user_id', userIds);

    const wantCourses = new Set(scope.course_ids);
    const matchedIds = new Set();
    (subs || []).forEach(s => {
      const courses = (s.products && Array.isArray(s.products.courses_included))
        ? s.products.courses_included
        : [];
      if (courses.some(c => wantCourses.has(c))) matchedIds.add(s.user_id);
    });
    userIds = userIds.filter(id => matchedIds.has(id));
  }

  return userIds;
}

// ------------------------------------------------------------
// ADMIN: BULK SEND
// Creates/reuses threads for each recipient, inserts messages
// Returns: { success, batch_id, count }
// ------------------------------------------------------------
async function bulkSend(adminId, subject, bodyText, scope, contextType = 'general') {
  const userIds = await resolveRecipients(scope);
  if (!userIds.length) return { success: false, message: 'No matching recipients' };

  const bulk_batch_id = 'BULK_' + new Date().toISOString().replace(/[^0-9TZ]/g, '') + '_' + makeSecureId('').slice(0, 6);
  const now = new Date().toISOString();
  let count = 0;

  for (const uid of userIds) {
    const result = await ensureThread(uid, contextType, {
      admin_id: adminId,
      subject,
      course_id: scope.course_id || null,
      bulk_batch_id,
      sender_role: 'admin'
    });

    if (!result) continue;

    await sendMessage(result.thread_id, adminId, 'admin', subject ? `[${subject}]\n${bodyText}` : bodyText);
    count++;
  }

  return { success: true, batch_id: bulk_batch_id, count };
}

// ------------------------------------------------------------
// ADMIN: SEARCH STUDENTS (for new thread creation)
// ------------------------------------------------------------
async function searchStudentsForMessaging(query) {
  const { data, error } = await db
    .from('users')
    .select('user_id, name, forename, surname, email, program_id')
    .eq('active', true)
    .order('name');

  if (error) { console.error('searchStudentsForMessaging:', error); return []; }

  const term = (query || '').toLowerCase();
  if (!term) return data || [];

  return (data || []).filter(u =>
    (u.name || '').toLowerCase().includes(term)
    || (u.forename || '').toLowerCase().includes(term)
    || (u.surname || '').toLowerCase().includes(term)
    || (u.email || '').toLowerCase().includes(term)
  );
}
