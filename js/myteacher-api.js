// ============================================================
// myteacher-api.js
// Teacher Assess data layer — loaded only by /myteacher/* pages
// Requires: db from js/config.js (loaded before this file)
//
// Slice 3: Classes
// ============================================================


// ── Secure ID, shuffle & code helpers ────────────────────────
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

function makeSecureJoinCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map(b => chars[b % chars.length])
    .join('');
}


// ── ID generators ────────────────────────────────────────────

function makeClassId() {
  return 'CLS_' + Date.now() + '_' + makeSecureId('').slice(0, 8);
}

function makeJoinCode() {
  return makeSecureJoinCode(6);
}

function makeClassMemberId() {
  return 'MBR_' + Date.now() + '_' + makeSecureId('').slice(0, 8);
}


// ── Custom field key normaliser ───────────────────────────────
// Converts a label like "Index Number" → "index_number"
// Ensures uniqueness within the field set

function normaliseFieldKey(label, usedKeys) {
  let key = String(label || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  if (!key) key = 'field';
  const base = key;
  let suffix = 1;
  while (usedKeys && usedKeys[key]) {
    key = base + '_' + suffix;
    suffix++;
  }
  return key;
}


// ── buildCustomFieldsJson ─────────────────────────────────────
// Takes raw modal fields array, normalises keys, drops blanks
// Returns JSON string ready to store in teacher_classes

function buildCustomFieldsJson(fields) {
  const used = {};
  const out  = [];
  (fields || []).forEach(f => {
    const label = String(f.label || '').trim();
    if (!label) return;
    const key = normaliseFieldKey(label, used);
    used[key] = true;
    out.push({ key, label, required: !!f.required });
  });
  return JSON.stringify(out);
}


// ============================================================
// CLASSES
// ============================================================

// ------------------------------------------------------------
// GET TEACHER CLASSES
// Returns all classes for this teacher, newest first
// Used by: myteacher/teacher/classes.html
// ------------------------------------------------------------
async function getTeacherClasses(teacherId, { statusFilter = '' } = {}) {
  let query = db
    .from('teacher_classes')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'ALL') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) { console.error('getTeacherClasses:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// GET SINGLE CLASS
// Used by: classes.html detail panel
// ------------------------------------------------------------
async function getClassById(classId) {
  const { data, error } = await db
    .from('teacher_classes')
    .select('*')
    .eq('class_id', classId)
    .maybeSingle();

  if (error) { console.error('getClassById:', error); return null; }
  return data;
}


// ------------------------------------------------------------
// CREATE CLASS
// Generates class_id and join_code client-side
// Returns the created row
// Used by: myteacher/teacher/classes.html
// ------------------------------------------------------------
async function createClass(teacherId, title, customFieldsJson, opts = {}) {
  const now     = new Date().toISOString();
  const classId = makeClassId();
  const joinCode = makeJoinCode();

  const row = {
    class_id          : classId,
    teacher_id        : teacherId,
    title             : title,
    join_code         : joinCode,
    custom_fields_json: customFieldsJson || '[]',
    require_approval  : !!opts.requireApproval,
    status            : 'ACTIVE',
    created_at        : now,
    updated_at        : now
  };

  // Optional class metadata
  if (opts.description)   row.description   = opts.description;
  if (opts.programme)     row.programme     = opts.programme;
  if (opts.course)        row.course        = opts.course;
  if (opts.academic_year) row.academic_year = opts.academic_year;
  if (opts.semester)      row.semester      = opts.semester;
  if (opts.max_capacity)  row.max_capacity  = parseInt(opts.max_capacity, 10) || null;
  if (opts.start_date)    row.start_date    = opts.start_date;
  if (opts.end_date)      row.end_date      = opts.end_date;
  if (opts.colour)        row.colour        = opts.colour;

  const { data, error } = await db
    .from('teacher_classes')
    .insert(row)
    .select()
    .single();

  if (error) { console.error('createClass:', error); return { success: false, message: error.message }; }
  return { success: true, data };
}


// ------------------------------------------------------------
// UPDATE CLASS
// Updates title, status, and/or custom_fields_json
// Used by: myteacher/teacher/classes.html edit modal
// ------------------------------------------------------------
async function updateClass(classId, fields) {
  const now = new Date().toISOString();

  const { error } = await db
    .from('teacher_classes')
    .update({ ...fields, updated_at: now })
    .eq('class_id', classId);

  if (error) { console.error('updateClass:', error); return { success: false, message: error.message }; }
  return { success: true };
}


// ------------------------------------------------------------
// REGENERATE JOIN CODE
// Replaces the join_code with a fresh one
// Old code immediately stops working
// Used by: myteacher/teacher/classes.html
// ------------------------------------------------------------
async function regenerateJoinCode(classId) {
  const newCode = makeJoinCode();
  const now     = new Date().toISOString();

  const { data, error } = await db
    .from('teacher_classes')
    .update({ join_code: newCode, updated_at: now })
    .eq('class_id', classId)
    .select('join_code')
    .single();

  if (error) { console.error('regenerateJoinCode:', error); return { success: false, message: error.message }; }
  return { success: true, join_code: data.join_code };
}


// ============================================================
// CLASS MEMBERS
// ============================================================

// ------------------------------------------------------------
// GET CLASS MEMBERS
// Returns members for a given class
// statusFilter: 'ACTIVE' | 'REMOVED' | 'ALL'
// Used by: myteacher/teacher/classes.html member roster
// ------------------------------------------------------------
async function getClassMembers(classId, { statusFilter = 'ACTIVE' } = {}) {
  let query = db
    .from('teacher_class_members')
    .select('*')
    .eq('class_id', classId)
    .order('joined_at', { ascending: false });

  if (statusFilter && statusFilter !== 'ALL') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) { console.error('getClassMembers:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// REMOVE MEMBER
// Sets status to REMOVED — does not delete the row
// Keeps the record for audit / results history
// Used by: myteacher/teacher/classes.html
// ------------------------------------------------------------
async function removeMember(classId, userId) {
  const now = new Date().toISOString();

  const { error } = await db
    .from('teacher_class_members')
    .update({ status: 'REMOVED', updated_at: now })
    .eq('class_id', classId)
    .eq('user_id', userId);

  if (error) { console.error('removeMember:', error); return { success: false, message: error.message }; }
  return { success: true };
}


// ------------------------------------------------------------
// APPROVE MEMBER
// Changes status from PENDING → ACTIVE
// Used by: myteacher/teacher/classes.html pending list
// ------------------------------------------------------------
async function approveMember(classId, userId) {
  const now = new Date().toISOString();

  const { error } = await db
    .from('teacher_class_members')
    .update({ status: 'ACTIVE', updated_at: now })
    .eq('class_id', classId)
    .eq('user_id', userId)
    .eq('status', 'PENDING');

  if (error) { console.error('approveMember:', error); return { success: false, message: error.message }; }
  return { success: true };
}


// ------------------------------------------------------------
// REJECT MEMBER
// Changes status from PENDING → REJECTED
// Used by: myteacher/teacher/classes.html pending list
// ------------------------------------------------------------
async function rejectMember(classId, userId) {
  const now = new Date().toISOString();

  const { error } = await db
    .from('teacher_class_members')
    .update({ status: 'REJECTED', updated_at: now })
    .eq('class_id', classId)
    .eq('user_id', userId)
    .eq('status', 'PENDING');

  if (error) { console.error('rejectMember:', error); return { success: false, message: error.message }; }
  return { success: true };
}


// ------------------------------------------------------------
// GET PENDING COUNT PER CLASS (batch)
// Takes an array of class_ids
// Returns a map: { class_id: count }
// Used by: classes.html list — shows pending badge on cards
// ------------------------------------------------------------
async function getPendingCounts(classIds) {
  if (!classIds || !classIds.length) return {};

  const { data, error } = await db
    .from('teacher_class_members')
    .select('class_id')
    .in('class_id', classIds)
    .eq('status', 'PENDING');

  if (error) { console.error('getPendingCounts:', error); return {}; }

  const counts = {};
  (data || []).forEach(row => {
    counts[row.class_id] = (counts[row.class_id] || 0) + 1;
  });
  return counts;
}


// ------------------------------------------------------------
// GET MEMBER COUNT PER CLASS (batch)
// Takes an array of class_ids
// Returns a map: { class_id: count }
// Used by: classes.html list — shows member count on each card
// ------------------------------------------------------------
async function getMemberCounts(classIds) {
  if (!classIds || !classIds.length) return {};

  const { data, error } = await db
    .from('teacher_class_members')
    .select('class_id')
    .in('class_id', classIds)
    .eq('status', 'ACTIVE');

  if (error) { console.error('getMemberCounts:', error); return {}; }

  const counts = {};
  (data || []).forEach(row => {
    counts[row.class_id] = (counts[row.class_id] || 0) + 1;
  });
  return counts;
}


// ============================================================
// Slice 4: Student — My Classes
// ============================================================

// ------------------------------------------------------------
// GET STUDENT CLASSES
// Returns all active class memberships for a student,
// with the class details joined in a single query.
// Used by: myteacher/student/my-classes.html
// ------------------------------------------------------------
async function getStudentClasses(userId) {
  const { data, error } = await db
    .from('teacher_class_members')
    .select(`
      class_id,
      user_id,
      teacher_id,
      status,
      joined_at,
      member_fields_json,
      teacher_classes (
        class_id,
        teacher_id,
        title,
        status,
        colour,
        programme,
        course,
        description,
        academic_year,
        semester,
        end_date,
        require_approval,
        custom_fields_json
      )
    `)
    .eq('user_id', userId)
    .in('status', ['ACTIVE', 'PENDING'])
    .order('joined_at', { ascending: false });

  if (error) { console.error('getStudentClasses:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// GET CLASS BY JOIN CODE
// Validates a join code and returns the class if found and active.
// Returns null if not found or archived.
// Used by: myteacher/student/my-classes.html join flow
// ------------------------------------------------------------
async function getClassByJoinCode(joinCode) {
  const { data, error } = await db
    .from('teacher_classes')
    .select('*')
    .eq('join_code', String(joinCode || '').trim().toUpperCase())
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (error) { console.error('getClassByJoinCode:', error); return null; }
  return data;
}


// ------------------------------------------------------------
// CHECK IF STUDENT ALREADY MEMBER
// Returns the existing membership row or null.
// Used by: join flow — prevent duplicate joins
// ------------------------------------------------------------
async function getExistingMembership(userId, classId) {
  const { data, error } = await db
    .from('teacher_class_members')
    .select('class_id, status')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .maybeSingle();

  if (error) { console.error('getExistingMembership:', error); return null; }
  return data;
}


// ------------------------------------------------------------
// JOIN CLASS
// Inserts a new row into teacher_class_members.
// memberFieldsJson: JSON string of { key: value } pairs
// Returns { success, message }
// Used by: myteacher/student/my-classes.html
// ------------------------------------------------------------
async function joinClass(userId, classId, teacherId, displayName, email, memberFieldsJson, { requireApproval = false, maxCapacity = null } = {}) {
  // Enforce max capacity if set
  if (maxCapacity) {
    const { data: countRows } = await db
      .from('teacher_class_members')
      .select('member_id')
      .eq('class_id', classId)
      .in('status', ['ACTIVE', 'PENDING']);
    if (countRows && countRows.length >= maxCapacity) {
      return { success: false, message: 'This class is full. Please contact your teacher.' };
    }
  }

  const now      = new Date().toISOString();
  const memberId = makeClassMemberId();
  const status   = requireApproval ? 'PENDING' : 'ACTIVE';

  const { error } = await db
    .from('teacher_class_members')
    .insert({
      member_id         : memberId,
      class_id          : classId,
      user_id           : userId,
      teacher_id        : teacherId,
      display_name      : displayName || '',
      email             : email || '',
      member_fields_json: memberFieldsJson || '{}',
      status            : status,
      joined_at         : now,
      updated_at        : now
    });

  if (error) { console.error('joinClass:', error); return { success: false, message: error.message }; }
  return { success: true, status };
}

// ------------------------------------------------------------
// UPDATE MEMBER PROFILE
// Updates the member_fields_json for an existing membership.
// memberFieldsJson: JSON string of { key: value } pairs
// Used by: myteacher/student/my-classes.html profile tab
// ------------------------------------------------------------
async function updateMemberProfile(classId, userId, memberFieldsJson) {
  const now = new Date().toISOString();

  const { error } = await db
    .from('teacher_class_members')
    .update({
      member_fields_json: memberFieldsJson,
      updated_at        : now
    })
    .eq('class_id', classId)
    .eq('user_id', userId);

  if (error) { console.error('updateMemberProfile:', error); return { success: false, message: error.message }; }
  return { success: true };
}


// ============================================================
// Slice 5: Teacher Question Bank
// ============================================================

// ------------------------------------------------------------
// GET BANK FILTER OPTIONS
// Returns distinct subject, maintopic, subtopic values
// from this teacher's bank — used to populate the three
// filter dropdowns dynamically.
// Called on page load and after every save so new tags
// appear immediately without a full page refresh.
// Used by: myteacher/teacher/bank.html
// ------------------------------------------------------------
async function getBankFilterOptions(teacherId) {
  const { data, error } = await db
    .from('teacher_bank_items')
    .select('subject, maintopic, subtopic, tags, batch_id, year_level, bloom_level')
    .eq('teacher_id', teacherId)
    .neq('status', 'ARCHIVED');   // only surface values from active items

  if (error) { console.error('getBankFilterOptions:', error); return { subjects: [], maintopics: [], subtopics: [], tags: [], batch_ids: [], year_levels: [], bloom_levels: [] }; }

  const subjects    = [...new Set((data || []).map(r => r.subject).filter(Boolean))].sort();
  const maintopics  = [...new Set((data || []).map(r => r.maintopic).filter(Boolean))].sort();
  const subtopics   = [...new Set((data || []).map(r => r.subtopic).filter(Boolean))].sort();
  const tags        = [...new Set((data || []).flatMap(r => r.tags || []).filter(Boolean))].sort();
  const batch_ids   = [...new Set((data || []).map(r => r.batch_id).filter(Boolean))].sort();
  const year_levels = [...new Set((data || []).map(r => r.year_level).filter(Boolean))].sort();
  const bloom_levels = [...new Set((data || []).map(r => r.bloom_level).filter(Boolean))].sort();

  return { subjects, maintopics, subtopics, tags, batch_ids, year_levels, bloom_levels };
}


// ------------------------------------------------------------
// GET BANK ITEMS
// Fetches all items for this teacher with optional filters.
// All columns are returned — the card list renders full
// stem, all options, rationale, and image.
//
// filters: {
//   status      — 'ACTIVE' | 'ARCHIVED' | 'ALL'  (default: 'ACTIVE')
//   subject     — exact match string or ''
//   maintopic   — exact match string or ''
//   subtopic    — exact match string or ''
//   difficulty  — 'Easy' | 'Moderate' | 'Hard' or ''
//   keyword     — substring search against stem
// }
//
// Results ordered by updated_at DESC so most recently
// edited items appear first.
// Used by: myteacher/teacher/bank.html
// ------------------------------------------------------------
async function getBankItems(teacherId, filters = {}) {
  const {
    status     = 'ACTIVE',
    subject    = '',
    maintopic  = '',
    subtopic   = '',
    difficulty = '',
    keyword    = ''
  } = filters;

  let query = db
    .from('teacher_bank_items')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('updated_at', { ascending: false });

  // Status filter — ALL means no status constraint
  if (status && status !== 'ALL') {
    query = query.eq('status', status);
  }

  if (subject)    query = query.eq('subject',   subject);
  if (maintopic)  query = query.eq('maintopic', maintopic);
  if (subtopic)   query = query.eq('subtopic',  subtopic);
  if (difficulty) query = query.eq('difficulty', difficulty);

  // Keyword: case-insensitive substring match on stem
  // ilike is Supabase's case-insensitive LIKE
  if (keyword) query = query.ilike('stem', `%${keyword}%`);

  const { data, error } = await query;
  if (error) { console.error('getBankItems:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// BANK ITEMS — PAGINATED LIST
// Returns: { items, total } — paginated bank items for list view
// Reason: question banks grow fast; paginate to keep list snappy
// Same filters as getBankItems() — status, subject, maintopic,
// subtopic, difficulty, keyword
// Selects all card-visible columns (options, correct, rationale)
// but omits editor-only columns (shuffle_options, source_course_id,
// source_item_id, imported_at, created_at)
// page: page index starting at 0 (default 0)
// pageSize: rows per page (default 50)
// Returns: { items, total }
// Used by: myteacher/teacher/bank.html
// ------------------------------------------------------------
async function getBankItemsPaginated(teacherId, filters = {}, page = 0, pageSize = 50) {
  const {
    status      = 'ACTIVE',
    subject     = '',
    maintopic   = '',
    subtopic    = '',
    difficulty  = '',
    keyword     = '',
    question_ref = '',
    tag         = '',
    batch_id    = '',
    year_level  = '',
    bloom_level = ''
  } = filters;

  let query = db
    .from('teacher_bank_items')
    .select(`
      bank_item_id,
      teacher_id,
      stem,
      question_type,
      status,
      subject,
      maintopic,
      subtopic,
      difficulty,
      marks,
      correct,
      option_a, option_b, option_c, option_d, option_e, option_f,
      fb_a, fb_b, fb_c, fb_d, fb_e, fb_f,
      rationale,
      rationale_img,
      source_type,
      question_ref,
      tags,
      batch_id,
      year_level,
      bloom_level,
      updated_at
    `, { count: 'exact' })
    .eq('teacher_id', teacherId)
    .order('updated_at', { ascending: false });

  if (status && status !== 'ALL') query = query.eq('status', status);
  if (subject)      query = query.eq('subject',   subject);
  if (maintopic)    query = query.eq('maintopic', maintopic);
  if (subtopic)     query = query.eq('subtopic',  subtopic);
  if (difficulty)   query = query.eq('difficulty', difficulty);
  if (keyword)      query = query.ilike('stem', `%${keyword}%`);
  if (question_ref) query = query.ilike('question_ref', `%${question_ref}%`);
  if (tag)          query = query.contains('tags', [tag]);
  if (batch_id)     query = query.eq('batch_id', batch_id);
  if (year_level)   query = query.eq('year_level', year_level);
  if (bloom_level)  query = query.eq('bloom_level', bloom_level);

  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, count, error } = await query;
  if (error) { console.error('getBankItemsPaginated:', error); return { items: [], total: 0 }; }

  return { items: data || [], total: count || 0 };
}


// ------------------------------------------------------------
// GET SINGLE BANK ITEM
// Fetches one full row by bank_item_id.
// Called when opening the editor for an existing item —
// ensures the form always has fresh data, not stale list cache.
// Returns null if not found.
// Used by: myteacher/teacher/bank.html editor
// ------------------------------------------------------------
async function getBankItem(bankItemId) {
  const { data, error } = await db
    .from('teacher_bank_items')
    .select('*')
    .eq('bank_item_id', bankItemId)
    .maybeSingle();

  if (error) { console.error('getBankItem:', error); return null; }
  return data;
}


// ------------------------------------------------------------
// CREATE BANK ITEM
// Inserts a new question into teacher_bank_items.
// bank_item_id is generated here as TBANK_ + Date.now()
// so the page can show the ID before the save completes.
// source_type is always 'TEACHER' for manually created items.
// Returns { success, item } on success or { success: false, message }
// Used by: myteacher/teacher/bank.html editor
// ------------------------------------------------------------
async function createBankItem(teacherId, payload) {
  const now        = new Date().toISOString();
  const bankItemId = 'TBANK_' + Date.now();

  const row = {
    bank_item_id   : bankItemId,
    teacher_id     : teacherId,
    status         : 'ACTIVE',
    source_type    : 'TEACHER',
    created_at     : now,
    updated_at     : now,

    // question fields — spread from payload
    question_type  : payload.question_type  || 'MCQ',
    stem           : payload.stem,
    option_a       : payload.option_a       || null,
    fb_a           : payload.fb_a           || null,
    option_b       : payload.option_b       || null,
    fb_b           : payload.fb_b           || null,
    option_c       : payload.option_c       || null,
    fb_c           : payload.fb_c           || null,
    option_d       : payload.option_d       || null,
    fb_d           : payload.fb_d           || null,
    option_e       : payload.option_e       || null,
    fb_e           : payload.fb_e           || null,
    option_f       : payload.option_f       || null,
    fb_f           : payload.fb_f           || null,
    correct        : payload.correct,
    rationale      : payload.rationale      || null,
    rationale_img  : payload.rationale_img  || null,
    subject        : payload.subject        || null,
    maintopic      : payload.maintopic      || null,
    subtopic       : payload.subtopic       || null,
    difficulty     : payload.difficulty     || null,
    marks          : payload.marks          || 1,
    shuffle_options: payload.shuffle_options !== undefined ? payload.shuffle_options : true,
    question_ref   : payload.question_ref   || null,
    tags           : Array.isArray(payload.tags) ? payload.tags : [],
    batch_id       : payload.batch_id       || null,
    year_level     : payload.year_level     || null,
    bloom_level    : payload.bloom_level    || null,
  };

  const { data, error } = await db
    .from('teacher_bank_items')
    .insert(row)
    .select('*')
    .single();

  if (error) { console.error('createBankItem:', error); return { success: false, message: error.message }; }
  return { success: true, item: data };
}


// ------------------------------------------------------------
// UPDATE BANK ITEM
// Applies a patch (only the changed fields) to an existing row.
// Always updates updated_at.
// The page builds the patch by comparing form values to the
// original loaded item — only sends what changed.
// Returns { success } or { success: false, message }
// Used by: myteacher/teacher/bank.html editor
// ------------------------------------------------------------
async function updateBankItem(bankItemId, patch) {
  const now = new Date().toISOString();

  const { error } = await db
    .from('teacher_bank_items')
    .update({ ...patch, updated_at: now })
    .eq('bank_item_id', bankItemId);

  if (error) { console.error('updateBankItem:', error); return { success: false, message: error.message }; }
  return { success: true };
}


// ------------------------------------------------------------
// ARCHIVE / RESTORE BANK ITEM
// Soft operation — sets status to ARCHIVED or back to ACTIVE.
// Never deletes rows (audit trail, snapshot integrity).
// action: 'ARCHIVE' | 'RESTORE'
// Returns { success } or { success: false, message }
// Used by: myteacher/teacher/bank.html card footer + editor
// ------------------------------------------------------------
async function setArchiveBankItem(bankItemId, action) {
  const newStatus = action === 'RESTORE' ? 'ACTIVE' : 'ARCHIVED';
  const now       = new Date().toISOString();

  const { error } = await db
    .from('teacher_bank_items')
    .update({ status: newStatus, updated_at: now })
    .eq('bank_item_id', bankItemId);

  if (error) { console.error('setArchiveBankItem:', error); return { success: false, message: error.message }; }
  return { success: true, newStatus };
}


// ------------------------------------------------------------
// APPEND TO DRAFT ITEMS  (Picker mode)
// Used when the teacher picks questions from the bank and
// adds them to a quiz draft in the quiz manager.
//
// Fetches the current draft_items_json from teacher_quizzes,
// merges in the new bankItemIds (appending, no duplicates),
// writes back.
//
// draft_items_json shape: { items: ["TBANK_001", "TBANK_002", ...] }
// The items array is an ordered list of bank_item_ids that
// the quiz builder uses to build its question list.
//
// Returns { success, added, skipped, total }
// — added:   how many new IDs were appended
// — skipped: how many were already in the draft
// — total:   new total item count in the draft
//
// Used by: myteacher/teacher/bank.html (picker mode dock)
// Wired into: myteacher/teacher/quizzes.html in Slice 6
// ------------------------------------------------------------
async function appendToDraftItems(teacherQuizId, bankItemIds) {
  if (!teacherQuizId || !bankItemIds || !bankItemIds.length) {
    return { success: false, message: 'Missing quiz ID or item IDs.' };
  }

  // 1. Fetch the current quiz row — we only need draft_items_json
  const { data: quiz, error: fetchError } = await db
    .from('teacher_quizzes')
    .select('draft_items_json, status')
    .eq('teacher_quiz_id', teacherQuizId)
    .maybeSingle();

  if (fetchError) { console.error('appendToDraftItems fetch:', fetchError); return { success: false, message: fetchError.message }; }
  if (!quiz)      { return { success: false, message: 'Quiz not found.' }; }
  if (quiz.status === 'PUBLISHED') { return { success: false, message: 'Cannot edit a published quiz.' }; }

  // 2. Parse existing draft items
  let existingItems = [];
  try {
    const parsed = typeof quiz.draft_items_json === 'string'
      ? JSON.parse(quiz.draft_items_json)
      : (quiz.draft_items_json || {});
    existingItems = Array.isArray(parsed.items) ? parsed.items : [];
  } catch (err) {
    console.warn('[myteacher-api] appendToDraftItems — failed to parse draft_items_json:', err.message);
    existingItems = [];
  }

  // 3. Merge — append new IDs, skip duplicates, preserve order
  const existingSet = new Set(existingItems.map(id => String(id).trim()));
  let added   = 0;
  let skipped = 0;

  bankItemIds.forEach(id => {
    id = String(id || '').trim();
    if (!id) return;
    if (existingSet.has(id)) {
      skipped++;
    } else {
      existingSet.add(id);
      existingItems.push(id);
      added++;
    }
  });

  const total = existingItems.length;

  // 4. Write back
  const now = new Date().toISOString();
  const { error: updateError } = await db
    .from('teacher_quizzes')
    .update({
      draft_items_json: JSON.stringify({ items: existingItems }),
      updated_at      : now
    })
    .eq('teacher_quiz_id', teacherQuizId);

  if (updateError) { console.error('appendToDraftItems update:', updateError); return { success: false, message: updateError.message }; }

  return { success: true, added, skipped, total };
}


// ============================================================
// Slice 6: Teacher Quizzes
// ============================================================

// ── ID generators ───────────────────────────────────────────

function makeQuizId() {
  return 'TQ_' + Date.now() + '_' + makeSecureId('').slice(0, 8);
}

function makeAccessCode() {
  return makeSecureJoinCode(6);
}

function makeQuizItemId() {
  return 'TQI_' + Date.now() + '_' + makeSecureId('').slice(0, 8);
}

function makeQuizClassId() {
  return 'TQC_' + Date.now() + '_' + makeSecureId('').slice(0, 8);
}


// ── QUERY FUNCTIONS ─────────────────────────────────────────

// ------------------------------------------------------------
// GET TEACHER QUIZZES
// Lists all quizzes for this teacher with optional filters.
// Used by: myteacher/teacher/quizzes.html list view
// ------------------------------------------------------------
async function getTeacherQuizzes(teacherId, { statusFilter = '', keyword = '' } = {}) {
  let query = db
    .from('teacher_quizzes')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('updated_at', { ascending: false });

  if (statusFilter && statusFilter !== 'ALL') {
    query = query.eq('status', statusFilter);
  }
  if (keyword) {
    query = query.ilike('title', `%${keyword}%`);
  }

  const { data, error } = await query;
  if (error) { console.error('getTeacherQuizzes:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// GET SINGLE TEACHER QUIZ
// Returns the full quiz row or null.
// Used by: quizzes.html editor — loaded when opening a tile
// ------------------------------------------------------------
async function getTeacherQuiz(quizId) {
  const { data, error } = await db
    .from('teacher_quizzes')
    .select('*')
    .eq('teacher_quiz_id', quizId)
    .maybeSingle();

  if (error) { console.error('getTeacherQuiz:', error); return null; }
  return data;
}


// ------------------------------------------------------------
// GET DRAFT PREVIEW
// Resolves the draft_items_json into full bank item rows.
// Returns { items: [...bankItemRows], missing: [...ids] }
// Used by: quizzes.html — "Load Details" button on draft list
// ------------------------------------------------------------
async function getDraftPreview(quizId) {
  const quiz = await getTeacherQuiz(quizId);
  if (!quiz) return { items: [], missing: [] };

  let ids = [];
  try {
    const parsed = typeof quiz.draft_items_json === 'object'
      ? quiz.draft_items_json
      : JSON.parse(quiz.draft_items_json || '{}');
    ids = Array.isArray(parsed.items) ? parsed.items : [];
  } catch (err) {
    console.warn('[myteacher-api] getDraftPreview — failed to parse draft_items_json:', err.message);
    ids = [];
  }

  if (!ids.length) return { items: [], missing: [] };

  // Split into bank refs and library refs
  const bankIds = ids.filter(id => !id.startsWith('LIB:'));
  const libRefs = ids.filter(id => id.startsWith('LIB:'));

  // Fetch bank items
  let bankMap = new Map();
  if (bankIds.length) {
    const { data, error } = await db
      .from('teacher_bank_items')
      .select('*')
      .in('bank_item_id', bankIds);

    if (!error && data) bankMap = new Map(data.map(r => [r.bank_item_id, r]));
  }

  // Resolve library refs
  let libMap = new Map();
  if (libRefs.length) {
    libMap = await resolveLibraryRefs(libRefs);
  }

  // Merge in order, normalising LIB items to bank-like shape
  const items = [];
  const missing = [];
  ids.forEach(id => {
    if (id.startsWith('LIB:')) {
      const libItem = libMap.get(id);
      if (libItem) {
        items.push({
          bank_item_id  : id,               // use the LIB ref as the key
          stem          : libItem.stem,
          option_a      : libItem.option_a,
          option_b      : libItem.option_b,
          option_c      : libItem.option_c,
          option_d      : libItem.option_d,
          option_e      : libItem.option_e,
          option_f      : libItem.option_f,
          fb_a          : libItem.fb_a,
          fb_b          : libItem.fb_b,
          fb_c          : libItem.fb_c,
          fb_d          : libItem.fb_d,
          fb_e          : libItem.fb_e,
          fb_f          : libItem.fb_f,
          correct       : libItem.correct,
          rationale     : libItem.rationale,
          rationale_img : libItem.rationale_img,
          subject       : libItem.subject,
          maintopic     : libItem.maintopic,
          subtopic      : libItem.subtopic,
          difficulty    : libItem.difficulty,
          marks         : libItem.marks || 1,
          question_type : libItem.question_type || 'MCQ',
          shuffle_options: libItem.shuffle_options ?? true,
          _isLibrary    : true,             // flag for UI rendering
          _libRef       : id
        });
      } else {
        missing.push(id);
      }
    } else {
      if (bankMap.has(id)) items.push(bankMap.get(id));
      else missing.push(id);
    }
  });

  return { items, missing };
}


// ------------------------------------------------------------
// GET QUIZ CLASSES
// Returns ACTIVE links with joined class details.
// Used by: quizzes.html Classes tab — pre-check linked classes
// ------------------------------------------------------------
async function getQuizClasses(quizId) {
  const { data, error } = await db
    .from('teacher_quiz_classes')
    .select(`
      tqc_id,
      teacher_quiz_id,
      class_id,
      status,
      open_at,
      close_at,
      results_released,
      results_released_at,
      teacher_classes (
        class_id,
        title,
        status
      )
    `)
    .eq('teacher_quiz_id', quizId)
    .eq('status', 'ACTIVE');

  if (error) { console.error('getQuizClasses:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// GET QUIZ PUBLISHED ITEM COUNT
// Returns the number of snapshot rows in teacher_quiz_items.
// Used by: quiz tiles — shows "Items: 12" on published quizzes
// ------------------------------------------------------------
async function getQuizPublishedItemCount(quizId) {
  const { count, error } = await db
    .from('teacher_quiz_items')
    .select('quiz_item_id', { count: 'exact', head: true })
    .eq('teacher_quiz_id', quizId);

  if (error) { console.error('getQuizPublishedItemCount:', error); return 0; }
  return count || 0;
}


// ── MUTATION FUNCTIONS ──────────────────────────────────────

// ------------------------------------------------------------
// CREATE TEACHER QUIZ
// Inserts a new DRAFT quiz with generated ID and access code.
// payload: { title, subject, preset, duration_minutes, ... }
// Returns { success, data } or { success: false, message }
// Used by: quizzes.html — "New Quiz" → Save
// ------------------------------------------------------------
async function createTeacherQuiz(teacherId, payload) {
  const now    = new Date().toISOString();
  const quizId = makeQuizId();
  const code   = makeAccessCode();

  const row = {
    teacher_quiz_id       : quizId,
    teacher_id            : teacherId,
    title                 : payload.title,
    subject               : payload.subject           || null,
    preset                : payload.preset             || 'EXAM',
    duration_minutes      : payload.duration_minutes   ?? 0,
    shuffle_questions     : payload.shuffle_questions  ?? false,
    shuffle_options       : payload.shuffle_options    ?? true,
    max_attempts          : payload.max_attempts       ?? 1,
    show_review           : payload.show_review        ?? false,
    show_results          : payload.show_results       ?? true,
    results_release_policy: payload.results_release_policy || 'MANUAL',
    results_released      : false,
    results_released_at   : null,
    open_at               : payload.open_at            || null,
    close_at              : payload.close_at           || null,
    status                : 'DRAFT',
    access_code           : code,
    custom_fields_json    : payload.custom_fields_json || { fields: [] },
    draft_items_json      : { items: [] },
    grading_policy        : 'BANDS_PCT',
    grade_bands_json      : payload.grade_bands_json   || { bands: [
      { min_pct: 0,  label: 'Fail' },
      { min_pct: 50, label: 'Pass' },
      { min_pct: 65, label: 'Merit' },
      { min_pct: 80, label: 'Distinction' }
    ]},
    pass_threshold_pct    : payload.pass_threshold_pct ?? 50,
    score_display_policy  : payload.score_display_policy || 'RAW_AND_PCT',
    created_at            : now,
    updated_at            : now
  };

  const { data, error } = await db
    .from('teacher_quizzes')
    .insert(row)
    .select()
    .single();

  if (error) { console.error('createTeacherQuiz:', error); return { success: false, message: error.message }; }
  return { success: true, data };
}


// ------------------------------------------------------------
// UPDATE TEACHER QUIZ
// Patch update — only send changed fields.
// Always stamps updated_at.
// Returns { success } or { success: false, message }
// Used by: quizzes.html — Save settings, draft save, etc.
// ------------------------------------------------------------
async function updateTeacherQuiz(quizId, patch) {
  const now = new Date().toISOString();

  // Fetch current quiz to enforce field-level guards
  const { data: current, error: fetchErr } = await db
    .from('teacher_quizzes')
    .select('status')
    .eq('teacher_quiz_id', quizId)
    .maybeSingle();

  if (fetchErr || !current) return { success: false, message: 'Quiz not found.' };

  // ── Field-level guards by status ───────────────────────────
  // DRAFT: everything mutable
  // PUBLISHED: only administrative fields (schedule, display, policy)
  // ARCHIVED: only results release fields
  const IMMUTABLE_AFTER_PUBLISH = new Set([
    'sata_scoring_policy', 'shuffle_questions', 'shuffle_options',
    'duration_minutes', 'custom_fields_json', 'draft_items_json'
  ]);
  const MUTABLE_WHEN_ARCHIVED = new Set([
    'results_released', 'results_released_at', 'results_release_policy',
    'show_results', 'show_review', 'score_display_policy',
    'pass_threshold_pct', 'grade_bands_json', 'title', 'subject', 'course_id'
  ]);

  let safePatch = { ...patch };

  if (current.status === 'PUBLISHED') {
    IMMUTABLE_AFTER_PUBLISH.forEach(key => delete safePatch[key]);
  } else if (current.status === 'ARCHIVED') {
    const filtered = {};
    MUTABLE_WHEN_ARCHIVED.forEach(key => { if (key in safePatch) filtered[key] = safePatch[key]; });
    safePatch = filtered;
  }

  // ── Cross-field validation ─────────────────────────────────
  // AFTER_CLOSE requires a close_at date
  if (safePatch.results_release_policy === 'AFTER_CLOSE') {
    const effectiveCloseAt = safePatch.close_at !== undefined ? safePatch.close_at : current.close_at;
    if (!effectiveCloseAt) {
      return { success: false, message: 'AFTER_CLOSE policy requires a Close At date.' };
    }
  }

  // close_at must be after open_at
  if (safePatch.open_at !== undefined || safePatch.close_at !== undefined) {
    const { data: full } = await db.from('teacher_quizzes').select('open_at, close_at').eq('teacher_quiz_id', quizId).maybeSingle();
    const openAt = safePatch.open_at !== undefined ? safePatch.open_at : full?.open_at;
    const closeAt = safePatch.close_at !== undefined ? safePatch.close_at : full?.close_at;
    if (openAt && closeAt && new Date(closeAt) <= new Date(openAt)) {
      return { success: false, message: 'Close date must be after open date.' };
    }
  }

  // Nothing to update after filtering
  if (Object.keys(safePatch).length === 0) return { success: true };

  const { error } = await db
    .from('teacher_quizzes')
    .update({ ...safePatch, updated_at: now })
    .eq('teacher_quiz_id', quizId);

  if (error) { console.error('updateTeacherQuiz:', error); return { success: false, message: error.message }; }
  return { success: true };
}


// ------------------------------------------------------------
// ARCHIVE TEACHER QUIZ
// Sets status to ARCHIVED. Works on DRAFT or PUBLISHED.
// One-way — no unarchive.
// Used by: quizzes.html Publish tab
// ------------------------------------------------------------
async function archiveTeacherQuiz(quizId) {
  // Check for IN_PROGRESS attempts — don't archive while students are mid-attempt
  const { count, error: countErr } = await db
    .from('teacher_quiz_attempts')
    .select('attempt_id', { count: 'exact', head: true })
    .eq('teacher_quiz_id', quizId)
    .eq('status', 'IN_PROGRESS');

  if (!countErr && (count || 0) > 0) {
    return { success: false, message: `Cannot archive: ${count} student(s) currently have in-progress attempts. Wait for them to finish or timeout.` };
  }

  const now = new Date().toISOString();

  const { error } = await db
    .from('teacher_quizzes')
    .update({ status: 'ARCHIVED', updated_at: now })
    .eq('teacher_quiz_id', quizId);

  if (error) { console.error('archiveTeacherQuiz:', error); return { success: false, message: error.message }; }
  return { success: true };
}


// ------------------------------------------------------------
// REMOVE FROM DRAFT ITEMS
// Removes a single bank_item_id from the draft_items_json.
// Used by: quizzes.html — Remove button on draft list
// ------------------------------------------------------------
async function removeFromDraftItems(quizId, bankItemId) {
  const { data: quiz, error: fetchErr } = await db
    .from('teacher_quizzes')
    .select('draft_items_json')
    .eq('teacher_quiz_id', quizId)
    .maybeSingle();

  if (fetchErr || !quiz) return { success: false, message: fetchErr?.message || 'Quiz not found.' };

  let items = [];
  try {
    const parsed = typeof quiz.draft_items_json === 'object'
      ? quiz.draft_items_json
      : JSON.parse(quiz.draft_items_json || '{}');
    items = Array.isArray(parsed.items) ? parsed.items : [];
  } catch (err) {
    console.warn('[myteacher-api] removeFromDraftItems — failed to parse draft_items_json:', err.message);
    items = [];
  }

  const before = items.length;
  items = items.filter(id => id !== bankItemId);

  if (items.length === before) return { success: true, removed: 0, total: items.length };

  const now = new Date().toISOString();
  const { error } = await db
    .from('teacher_quizzes')
    .update({ draft_items_json: { items }, updated_at: now })
    .eq('teacher_quiz_id', quizId);

  if (error) { console.error('removeFromDraftItems:', error); return { success: false, message: error.message }; }
  return { success: true, removed: 1, total: items.length };
}


// ------------------------------------------------------------
// CLEAR DRAFT ITEMS
// Empties the draft_items_json completely.
// Used by: quizzes.html — Clear button on draft list
// ------------------------------------------------------------
async function clearDraftItems(quizId) {
  const now = new Date().toISOString();

  const { error } = await db
    .from('teacher_quizzes')
    .update({ draft_items_json: { items: [] }, updated_at: now })
    .eq('teacher_quiz_id', quizId);

  if (error) { console.error('clearDraftItems:', error); return { success: false, message: error.message }; }
  return { success: true };
}


// ------------------------------------------------------------
// SET QUIZ CLASSES (atomic replace + per-class schedule)
// classAssignments is an array of either:
//   - class_id strings (back-compat, no schedule)
//   - { class_id, open_at, close_at } objects
// open_at / close_at are optional; null means "inherit quiz template".
// Behaviour:
//   - Adds new links with their schedule
//   - Re-activates previously REMOVED links (updating schedule too)
//   - Updates schedule on already-ACTIVE links if values changed
//   - Soft-removes (status=REMOVED) any links not in the desired set
// Used by: quizzes.html Classes tab — Save Links
// ------------------------------------------------------------
async function setQuizClasses(quizId, teacherId, classAssignments) {
  // Normalise the input: array of { class_id, open_at, close_at }
  const desired = (classAssignments || []).map(a => {
    if (typeof a === 'string') return { class_id: a, open_at: null, close_at: null };
    return {
      class_id: a.class_id,
      open_at : a.open_at  || null,
      close_at: a.close_at || null
    };
  }).filter(a => a.class_id);

  // 1. Fetch all current links (including REMOVED for re-activation)
  const { data: existing, error: fetchErr } = await db
    .from('teacher_quiz_classes')
    .select('tqc_id, class_id, status, open_at, close_at')
    .eq('teacher_quiz_id', quizId);

  if (fetchErr) { console.error('setQuizClasses fetch:', fetchErr); return { success: false, message: fetchErr.message }; }

  const existingMap = new Map((existing || []).map(r => [r.class_id, r]));
  const desiredIds  = new Set(desired.map(d => d.class_id));
  const now         = new Date().toISOString();

  const toInsert     = [];
  const toActivate   = []; // { tqc_id, open_at, close_at }
  const toUpdate     = []; // { tqc_id, open_at, close_at }
  const toDeactivate = [];

  // 2. Walk desired set: insert new, reactivate removed, update active
  desired.forEach(d => {
    const row = existingMap.get(d.class_id);
    if (!row) {
      toInsert.push({
        tqc_id             : makeQuizClassId(),
        teacher_quiz_id    : quizId,
        class_id           : d.class_id,
        teacher_id         : teacherId,
        status             : 'ACTIVE',
        open_at            : d.open_at,
        close_at           : d.close_at,
        results_released   : false,
        results_released_at: null,
        created_at         : now,
        updated_at         : now
      });
    } else if (row.status !== 'ACTIVE') {
      toActivate.push({ tqc_id: row.tqc_id, open_at: d.open_at, close_at: d.close_at });
    } else {
      // Already active — update schedule if it changed
      const openChanged  = (row.open_at  || null) !== d.open_at;
      const closeChanged = (row.close_at || null) !== d.close_at;
      if (openChanged || closeChanged) {
        toUpdate.push({ tqc_id: row.tqc_id, open_at: d.open_at, close_at: d.close_at });
      }
    }
  });

  // 3. Find removed (active links not in desired set)
  (existing || []).forEach(row => {
    if (row.status === 'ACTIVE' && !desiredIds.has(row.class_id)) {
      toDeactivate.push(row.tqc_id);
    }
  });

  // 4. Execute
  if (toInsert.length) {
    const { error } = await db.from('teacher_quiz_classes').insert(toInsert);
    if (error) { console.error('setQuizClasses insert:', error); return { success: false, message: error.message }; }
  }
  for (const row of toActivate) {
    const { error } = await db.from('teacher_quiz_classes')
      .update({ status: 'ACTIVE', open_at: row.open_at, close_at: row.close_at, updated_at: now })
      .eq('tqc_id', row.tqc_id);
    if (error) { console.error('setQuizClasses activate:', error); return { success: false, message: error.message }; }
  }
  for (const row of toUpdate) {
    const { error } = await db.from('teacher_quiz_classes')
      .update({ open_at: row.open_at, close_at: row.close_at, updated_at: now })
      .eq('tqc_id', row.tqc_id);
    if (error) { console.error('setQuizClasses update:', error); return { success: false, message: error.message }; }
  }
  if (toDeactivate.length) {
    const { error } = await db.from('teacher_quiz_classes')
      .update({ status: 'REMOVED', updated_at: now })
      .in('tqc_id', toDeactivate);
    if (error) { console.error('setQuizClasses deactivate:', error); return { success: false, message: error.message }; }
  }

  return {
    success     : true,
    added       : toInsert.length,
    reactivated : toActivate.length,
    updated     : toUpdate.length,
    removed     : toDeactivate.length
  };
}


// ------------------------------------------------------------
// PUBLISH TEACHER QUIZ
// 1. Validates status is DRAFT and draft has items
// 2. Fetches bank items for all draft IDs
// 3. Deletes any old snapshot rows (safety re-publish)
// 4. Creates snapshot rows in teacher_quiz_items
// 5. Flips quiz status to PUBLISHED
// Returns { success, snapshotted } or { success: false, message }
// Used by: quizzes.html Publish tab
// ------------------------------------------------------------
async function publishTeacherQuiz(quizId, teacherId) {
  // 1. Fetch quiz
  const quiz = await getTeacherQuiz(quizId);
  if (!quiz) return { success: false, message: 'Quiz not found.' };
  if (quiz.status !== 'DRAFT') return { success: false, message: 'Only DRAFT quizzes can be published.' };
  if (quiz.teacher_id !== teacherId) return { success: false, message: 'Not your quiz.' };

  // 2. Parse draft items
  let draftIds = [];
  try {
    const parsed = typeof quiz.draft_items_json === 'object'
      ? quiz.draft_items_json
      : JSON.parse(quiz.draft_items_json || '{}');
    draftIds = Array.isArray(parsed.items) ? parsed.items : [];
  } catch (err) {
    console.warn('[myteacher-api] publishTeacherQuiz — failed to parse draft_ids_json:', err.message);
    draftIds = [];
  }

  // Deduplicate draft items (server-side safety)
  draftIds = [...new Set(draftIds)];

  if (!draftIds.length) return { success: false, message: 'Draft has no items.' };

  // Validate dates
  if (quiz.open_at && quiz.close_at && new Date(quiz.close_at) <= new Date(quiz.open_at)) {
    return { success: false, message: 'Close date must be after open date.' };
  }
  if (quiz.results_release_policy === 'AFTER_CLOSE' && !quiz.close_at) {
    return { success: false, message: 'AFTER_CLOSE policy requires a Close At date.' };
  }

  // 3. Split draft IDs into bank refs and library refs
  const bankIds = draftIds.filter(id => !id.startsWith('LIB:'));
  const libRefs = draftIds.filter(id => id.startsWith('LIB:'));

  // 3a. Fetch bank items
  let bankMap = new Map();
  if (bankIds.length) {
    const { data: bankItems, error: bankErr } = await db
      .from('teacher_bank_items')
      .select('*')
      .in('bank_item_id', bankIds);

    if (bankErr) return { success: false, message: 'Failed to fetch bank items: ' + bankErr.message };
    bankMap = new Map((bankItems || []).map(r => [r.bank_item_id, r]));
  }

  // 3b. Resolve library refs
  let libMap = new Map();
  if (libRefs.length) {
    libMap = await resolveLibraryRefs(libRefs);
  }

  // 4. Validate all items found
  const missingIds = draftIds.filter(id => {
    if (id.startsWith('LIB:')) return !libMap.has(id);
    return !bankMap.has(id);
  });
  if (missingIds.length) {
    return { success: false, message: 'Missing items: ' + missingIds.join(', ') };
  }

  // 5. Delete old snapshots (safety — shouldn't exist for DRAFT)
  await db.from('teacher_quiz_items').delete().eq('teacher_quiz_id', quizId);

  // 6. Build snapshot rows — unified from both bank and library sources
  const now = new Date().toISOString();
  const snapshotRows = draftIds.map((refId, idx) => {
    const isLib = refId.startsWith('LIB:');
    const b = isLib ? libMap.get(refId) : bankMap.get(refId);
    return {
      quiz_item_id       : makeQuizItemId(),
      teacher_quiz_id    : quizId,
      position           : idx + 1,
      bank_item_id       : isLib ? refId : refId,   // store original ref for traceability
      snap_stem          : b.stem,
      snap_option_a      : b.option_a,
      snap_fb_a          : b.fb_a,
      snap_option_b      : b.option_b,
      snap_fb_b          : b.fb_b,
      snap_option_c      : b.option_c,
      snap_fb_c          : b.fb_c,
      snap_option_d      : b.option_d,
      snap_fb_d          : b.fb_d,
      snap_option_e      : b.option_e,
      snap_fb_e          : b.fb_e,
      snap_option_f      : b.option_f,
      snap_fb_f          : b.fb_f,
      snap_correct       : (b.correct || '').toUpperCase(),
      snap_rationale     : b.rationale,
      snap_rationale_img : b.rationale_img,
      snap_subject       : b.subject,
      snap_maintopic     : b.maintopic,
      snap_subtopic      : b.subtopic,
      snap_difficulty    : b.difficulty,
      snap_marks         : b.marks || 1,
      snap_question_type : b.question_type || 'MCQ',
      snap_shuffle_options: b.shuffle_options ?? true,
      snap_question_ref  : b.question_ref || null,
      snap_tags          : Array.isArray(b.tags) ? b.tags : [],
      snap_year_level    : b.year_level || null,
      snap_bloom_level   : b.bloom_level || null,
      snapped_at         : now
    };
  });

  // 7. Insert snapshots
  const { error: snapErr } = await db.from('teacher_quiz_items').insert(snapshotRows);
  if (snapErr) return { success: false, message: 'Snapshot insert failed: ' + snapErr.message };

  // 8. Flip status to PUBLISHED
  const { error: pubErr } = await db
    .from('teacher_quizzes')
    .update({ status: 'PUBLISHED', updated_at: now })
    .eq('teacher_quiz_id', quizId);

  if (pubErr) return { success: false, message: 'Status update failed: ' + pubErr.message };

  return { success: true, snapshotted: snapshotRows.length };
}


// ------------------------------------------------------------
// RELEASE QUIZ RESULTS
// Release state lives on teacher_quiz_classes (per-class). If classId
// is given, releases only that class's link. Otherwise, bulk-releases
// all ACTIVE links for the quiz.
// Used by: quizzes.html Publish tab — Release Results button
// ------------------------------------------------------------
async function releaseQuizResults(quizId, classId = null) {
  const now = new Date().toISOString();

  let q = db
    .from('teacher_quiz_classes')
    .update({
      results_released   : true,
      results_released_at: now,
      updated_at         : now
    })
    .eq('teacher_quiz_id', quizId)
    .eq('status', 'ACTIVE');

  if (classId) q = q.eq('class_id', classId);

  const { data, error } = await q.select('tqc_id');

  if (error) { console.error('releaseQuizResults:', error); return { success: false, message: error.message }; }
  return { success: true, released_count: (data || []).length };
}


// ------------------------------------------------------------
// UNRELEASE QUIZ RESULTS (revoke)
// Sets results_released=false and clears results_released_at on the
// target link(s). If classId is given, only that class is revoked;
// otherwise all ACTIVE links for the quiz are revoked.
// Used by: quizzes.html Classes tab — per-class Revoke action
// ------------------------------------------------------------
async function unreleaseQuizResults(quizId, classId = null) {
  const now = new Date().toISOString();

  let q = db
    .from('teacher_quiz_classes')
    .update({
      results_released   : false,
      results_released_at: null,
      updated_at         : now
    })
    .eq('teacher_quiz_id', quizId)
    .eq('status', 'ACTIVE');

  if (classId) q = q.eq('class_id', classId);

  const { data, error } = await q.select('tqc_id');

  if (error) { console.error('unreleaseQuizResults:', error); return { success: false, message: error.message }; }
  return { success: true, revoked_count: (data || []).length };
}


// ------------------------------------------------------------
// GET QUIZ CLASS STATS
// Returns per-class attempt + member counts for a given quiz.
// Shape: { [class_id]: { members, submitted, in_progress } }
// Used by: quizzes.html Classes tab — right-panel stats row
// ------------------------------------------------------------
async function getQuizClassStats(quizId) {
  // 1. Which classes are linked to this quiz?
  const { data: links, error: linkErr } = await db
    .from('teacher_quiz_classes')
    .select('class_id')
    .eq('teacher_quiz_id', quizId)
    .eq('status', 'ACTIVE');

  if (linkErr || !links || !links.length) return {};

  const classIds = links.map(l => l.class_id);
  const stats = {};
  classIds.forEach(id => { stats[id] = { members: 0, submitted: 0, in_progress: 0 }; });

  // 2. Active member counts per class
  const { data: members, error: memErr } = await db
    .from('teacher_class_members')
    .select('class_id')
    .in('class_id', classIds)
    .eq('status', 'ACTIVE');

  if (!memErr && members) {
    members.forEach(m => { if (stats[m.class_id]) stats[m.class_id].members += 1; });
  }

  // 3. Attempt counts per class (only for this quiz)
  const { data: attempts, error: attErr } = await db
    .from('teacher_quiz_attempts')
    .select('class_id, status')
    .eq('teacher_quiz_id', quizId)
    .in('class_id', classIds);

  if (!attErr && attempts) {
    attempts.forEach(a => {
      if (!stats[a.class_id]) return;
      if (a.status === 'SUBMITTED' || a.status === 'TIMED_OUT') stats[a.class_id].submitted += 1;
      else if (a.status === 'IN_PROGRESS')                       stats[a.class_id].in_progress += 1;
    });
  }

  return stats;
}


// ------------------------------------------------------------
// CLONE TEACHER QUIZ
// Creates a new DRAFT from an existing quiz.
// Copies all settings, grade bands, custom fields.
// Title = "Original (Copy)"
// New access code generated.
// If source was PUBLISHED, extracts bank_item_ids from
// snapshot rows into the clone's draft_items_json.
// Does NOT copy class links — the clone is a fresh template.
// options: { copySchedule: false }
// Returns { success, data } (the new quiz row)
// Used by: quizzes.html — Clone button
// ------------------------------------------------------------
async function cloneTeacherQuiz(sourceQuizId, teacherId, { copySchedule = false } = {}) {
  // 1. Fetch source
  const source = await getTeacherQuiz(sourceQuizId);
  if (!source) return { success: false, message: 'Source quiz not found.' };
  if (source.teacher_id !== teacherId) return { success: false, message: 'Not your quiz.' };

  // 2. Build draft items — from draft_items_json or snapshots
  let draftItems = [];
  if (source.status === 'PUBLISHED') {
    // Extract from published snapshots
    const { data: snaps, error: snapErr } = await db
      .from('teacher_quiz_items')
      .select('bank_item_id')
      .eq('teacher_quiz_id', sourceQuizId)
      .order('position', { ascending: true });

    if (!snapErr && snaps) {
      draftItems = snaps.map(s => s.bank_item_id).filter(Boolean);
    }
  } else {
    // Copy from draft
    try {
      const parsed = typeof source.draft_items_json === 'object'
        ? source.draft_items_json
        : JSON.parse(source.draft_items_json || '{}');
      draftItems = Array.isArray(parsed.items) ? parsed.items : [];
    } catch (err) {
      console.warn('[myteacher-api] cloneTeacherQuiz — failed to parse draft_items_json:', err.message);
      draftItems = [];
    }
  }

  // 3. Create clone
  const now    = new Date().toISOString();
  const quizId = makeQuizId();
  const code   = makeAccessCode();

  const row = {
    teacher_quiz_id       : quizId,
    teacher_id            : teacherId,
    title                 : (source.title || 'Untitled') + ' (Copy)',
    subject               : source.subject,
    preset                : source.preset,
    duration_minutes      : source.duration_minutes,
    shuffle_questions     : source.shuffle_questions,
    shuffle_options       : source.shuffle_options,
    max_attempts          : source.max_attempts,
    show_review           : source.show_review,
    show_results          : source.show_results,
    results_release_policy: source.results_release_policy,
    results_released      : false,
    results_released_at   : null,
    open_at               : copySchedule ? source.open_at  : null,
    close_at              : copySchedule ? source.close_at : null,
    status                : 'DRAFT',
    access_code           : code,
    custom_fields_json    : source.custom_fields_json,
    draft_items_json      : { items: draftItems },
    grading_policy        : source.grading_policy,
    grade_bands_json      : source.grade_bands_json,
    pass_threshold_pct    : source.pass_threshold_pct,
    score_display_policy  : source.score_display_policy,
    created_at            : now,
    updated_at            : now
  };

  const { data, error } = await db
    .from('teacher_quizzes')
    .insert(row)
    .select()
    .single();

  if (error) { console.error('cloneTeacherQuiz:', error); return { success: false, message: error.message }; }

  // NOTE: Class links are intentionally NOT copied. A clone is a fresh
  // template with no assignments — the teacher re-assigns explicitly.
  return { success: true, data };
}


// ------------------------------------------------------------
// REGENERATE QUIZ ACCESS CODE
// Generates a new 6-char access code. DRAFT only.
// Returns { success, access_code }
// Used by: quizzes.html Settings tab
// ------------------------------------------------------------
async function regenerateQuizAccessCode(quizId) {
  const quiz = await getTeacherQuiz(quizId);
  if (!quiz) return { success: false, message: 'Quiz not found.' };
  if (quiz.status !== 'DRAFT') return { success: false, message: 'Can only regenerate code for DRAFT quizzes.' };

  const newCode = makeAccessCode();
  const now     = new Date().toISOString();

  const { error } = await db
    .from('teacher_quizzes')
    .update({ access_code: newCode, updated_at: now })
    .eq('teacher_quiz_id', quizId);

  if (error) { console.error('regenerateQuizAccessCode:', error); return { success: false, message: error.message }; }
  return { success: true, access_code: newCode };
}


// ============================================================
// Slice 7: Student Quiz Runner
// ============================================================

// ── ID generator ───────────────────────────────────────────

function makeAttemptId() {
  return 'ATT_' + Date.now() + '_' + makeSecureId('').slice(0, 7);
}


// ── Effective quiz window resolver ─────────────────────────
// Resolves the effective open/close window for a student taking a
// quiz via a specific class link. Link values override the quiz-level
// template defaults. Null = always open / never closes.
function _effectiveQuizWindow(quiz, link) {
  const q = quiz || {};
  const l = link || {};
  return {
    open_at : (l.open_at  != null ? l.open_at  : q.open_at)  || null,
    close_at: (l.close_at != null ? l.close_at : q.close_at) || null
  };
}


// ------------------------------------------------------------
// GET QUIZZES FOR CLASS (Student)
// Returns all PUBLISHED quizzes linked to a given class.
// Joins through teacher_quiz_classes → teacher_quizzes.
// Also fetches the student's attempts so UI can show status.
// Used by: myteacher/student/my-classes.html Quizzes tab
// ------------------------------------------------------------
async function getQuizzesForClass(classId, userId) {
  // 1. Get quiz links for this class (with per-class schedule + release)
  const { data: links, error: linkErr } = await db
    .from('teacher_quiz_classes')
    .select('teacher_quiz_id, open_at, close_at, results_released, results_released_at')
    .eq('class_id', classId)
    .eq('status', 'ACTIVE');

  if (linkErr) { console.error('getQuizzesForClass links:', linkErr); return []; }
  if (!links || !links.length) return [];

  const quizIds = links.map(l => l.teacher_quiz_id);
  const linkMap = new Map(links.map(l => [l.teacher_quiz_id, l]));

  // 2. Fetch full quiz rows — only PUBLISHED
  const { data: quizzes, error: qErr } = await db
    .from('teacher_quizzes')
    .select('*')
    .in('teacher_quiz_id', quizIds)
    .eq('status', 'PUBLISHED')
    .order('updated_at', { ascending: false });

  if (qErr) { console.error('getQuizzesForClass quizzes:', qErr); return []; }
  if (!quizzes || !quizzes.length) return [];

  // 3. Fetch student's attempts for these quizzes
  const { data: attempts, error: aErr } = await db
    .from('teacher_quiz_attempts')
    .select('attempt_id, teacher_quiz_id, attempt_no, status, score_pct, started_at, submitted_at')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .in('teacher_quiz_id', quizzes.map(q => q.teacher_quiz_id))
    .neq('status', 'ABANDONED')
    .order('started_at', { ascending: false });

  if (aErr) console.error('getQuizzesForClass attempts:', aErr);

  // 4. Attach attempts to quizzes
  const attemptMap = {};
  (attempts || []).forEach(a => {
    if (!attemptMap[a.teacher_quiz_id]) attemptMap[a.teacher_quiz_id] = [];
    attemptMap[a.teacher_quiz_id].push(a);
  });

  // 5. Get item counts for each quiz
  const { data: itemCounts, error: icErr } = await db
    .from('teacher_quiz_items')
    .select('teacher_quiz_id')
    .in('teacher_quiz_id', quizzes.map(q => q.teacher_quiz_id));

  const countMap = {};
  (itemCounts || []).forEach(r => {
    countMap[r.teacher_quiz_id] = (countMap[r.teacher_quiz_id] || 0) + 1;
  });

  // 6. Resolve effective window + availability state per quiz
  const now = new Date();
  return quizzes.map(q => {
    const link = linkMap.get(q.teacher_quiz_id);
    const { open_at, close_at } = _effectiveQuizWindow(q, link);
    let state = 'AVAILABLE';
    if (open_at  && new Date(open_at)  > now) state = 'NOT_OPEN';
    if (close_at && new Date(close_at) < now) state = 'CLOSED';
    return {
      ...q,
      effective_open_at        : open_at,
      effective_close_at       : close_at,
      link_results_released    : link?.results_released ?? false,
      link_results_released_at : link?.results_released_at ?? null,
      state,
      item_count: countMap[q.teacher_quiz_id] || 0,
      attempts  : attemptMap[q.teacher_quiz_id] || []
    };
  });
}


// ------------------------------------------------------------
// GET PUBLISHED QUIZ WITH ITEMS (Student)
// Returns the quiz row + all snapshot items (ordered by position).
// Does NOT return correct answers — those stay server-side
// for grading only (but we're client-side, so we omit from
// the items_json stored on the attempt instead).
// Used by: quiz-runner.html — loading the quiz
// ------------------------------------------------------------
async function getPublishedQuizWithItems(quizId) {
  // Fetch quiz
  const { data: quiz, error: qErr } = await db
    .from('teacher_quizzes')
    .select('*')
    .eq('teacher_quiz_id', quizId)
    .eq('status', 'PUBLISHED')
    .maybeSingle();

  if (qErr) { console.error('getPublishedQuizWithItems quiz:', qErr); return null; }
  if (!quiz) return null;

  // Fetch snapshot items
  const { data: items, error: iErr } = await db
    .from('teacher_quiz_items')
    .select('*')
    .eq('teacher_quiz_id', quizId)
    .order('position', { ascending: true });

  if (iErr) { console.error('getPublishedQuizWithItems items:', iErr); return null; }

  return { quiz, items: items || [] };
}


// ------------------------------------------------------------
// START QUIZ ATTEMPT (Student)
// Creates a new attempt or resumes an existing IN_PROGRESS one.
// Handles: max attempt enforcement, open/close window check,
//          question shuffling with opt_map, due_at calculation.
//
// candidateFields: { key: value } from intake form
// Returns { success, attempt, resumed } or { success: false, ... }
// Used by: quiz-runner.html
// ------------------------------------------------------------
async function startQuizAttempt(userId, quizId, classId, candidateFields = {}) {
  // 1. Fetch quiz
  const quizData = await getPublishedQuizWithItems(quizId);
  if (!quizData) return { success: false, message: 'Quiz not found or not published.' };
  const { quiz, items } = quizData;

  // 2. Verify class link (including its per-class schedule)
  const { data: link, error: linkErr } = await db
    .from('teacher_quiz_classes')
    .select('tqc_id, open_at, close_at')
    .eq('teacher_quiz_id', quizId)
    .eq('class_id', classId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (linkErr || !link) return { success: false, message: 'This quiz is not linked to your class.' };

  // 3. Verify class membership
  const membership = await getExistingMembership(userId, classId);
  if (!membership || membership.status !== 'ACTIVE') {
    return { success: false, message: 'You are not an active member of this class.' };
  }

  // 4. Check effective open/close window (link overrides quiz template)
  const { open_at: effOpenAt, close_at: effCloseAt } = _effectiveQuizWindow(quiz, link);
  const now = new Date();
  if (effOpenAt && new Date(effOpenAt) > now) {
    return { success: false, code: 'NOT_OPEN', message: 'This quiz is not open yet.', open_at: effOpenAt };
  }
  if (effCloseAt && new Date(effCloseAt) < now) {
    return { success: false, code: 'CLOSED', message: 'This quiz has closed.' };
  }

  // 5. Check for existing IN_PROGRESS attempt — resume if found
  const { data: existing, error: exErr } = await db
    .from('teacher_quiz_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('teacher_quiz_id', quizId)
    .eq('class_id', classId)
    .eq('status', 'IN_PROGRESS')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!exErr && existing) {
    // Check if timed out
    if (existing.due_at && new Date(existing.due_at) < now) {
      // Auto-submit as TIMED_OUT
      await _autoTimeoutAttempt(existing);
      // Fall through to create new attempt
    } else {
      // Resume — patch time and return
      const timePatch = _calcTimePatch(existing, now);
      if (timePatch.updated) {
        await db.from('teacher_quiz_attempts')
          .update({ time_taken_s: timePatch.time_taken_s, updated_at: now.toISOString() })
          .eq('attempt_id', existing.attempt_id);
        existing.time_taken_s = timePatch.time_taken_s;
        existing.updated_at = now.toISOString();
      }
      return { success: true, attempt: existing, quiz, resumed: true };
    }
  }

  // 6. Check max attempts
  const { count, error: countErr } = await db
    .from('teacher_quiz_attempts')
    .select('attempt_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('teacher_quiz_id', quizId)
    .eq('class_id', classId)
    .neq('status', 'ABANDONED');

  if (countErr) return { success: false, message: 'Could not check attempt count.' };

  const maxAttempts = quiz.max_attempts || 0; // 0 = unlimited
  if (maxAttempts > 0 && (count || 0) >= maxAttempts) {
    return { success: false, code: 'MAX_ATTEMPTS', message: `Maximum attempts reached (${maxAttempts}).` };
  }

  // 7. Build items_json with shuffle + opt_map
  const attemptItems = _buildAttemptItems(items, quiz.shuffle_questions, quiz.shuffle_options);

  // 8. Calculate due_at
  let dueAt = null;
  if (quiz.duration_minutes && quiz.duration_minutes > 0) {
    dueAt = new Date(now.getTime() + quiz.duration_minutes * 60 * 1000);
    // Cap to quiz close_at if earlier
    if (quiz.close_at) {
      const closeDate = new Date(quiz.close_at);
      if (closeDate < dueAt) dueAt = closeDate;
    }
  }

  // 9. Concurrency guard — re-check for IN_PROGRESS (prevents double-click race)
  const { data: raceCheck } = await db
    .from('teacher_quiz_attempts')
    .select('attempt_id')
    .eq('user_id', userId)
    .eq('teacher_quiz_id', quizId)
    .eq('class_id', classId)
    .eq('status', 'IN_PROGRESS')
    .limit(1)
    .maybeSingle();
  if (raceCheck) {
    return { success: false, message: 'An attempt is already in progress. Please refresh the page.' };
  }

  // 10. Create attempt row
  const attemptId = makeAttemptId();
  const attemptNo = (count || 0) + 1;
  const nowIso = now.toISOString();

  const row = {
    attempt_id          : attemptId,
    user_id             : userId,
    teacher_quiz_id     : quizId,
    teacher_id          : quiz.teacher_id,
    class_id            : classId,
    attempt_no          : attemptNo,
    mode                : quiz.preset || 'EXAM',
    duration_minutes    : quiz.duration_minutes || 0,
    status              : 'IN_PROGRESS',
    started_at          : nowIso,
    due_at              : dueAt ? dueAt.toISOString() : null,
    submitted_at        : null,
    updated_at          : nowIso,
    items_json          : attemptItems,
    answers_json        : {},
    flags_json          : {},
    candidate_fields_json: { fields: candidateFields },
    score_raw           : null,
    score_total         : null,
    score_pct           : null,
    time_taken_s        : 0,
    score_json          : null,
    grading_policy      : null,
    grade_bands_json    : null,
    score_display_policy: null
  };

  const { data, error: insErr } = await db
    .from('teacher_quiz_attempts')
    .insert(row)
    .select()
    .single();

  if (insErr) { console.error('startQuizAttempt:', insErr); return { success: false, message: insErr.message }; }

  return { success: true, attempt: data, quiz, resumed: false };
}


// ------------------------------------------------------------
// SAVE ATTEMPT PROGRESS (auto-save)
// Updates answers_json, flags_json, and time_taken_s.
// Also checks for timeout — auto-submits if expired.
// Returns { success, timed_out }
// Used by: quiz-runner.html — debounced auto-save
// ------------------------------------------------------------
async function saveAttemptProgress(attemptId, answersJson, flagsJson, timeTakenS) {
  const now = new Date();
  const nowIso = now.toISOString();

  // Fetch current attempt to check timeout
  const { data: attempt, error: fetchErr } = await db
    .from('teacher_quiz_attempts')
    .select('status, due_at, duration_minutes')
    .eq('attempt_id', attemptId)
    .maybeSingle();

  if (fetchErr || !attempt) return { success: false, message: 'Attempt not found.' };
  if (attempt.status !== 'IN_PROGRESS') return { success: false, message: 'Attempt is not in progress.' };

  // Check timeout
  if (attempt.due_at && new Date(attempt.due_at) < now) {
    // Save answers first, then auto-submit
    await db.from('teacher_quiz_attempts')
      .update({ answers_json: answersJson, flags_json: flagsJson, updated_at: nowIso })
      .eq('attempt_id', attemptId);
    return { success: true, timed_out: true };
  }

  // Cap time_taken_s
  const maxSeconds = (attempt.duration_minutes || 0) * 60;
  let cappedTime = timeTakenS || 0;
  if (maxSeconds > 0 && cappedTime > maxSeconds) cappedTime = maxSeconds;

  const { error } = await db
    .from('teacher_quiz_attempts')
    .update({
      answers_json : answersJson,
      flags_json   : flagsJson,
      time_taken_s : cappedTime,
      updated_at   : nowIso
    })
    .eq('attempt_id', attemptId);

  if (error) { console.error('saveAttemptProgress:', error); return { success: false, message: error.message }; }
  return { success: true, timed_out: false };
}


// ------------------------------------------------------------
// SUBMIT QUIZ ATTEMPT (Student)
// Grades the attempt, writes scores, flips status.
// Snapshots grading settings from quiz onto attempt row.
// Returns { success, attempt } with final scores.
// Used by: quiz-runner.html — submit button + auto-timeout
// ------------------------------------------------------------
async function submitQuizAttempt(attemptId, answersJson, timeTakenS) {
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Fetch full attempt
  const { data: attempt, error: aErr } = await db
    .from('teacher_quiz_attempts')
    .select('*')
    .eq('attempt_id', attemptId)
    .maybeSingle();

  if (aErr || !attempt) return { success: false, message: 'Attempt not found.' };
  if (attempt.status !== 'IN_PROGRESS') return { success: false, message: 'Attempt already submitted.' };

  // 2. Fetch quiz for grading settings + SATA scoring policy
  const quiz = await getTeacherQuiz(attempt.teacher_quiz_id);
  if (!quiz) return { success: false, message: 'Quiz not found.' };

  // 3. Fetch snapshot items for grading
  const { data: snapItems, error: sErr } = await db
    .from('teacher_quiz_items')
    .select('*')
    .eq('teacher_quiz_id', attempt.teacher_quiz_id);

  if (sErr) return { success: false, message: 'Could not fetch quiz items.' };

  const snapMap = new Map((snapItems || []).map(s => [s.quiz_item_id, s]));

  // 4. Grade
  const finalAnswers = answersJson || attempt.answers_json || {};
  const attemptItems = attempt.items_json || [];
  const sataPolicy = quiz.sata_scoring_policy || 'ALL_OR_NOTHING';

  let totalMarks = 0;
  let scoreMarks = 0;

  attemptItems.forEach(item => {
    const snap = snapMap.get(item.quiz_item_id);
    if (!snap) return;
    const marks = snap.snap_marks || 1;
    totalMarks += marks;

    const qType = snap.snap_question_type || 'MCQ';
    const studentAnswer = finalAnswers[item.quiz_item_id];

    if (qType === 'SATA') {
      // SATA: snap_correct is comma-separated e.g. "A,C,E"
      const correctSet = new Set((snap.snap_correct || '').split(',').map(s => s.trim()).filter(Boolean));
      const studentSet = new Set(
        Array.isArray(studentAnswer) ? studentAnswer :
        (typeof studentAnswer === 'string' ? studentAnswer.split(',').map(s => s.trim()).filter(Boolean) : [])
      );

      // Reverse shuffle via opt_map
      const origStudentSet = new Set();
      studentSet.forEach(displayLetter => {
        const origLetter = item.opt_map ? item.opt_map[displayLetter] : displayLetter;
        if (origLetter) origStudentSet.add(origLetter);
      });

      if (sataPolicy === 'ALL_OR_NOTHING') {
        // Must match exactly
        if (origStudentSet.size === correctSet.size &&
            [...origStudentSet].every(l => correctSet.has(l))) {
          scoreMarks += marks;
        }
      } else if (sataPolicy === 'PARTIAL_CREDIT') {
        // +1 per correct pick, -1 per wrong pick, floor 0, scaled to marks
        const totalOptions = _countSataOptions(snap);
        let credit = 0;
        origStudentSet.forEach(l => { credit += correctSet.has(l) ? 1 : -1; });
        credit = Math.max(0, credit);
        scoreMarks += Math.round((credit / correctSet.size) * marks * 100) / 100;
      } else if (sataPolicy === 'PER_OPTION') {
        // Each option scored independently
        const allOptions = _getSataOptionLetters(snap);
        let correct = 0;
        allOptions.forEach(letter => {
          const shouldBeSelected = correctSet.has(letter);
          const wasSelected = origStudentSet.has(letter);
          if (shouldBeSelected === wasSelected) correct++;
        });
        scoreMarks += Math.round((correct / allOptions.length) * marks * 100) / 100;
      }
    } else {
      // MCQ or TF — single answer
      const chosen = typeof studentAnswer === 'string' ? studentAnswer.trim() : '';
      // Reverse shuffle via opt_map
      const origChosen = item.opt_map ? (item.opt_map[chosen] || chosen) : chosen;
      if (origChosen && origChosen === snap.snap_correct) {
        scoreMarks += marks;
      }
    }
  });

  const pct = totalMarks > 0 ? Math.round((scoreMarks / totalMarks) * 10000) / 100 : 0;

  // Determine if timed out
  const timedOut = attempt.due_at && new Date(attempt.due_at) < now;

  // Cap time
  const maxSeconds = (attempt.duration_minutes || 0) * 60;
  let finalTime = timeTakenS || attempt.time_taken_s || 0;
  if (maxSeconds > 0 && finalTime > maxSeconds) finalTime = maxSeconds;

  // 5. Update attempt
  const patch = {
    status              : timedOut ? 'TIMED_OUT' : 'SUBMITTED',
    answers_json        : finalAnswers,
    submitted_at        : nowIso,
    updated_at          : nowIso,
    time_taken_s        : finalTime,
    score_raw           : scoreMarks,
    score_total         : totalMarks,
    score_pct           : pct,
    score_json          : {
      total_marks: totalMarks, score_marks: scoreMarks, percent: pct,
      sata_scoring_policy: sataPolicy,
      pass_threshold_pct: quiz.pass_threshold_pct ?? 50,
      results_release_policy: quiz.results_release_policy,
      show_review: quiz.show_review,
      show_results: quiz.show_results,
      results_released: quiz.results_released,
      close_at: quiz.close_at
    },
    grading_policy      : quiz.grading_policy,
    grade_bands_json    : quiz.grade_bands_json,
    score_display_policy: quiz.score_display_policy
  };

  const { data: updated, error: uErr } = await db
    .from('teacher_quiz_attempts')
    .update(patch)
    .eq('attempt_id', attemptId)
    .select()
    .single();

  if (uErr) { console.error('submitQuizAttempt:', uErr); return { success: false, message: uErr.message }; }

  return { success: true, attempt: updated };
}


// ------------------------------------------------------------
// GET ATTEMPT (for resume or completion screen)
// Returns the full attempt row.
// Used by: quiz-runner.html — resume or completion page
// ------------------------------------------------------------
async function getAttempt(attemptId) {
  const { data, error } = await db
    .from('teacher_quiz_attempts')
    .select('*')
    .eq('attempt_id', attemptId)
    .maybeSingle();

  if (error) { console.error('getAttempt:', error); return null; }
  return data;
}


// ── Helper: auto-timeout an expired attempt ─────────────────
// Grades whatever answers the student has, then marks TIMED_OUT.
async function _autoTimeoutAttempt(attempt) {
  const nowIso = new Date().toISOString();
  const maxSeconds = (attempt.duration_minutes || 0) * 60;
  let finalTime = attempt.time_taken_s || 0;
  if (maxSeconds > 0 && finalTime > maxSeconds) finalTime = maxSeconds;

  // Fetch quiz + snapshot items for grading
  const quiz = await getTeacherQuiz(attempt.teacher_quiz_id);
  const { data: snapItems } = await db
    .from('teacher_quiz_items')
    .select('*')
    .eq('teacher_quiz_id', attempt.teacher_quiz_id);

  let scoreMarks = 0;
  let totalMarks = 0;

  if (quiz && snapItems && snapItems.length) {
    const snapMap = new Map(snapItems.map(s => [s.quiz_item_id, s]));
    const finalAnswers = attempt.answers_json || {};
    const attemptItems = attempt.items_json || [];
    const sataPolicy = quiz.sata_scoring_policy || 'ALL_OR_NOTHING';

    attemptItems.forEach(item => {
      const snap = snapMap.get(item.quiz_item_id);
      if (!snap) return;
      const marks = snap.snap_marks || 1;
      totalMarks += marks;

      const qType = snap.snap_question_type || 'MCQ';
      const studentAnswer = finalAnswers[item.quiz_item_id];

      if (qType === 'SATA') {
        const correctSet = new Set((snap.snap_correct || '').split(',').map(s => s.trim()).filter(Boolean));
        const studentSet = new Set(
          Array.isArray(studentAnswer) ? studentAnswer :
          (typeof studentAnswer === 'string' ? studentAnswer.split(',').map(s => s.trim()).filter(Boolean) : [])
        );
        const origStudentSet = new Set();
        studentSet.forEach(dl => {
          const orig = item.opt_map ? item.opt_map[dl] : dl;
          if (orig) origStudentSet.add(orig);
        });

        if (sataPolicy === 'ALL_OR_NOTHING') {
          if (origStudentSet.size === correctSet.size &&
              [...origStudentSet].every(l => correctSet.has(l))) {
            scoreMarks += marks;
          }
        } else if (sataPolicy === 'PARTIAL_CREDIT') {
          let credit = 0;
          origStudentSet.forEach(l => { credit += correctSet.has(l) ? 1 : -1; });
          credit = Math.max(0, credit);
          scoreMarks += Math.round((credit / correctSet.size) * marks * 100) / 100;
        } else if (sataPolicy === 'PER_OPTION') {
          const allOptions = _getSataOptionLetters(snap);
          let correct = 0;
          allOptions.forEach(letter => {
            if (correctSet.has(letter) === origStudentSet.has(letter)) correct++;
          });
          scoreMarks += Math.round((correct / allOptions.length) * marks * 100) / 100;
        }
      } else {
        const chosen = typeof studentAnswer === 'string' ? studentAnswer.trim() : '';
        const origChosen = item.opt_map ? (item.opt_map[chosen] || chosen) : chosen;
        if (origChosen && origChosen === snap.snap_correct) {
          scoreMarks += marks;
        }
      }
    });
  }

  const pct = totalMarks > 0 ? Math.round((scoreMarks / totalMarks) * 10000) / 100 : 0;

  const patch = {
    status              : 'TIMED_OUT',
    submitted_at        : nowIso,
    updated_at          : nowIso,
    time_taken_s        : finalTime,
    score_raw           : scoreMarks,
    score_total         : totalMarks,
    score_pct           : pct,
    score_json          : quiz ? {
      total_marks: totalMarks, score_marks: scoreMarks, percent: pct,
      sata_scoring_policy: quiz.sata_scoring_policy || 'ALL_OR_NOTHING',
      pass_threshold_pct: quiz.pass_threshold_pct ?? 50,
      results_release_policy: quiz.results_release_policy,
      show_review: quiz.show_review,
      show_results: quiz.show_results,
      results_released: quiz.results_released,
      close_at: quiz.close_at
    } : null,
    grading_policy      : quiz ? quiz.grading_policy : null,
    grade_bands_json    : quiz ? quiz.grade_bands_json : null,
    score_display_policy: quiz ? quiz.score_display_policy : null
  };

  await db.from('teacher_quiz_attempts')
    .update(patch)
    .eq('attempt_id', attempt.attempt_id);
}


// ── Helper: calculate time patch on resume ──────────────────
function _calcTimePatch(attempt, now) {
  const lastUpdate = new Date(attempt.updated_at || attempt.started_at);
  const deltaSec = Math.max(0, Math.floor((now.getTime() - lastUpdate.getTime()) / 1000));
  let newTime = (attempt.time_taken_s || 0) + deltaSec;
  const maxSeconds = (attempt.duration_minutes || 0) * 60;
  if (maxSeconds > 0 && newTime > maxSeconds) newTime = maxSeconds;
  return { time_taken_s: newTime, updated: deltaSec > 0 };
}


// ── Helper: build attempt items with shuffle + opt_map ──────
function _buildAttemptItems(snapshotItems, shuffleQuestions, quizShuffleOptions) {
  // Copy items
  let items = snapshotItems.map(snap => {
    const optMap = {};
    const letters = ['A','B','C','D','E','F'];
    const availableLetters = letters.filter(l => snap['snap_option_' + l.toLowerCase()] != null);

    // Determine if we should shuffle this question's options
    const shouldShuffle = quizShuffleOptions && snap.snap_shuffle_options !== false;

    if (shouldShuffle && snap.snap_question_type !== 'TF') {
      const shuffled = secureShuffle(availableLetters);
      // optMap: display letter → original letter
      shuffled.forEach((origLetter, idx) => {
        optMap[availableLetters[idx]] = origLetter;
      });
    } else {
      // No shuffle — identity map
      availableLetters.forEach(l => { optMap[l] = l; });
    }

    return {
      quiz_item_id: snap.quiz_item_id,
      position    : snap.position,
      marks       : snap.snap_marks || 1,
      opt_map     : optMap,
      question_type: snap.snap_question_type || 'MCQ'
    };
  });

  // Shuffle question order if enabled
  if (shuffleQuestions) {
    const shuffled = secureShuffle(items);
    items.length = 0;
    items.push(...shuffled);
    // Re-assign position after shuffle
    items.forEach((item, idx) => { item.position = idx + 1; });
  }

  return items;
}


// ── Helper: count SATA options ──────────────────────────────
function _countSataOptions(snap) {
  let count = 0;
  ['a','b','c','d','e','f'].forEach(l => {
    if (snap['snap_option_' + l] != null) count++;
  });
  return count;
}

function _getSataOptionLetters(snap) {
  const letters = [];
  ['A','B','C','D','E','F'].forEach(l => {
    if (snap['snap_option_' + l.toLowerCase()] != null) letters.push(l);
  });
  return letters;
}


// ============================================================
// Slice 8: Student Results & Review
// ============================================================

// ------------------------------------------------------------
// GET ATTEMPT RESULTS (Student)
// Returns the attempt with score data, gated by release policy.
// Computes: gate_met, display_score, grade_label, pass_status,
//           results/review availability, and metadata.
// Used by: myteacher/student/my-results.html — Results tab
// ------------------------------------------------------------
async function getAttemptResults(attemptId, userId) {
  // 1. Fetch attempt
  const { data: attempt, error: aErr } = await db
    .from('teacher_quiz_attempts')
    .select('*')
    .eq('attempt_id', attemptId)
    .maybeSingle();

  if (aErr || !attempt) return { success: false, message: 'Attempt not found.' };
  if (attempt.user_id !== userId) return { success: false, message: 'Not your attempt.' };
  if (attempt.status === 'IN_PROGRESS') return { success: false, message: 'Attempt is still in progress.' };

  // 2. Fetch quiz
  const quiz = await getTeacherQuiz(attempt.teacher_quiz_id);
  if (!quiz) return { success: false, message: 'Quiz not found.' };

  // 3. Fetch class membership for "My Details"
  const { data: member } = await db
    .from('teacher_class_members')
    .select('display_name, email, member_fields_json')
    .eq('user_id', userId)
    .eq('class_id', attempt.class_id)
    .maybeSingle();

  const { data: cls } = await db
    .from('teacher_classes')
    .select('title, custom_fields_json')
    .eq('class_id', attempt.class_id)
    .maybeSingle();

  // Fetch the class link for effective window + per-class release state
  const { data: link } = await db
    .from('teacher_quiz_classes')
    .select('open_at, close_at, results_released, results_released_at')
    .eq('teacher_quiz_id', attempt.teacher_quiz_id)
    .eq('class_id', attempt.class_id)
    .maybeSingle();

  const { open_at: effOpenAt, close_at: effCloseAt } = _effectiveQuizWindow(quiz, link);

  // 4. Compute results gate (link-level release is a universal override)
  const now = new Date();
  const policy = quiz.results_release_policy || 'MANUAL';
  let gateMet = false;
  let gateReason = '';
  let availableAt = null;

  if (link?.results_released) {
    // Explicit teacher override — always visible regardless of policy
    gateMet = true;
    availableAt = link.results_released_at;
  } else if (policy === 'IMMEDIATE') {
    gateMet = true;
  } else if (policy === 'AFTER_CLOSE') {
    if (!effCloseAt) {
      gateReason = 'MISSING_CLOSE_AT';
    } else if (new Date(effCloseAt) > now) {
      gateReason = 'QUIZ_NOT_CLOSED';
      availableAt = effCloseAt;
    } else {
      gateMet = true;
      availableAt = effCloseAt;
    }
  } else {
    // MANUAL — no automatic release
    gateReason = 'RESULTS_NOT_RELEASED';
  }

  // 5. Compute display score (respecting policy)
  const showResults = quiz.show_results !== false;
  const scorePolicy = attempt.score_display_policy || quiz.score_display_policy || 'RAW_AND_PCT';
  let displayScore = null;
  let gradeLabel = null;
  let passStatus = null;

  if (gateMet && showResults && attempt.score_pct != null) {
    displayScore = {};
    if (scorePolicy === 'RAW_AND_PCT' || scorePolicy === 'RAW_ONLY') {
      displayScore.score_marks = attempt.score_raw;
      displayScore.total_marks = attempt.score_total;
    }
    if (scorePolicy === 'RAW_AND_PCT' || scorePolicy === 'PCT_ONLY') {
      displayScore.percent = attempt.score_pct;
    }
    // HIDE: displayScore stays null
    if (scorePolicy === 'HIDE') displayScore = null;

    // Grade label
    gradeLabel = _gradeLabelFromBands(
      attempt.grade_bands_json || quiz.grade_bands_json,
      attempt.score_pct
    );

    // Pass/fail — prefer attempt snapshot (score_json), fall back to live quiz
    const scoreSnap = attempt.score_json || {};
    const threshold = scoreSnap.pass_threshold_pct ?? quiz.pass_threshold_pct ?? 50;
    passStatus = attempt.score_pct >= threshold ? 'PASS' : 'FAIL';
  }

  // Even if score hidden, grade may still show
  if (gateMet && showResults && scorePolicy === 'HIDE' && attempt.score_pct != null) {
    gradeLabel = _gradeLabelFromBands(
      attempt.grade_bands_json || quiz.grade_bands_json,
      attempt.score_pct
    );
  }

  // 6. Review availability
  const canReviewNow = gateMet && quiz.show_review;

  // 7. Build "My Details"
  let classFields = [];
  let classValues = {};
  try {
    const cf = typeof cls?.custom_fields_json === 'object' ? cls.custom_fields_json : JSON.parse(cls?.custom_fields_json || '[]');
    classFields = Array.isArray(cf) ? cf : (Array.isArray(cf.fields) ? cf.fields : []);
  } catch(err) {
    console.warn('[myteacher-api] getAttemptResults — failed to parse class custom_fields_json:', err.message);
  }
  try {
    const mf = typeof member?.member_fields_json === 'object' ? member.member_fields_json : JSON.parse(member?.member_fields_json || '{}');
    classValues = (mf && typeof mf === 'object' && !Array.isArray(mf)) ? mf : (mf?.fields || {});
  } catch(err) {
    console.warn('[myteacher-api] getAttemptResults — failed to parse member_fields_json:', err.message);
  }

  let candidateFields = {};
  try {
    const cf = typeof attempt.candidate_fields_json === 'object' ? attempt.candidate_fields_json : JSON.parse(attempt.candidate_fields_json || '{}');
    candidateFields = cf.fields || cf || {};
  } catch(err) {
    console.warn('[myteacher-api] getAttemptResults — failed to parse candidate_fields_json:', err.message);
  }

  // Quiz custom fields schema — ensure all fields have keys
  let quizFieldsSchema = [];
  try {
    const qf = typeof quiz.custom_fields_json === 'object' ? quiz.custom_fields_json : JSON.parse(quiz.custom_fields_json || '{}');
    const raw = Array.isArray(qf.fields) ? qf.fields : [];
    const usedK = {};
    quizFieldsSchema = raw.map(f => {
      if (f.key) { usedK[f.key] = true; return f; }
      const key = normaliseFieldKey(f.label, usedK);
      usedK[key] = true;
      return { ...f, key };
    });
  } catch(err) {
    console.warn('[myteacher-api] getAttemptResults — failed to parse quiz custom_fields_json:', err.message);
  }

  return {
    success: true,
    quiz_meta: {
      title: quiz.title,
      subject: quiz.subject,
      preset: quiz.preset,
      duration_minutes: quiz.duration_minutes,
      max_attempts: quiz.max_attempts,
      show_review: quiz.show_review,
      show_results: quiz.show_results,
      results_release_policy: policy,
      score_display_policy: scorePolicy,
      pass_threshold_pct: (attempt.score_json || {}).pass_threshold_pct ?? quiz.pass_threshold_pct,
      open_at: effOpenAt,
      close_at: effCloseAt
    },
    attempt_meta: {
      attempt_id: attempt.attempt_id,
      attempt_no: attempt.attempt_no,
      status: attempt.status,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      time_taken_s: attempt.time_taken_s,
      mode: attempt.mode
    },
    gate_met: gateMet,
    gate_reason: gateReason,
    available_at: availableAt,
    show_results: showResults,
    can_review_now: canReviewNow,
    display_score: displayScore,
    grade_label: gradeLabel,
    pass_status: passStatus,
    my_details: {
      class_profile: {
        class_title: cls?.title || '',
        display_name: member?.display_name || '',
        email: member?.email || '',
        fields: classFields,
        values: classValues
      },
      attempt_submitted: {
        fields: quizFieldsSchema,
        values: candidateFields
      }
    }
  };
}


// ------------------------------------------------------------
// GET ATTEMPT REVIEW (Student)
// Returns all questions with student's answers, correct answers,
// option feedback, and rationale — for read-only review.
// Gated: only returns if show_review + gate met.
// Used by: myteacher/student/my-results.html — Review tab
// ------------------------------------------------------------
async function getAttemptReview(attemptId, userId) {
  // 1. Fetch attempt
  const { data: attempt, error: aErr } = await db
    .from('teacher_quiz_attempts')
    .select('*')
    .eq('attempt_id', attemptId)
    .maybeSingle();

  if (aErr || !attempt) return { success: false, message: 'Attempt not found.' };
  if (attempt.user_id !== userId) return { success: false, message: 'Not your attempt.' };
  if (attempt.status === 'IN_PROGRESS') return { success: false, message: 'Attempt still in progress.' };

  // 2. Fetch quiz
  const quiz = await getTeacherQuiz(attempt.teacher_quiz_id);
  if (!quiz) return { success: false, message: 'Quiz not found.' };

  // 3. Check review gate
  if (!quiz.show_review) {
    return { success: false, code: 'REVIEW_DISABLED', message: 'Review is not enabled for this quiz.' };
  }

  // Fetch the class link for effective window + per-class release state
  const { data: link } = await db
    .from('teacher_quiz_classes')
    .select('open_at, close_at, results_released, results_released_at')
    .eq('teacher_quiz_id', attempt.teacher_quiz_id)
    .eq('class_id', attempt.class_id)
    .maybeSingle();

  const { close_at: effCloseAt } = _effectiveQuizWindow(quiz, link);

  // Check release gate (link-level release is a universal override)
  const now = new Date();
  const policy = quiz.results_release_policy || 'MANUAL';
  let gateMet = false;
  if (link?.results_released)         gateMet = true;
  else if (policy === 'IMMEDIATE')    gateMet = true;
  else if (policy === 'AFTER_CLOSE')  gateMet = effCloseAt && new Date(effCloseAt) <= now;
  // MANUAL without override → gate not met

  if (!gateMet) {
    return { success: false, code: 'RESULTS_NOT_RELEASED', message: 'Results have not been released yet. Review will be available when results are released.' };
  }

  // 4. Fetch snapshot items
  const { data: snapItems, error: sErr } = await db
    .from('teacher_quiz_items')
    .select('*')
    .eq('teacher_quiz_id', attempt.teacher_quiz_id)
    .order('position', { ascending: true });

  if (sErr) return { success: false, message: 'Could not load quiz items.' };

  const snapMap = new Map((snapItems || []).map(s => [s.quiz_item_id, s]));

  // 5. Build review questions
  const attemptItems = attempt.items_json || [];
  const answers = attempt.answers_json || {};

  const questions = attemptItems.map(item => {
    const snap = snapMap.get(item.quiz_item_id);
    if (!snap) return null;

    const qType = snap.snap_question_type || 'MCQ';
    const isSATA = qType === 'SATA';
    const correctOrig = snap.snap_correct || '';

    // Build options array in display order
    const displayLetters = Object.keys(item.opt_map || {}).sort();
    const options = [];

    if (qType === 'TF') {
      options.push({ key: 'A', text: 'True', feedback: snap.snap_fb_a || '' });
      options.push({ key: 'B', text: 'False', feedback: snap.snap_fb_b || '' });
    } else {
      displayLetters.forEach(dl => {
        const orig = item.opt_map[dl];
        const text = snap['snap_option_' + orig.toLowerCase()] || '';
        if (!text) return;
        options.push({
          key: dl,
          orig_key: orig,
          text: text,
          feedback: snap['snap_fb_' + orig.toLowerCase()] || ''
        });
      });
    }

    // Determine student's answer
    const studentAnswer = answers[item.quiz_item_id];

    // Determine correct display key(s) by reversing opt_map
    const reverseMap = {};
    Object.entries(item.opt_map || {}).forEach(([display, orig]) => { reverseMap[orig] = display; });

    let correctDisplayKeys = [];
    if (isSATA) {
      correctDisplayKeys = correctOrig.split(',').map(s => s.trim()).filter(Boolean).map(orig => reverseMap[orig] || orig);
    } else {
      correctDisplayKeys = [reverseMap[correctOrig] || correctOrig];
    }

    // Determine student display keys
    let studentDisplayKeys = [];
    if (isSATA) {
      if (Array.isArray(studentAnswer)) studentDisplayKeys = studentAnswer;
      else if (typeof studentAnswer === 'string' && studentAnswer) studentDisplayKeys = studentAnswer.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      if (studentAnswer) studentDisplayKeys = [studentAnswer];
    }

    // Is correct?
    let isCorrect = false;
    if (isSATA) {
      // Reverse student answers to original
      const studentOrigSet = new Set(studentDisplayKeys.map(dl => item.opt_map[dl] || dl));
      const correctSet = new Set(correctOrig.split(',').map(s => s.trim()).filter(Boolean));
      isCorrect = studentOrigSet.size === correctSet.size && [...studentOrigSet].every(l => correctSet.has(l));
    } else {
      const studentOrig = item.opt_map[studentAnswer] || studentAnswer;
      isCorrect = studentOrig === correctOrig;
    }

    return {
      quiz_item_id: item.quiz_item_id,
      position: item.position,
      marks: item.marks || 1,
      question_type: qType,
      stem: snap.snap_stem,
      subject: snap.snap_subject,
      maintopic: snap.snap_maintopic,
      subtopic: snap.snap_subtopic,
      difficulty: snap.snap_difficulty,
      rationale: snap.snap_rationale,
      rationale_img: snap.snap_rationale_img,
      options: options,
      student_answer: studentDisplayKeys,
      correct_answer: correctDisplayKeys,
      is_correct: isCorrect
    };
  }).filter(Boolean);

  // Score summary (if visible)
  const scorePolicy = attempt.score_display_policy || quiz.score_display_policy || 'RAW_AND_PCT';
  let displayScore = null;
  if (quiz.show_results !== false && attempt.score_pct != null && scorePolicy !== 'HIDE') {
    displayScore = {};
    if (scorePolicy === 'RAW_AND_PCT' || scorePolicy === 'RAW_ONLY') {
      displayScore.score_marks = attempt.score_raw;
      displayScore.total_marks = attempt.score_total;
    }
    if (scorePolicy === 'RAW_AND_PCT' || scorePolicy === 'PCT_ONLY') {
      displayScore.percent = attempt.score_pct;
    }
  }

  return {
    success: true,
    review_allowed: true,
    display_score: displayScore,
    grade_label: _gradeLabelFromBands(attempt.grade_bands_json || quiz.grade_bands_json, attempt.score_pct),
    pass_status: attempt.score_pct != null ? (attempt.score_pct >= ((attempt.score_json || {}).pass_threshold_pct ?? quiz.pass_threshold_pct ?? 50) ? 'PASS' : 'FAIL') : null,
    questions: questions
  };
}


// ============================================================
// TEACHER RESULTS — Slice 9
// ============================================================


// ------------------------------------------------------------
// HEADLINE RULE
// Determines which attempt is the "headline" for marksheet display.
// EXAM/IN_CLASS → FIRST submitted, ASSIGNMENT/STUDY → BEST score
// ------------------------------------------------------------
function _headlineRule(preset) {
  const p = (preset || '').toUpperCase();
  if (p === 'EXAM' || p === 'IN_CLASS') return 'FIRST';
  if (p === 'STUDY') return 'BEST';
  return 'BEST'; // default for ASSIGNMENT and custom
}

function _pickHeadlineAttempt(attempts, rule) {
  const submitted = attempts.filter(a => a.status === 'SUBMITTED' || a.status === 'TIMED_OUT');
  if (!submitted.length) return null;
  if (rule === 'FIRST') {
    return submitted.reduce((a, b) => new Date(a.started_at) < new Date(b.started_at) ? a : b);
  }
  // BEST — highest score_pct
  return submitted.reduce((a, b) => (b.score_pct || 0) > (a.score_pct || 0) ? b : a);
}


// ------------------------------------------------------------
// GET TEACHER RESULTS SUMMARY
// Returns aggregate stats for a quiz+class combination.
// Used by: results.html — summary stat cards
// ------------------------------------------------------------
async function getTeacherResultsSummary(quizId, classId, opts = {}) {
  const quiz = await getTeacherQuiz(quizId);
  if (!quiz) return { success: false, message: 'Quiz not found.' };

  // Get class members
  const memberFilter = opts.includeRemoved ? {} : { status: 'ACTIVE' };
  let memberQuery = db.from('teacher_class_members')
    .select('user_id, display_name, status')
    .eq('class_id', classId);
  if (!opts.includeRemoved) memberQuery = memberQuery.eq('status', 'ACTIVE');
  const { data: members, error: mErr } = await memberQuery;
  if (mErr) return { success: false, message: mErr.message };

  const rosterTotal = (members || []).length;
  const memberIds = (members || []).map(m => m.user_id);

  // Get all attempts for this quiz+class
  let attQuery = db.from('teacher_quiz_attempts')
    .select('attempt_id, user_id, status, score_raw, score_total, score_pct, time_taken_s, submitted_at, started_at, attempt_no')
    .eq('teacher_quiz_id', quizId)
    .eq('class_id', classId)
    .neq('status', 'ABANDONED');

  if (opts.dateFrom) attQuery = attQuery.gte('started_at', opts.dateFrom);
  if (opts.dateTo) attQuery = attQuery.lte('started_at', opts.dateTo);

  const { data: attempts, error: aErr } = await attQuery;
  if (aErr) return { success: false, message: aErr.message };

  const allAttempts = attempts || [];
  const headlineRule = _headlineRule(quiz.preset);

  // Group by user, pick headline
  const byUser = {};
  allAttempts.forEach(a => {
    if (!byUser[a.user_id]) byUser[a.user_id] = [];
    byUser[a.user_id].push(a);
  });

  let submittedCount = 0;
  let inProgressCount = 0;
  const scores = [];
  const times = [];

  memberIds.forEach(uid => {
    const userAttempts = byUser[uid] || [];
    if (!userAttempts.length) return; // not started
    const hasSubmitted = userAttempts.some(a => a.status === 'SUBMITTED' || a.status === 'TIMED_OUT');
    const hasInProgress = userAttempts.some(a => a.status === 'IN_PROGRESS');
    if (hasSubmitted) {
      submittedCount++;
      const headline = _pickHeadlineAttempt(userAttempts, headlineRule);
      if (headline && headline.score_pct != null) scores.push(headline.score_pct);
      if (headline && headline.time_taken_s) times.push(headline.time_taken_s);
    } else if (hasInProgress) {
      inProgressCount++;
    }
  });

  const notStartedCount = rosterTotal - submittedCount - inProgressCount;
  const avgPct = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100 : null;
  const medianPct = scores.length ? _median(scores) : null;
  const threshold = quiz.pass_threshold_pct ?? 50;
  const passCount = scores.filter(s => s >= threshold).length;
  const passRate = scores.length ? Math.round(passCount / scores.length * 10000) / 100 : null;
  const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

  // Grade distribution
  const gradeDist = {};
  scores.forEach(pct => {
    const label = _gradeLabelFromBands(quiz.grade_bands_json, pct) || 'Ungraded';
    gradeDist[label] = (gradeDist[label] || 0) + 1;
  });

  return {
    success: true,
    headline_rule: headlineRule,
    roster_total: rosterTotal,
    submitted_count: submittedCount,
    in_progress_count: inProgressCount,
    not_started_count: notStartedCount,
    avg_pct: avgPct,
    median_pct: medianPct,
    pass_threshold_pct: threshold,
    pass_rate_pct: passRate,
    pass_count: passCount,
    avg_time_s: avgTime,
    grade_distribution: gradeDist,
    score_display_policy: quiz.score_display_policy || 'RAW_AND_PCT'
  };
}

function _median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2 * 100) / 100;
}


// ------------------------------------------------------------
// GET TEACHER RESULTS MARKSHEET
// Returns per-student rows with headline attempt for a quiz+class.
// Used by: results.html — marksheet tab
// ------------------------------------------------------------
async function getTeacherResultsMarksheet(quizId, classId, opts = {}) {
  const quiz = await getTeacherQuiz(quizId);
  if (!quiz) return { success: false, message: 'Quiz not found.' };

  // Get class with custom fields schema
  const { data: cls } = await db.from('teacher_classes')
    .select('class_id, title, custom_fields_json')
    .eq('class_id', classId).maybeSingle();

  // Get members
  let memberQuery = db.from('teacher_class_members')
    .select('user_id, display_name, email, member_fields_json, status')
    .eq('class_id', classId);
  if (!opts.includeRemoved) memberQuery = memberQuery.eq('status', 'ACTIVE');
  const { data: members, error: mErr } = await memberQuery;
  if (mErr) return { success: false, message: mErr.message };

  // Batch-fetch avatar URLs from users table
  const memberIds = (members || []).map(m => m.user_id).filter(Boolean);
  const avatarMap = {};
  if (memberIds.length) {
    const { data: avatarRows } = await db.from('users').select('user_id, avatar_url').in('user_id', memberIds);
    (avatarRows || []).forEach(u => { if (u.avatar_url) avatarMap[u.user_id] = u.avatar_url; });
  }

  // Get all attempts
  let attQuery = db.from('teacher_quiz_attempts')
    .select('attempt_id, user_id, status, score_raw, score_total, score_pct, time_taken_s, submitted_at, started_at, attempt_no, candidate_fields_json, grade_bands_json, score_display_policy, score_json')
    .eq('teacher_quiz_id', quizId)
    .eq('class_id', classId)
    .neq('status', 'ABANDONED');
  if (opts.dateFrom) attQuery = attQuery.gte('started_at', opts.dateFrom);
  if (opts.dateTo) attQuery = attQuery.lte('started_at', opts.dateTo);
  const { data: attempts } = await attQuery;

  const headlineRule = _headlineRule(quiz.preset);
  const threshold = quiz.pass_threshold_pct ?? 50;

  // Group attempts by user
  const byUser = {};
  (attempts || []).forEach(a => {
    if (!byUser[a.user_id]) byUser[a.user_id] = [];
    byUser[a.user_id].push(a);
  });

  // Parse field schemas
  let classFields = [];
  try {
    const cf = typeof cls?.custom_fields_json === 'object' ? cls.custom_fields_json : JSON.parse(cls?.custom_fields_json || '[]');
    classFields = Array.isArray(cf) ? cf : (Array.isArray(cf.fields) ? cf.fields : []);
  } catch(err) {
    console.warn('[myteacher-api] getTeacherResultsMarksheet — failed to parse class custom_fields_json:', err.message);
  }

  let quizFields = [];
  try {
    const qf = typeof quiz.custom_fields_json === 'object' ? quiz.custom_fields_json : JSON.parse(quiz.custom_fields_json || '{}');
    const rawQF = Array.isArray(qf.fields) ? qf.fields : [];
    const usedQK = {};
    quizFields = rawQF.map(f => {
      if (f.key) { usedQK[f.key] = true; return f; }
      const key = normaliseFieldKey(f.label, usedQK);
      usedQK[key] = true;
      return { ...f, key };
    });
  } catch(err) {
    console.warn('[myteacher-api] getTeacherResultsMarksheet — failed to parse quiz custom_fields_json:', err.message);
  }

  // Build rows
  const rows = (members || []).map(m => {
    const userAttempts = byUser[m.user_id] || [];
    const totalAttempts = userAttempts.length;
    const headline = _pickHeadlineAttempt(userAttempts, headlineRule);
    const hasInProgress = userAttempts.some(a => a.status === 'IN_PROGRESS');

    let status = 'NOT_STARTED';
    if (headline) status = headline.status;
    else if (hasInProgress) status = 'IN_PROGRESS';

    // Parse member fields
    let memberValues = {};
    try {
      const mf = typeof m.member_fields_json === 'object' ? m.member_fields_json : JSON.parse(m.member_fields_json || '{}');
      memberValues = (mf && typeof mf === 'object' && !Array.isArray(mf)) ? mf : (mf?.fields || {});
    } catch(err) {
      console.warn('[myteacher-api] getTeacherResultsMarksheet — failed to parse member_fields_json (map loop):', err.message);
    }

    // Parse quiz candidate fields from headline attempt
    let candidateValues = {};
    if (headline) {
      try {
        const cf = typeof headline.candidate_fields_json === 'object' ? headline.candidate_fields_json : JSON.parse(headline.candidate_fields_json || '{}');
        candidateValues = cf.fields || cf || {};
      } catch(err) {
        console.warn('[myteacher-api] getTeacherResultsMarksheet — failed to parse candidate_fields_json (map loop):', err.message);
      }
    }

    const gradeBands = headline?.grade_bands_json || quiz.grade_bands_json;
    const gradeLabel = headline ? _gradeLabelFromBands(gradeBands, headline.score_pct) : null;
    const passThresh = (headline?.score_json || {}).pass_threshold_pct ?? threshold;
    const passFail = headline && headline.score_pct != null ? (headline.score_pct >= passThresh ? 'PASS' : 'FAIL') : null;

    return {
      user_id: m.user_id,
      display_name: m.display_name || m.email || m.user_id,
      email: m.email,
      avatar_url: avatarMap[m.user_id] || null,
      member_status: m.status,
      member_fields: memberValues,
      candidate_fields: candidateValues,
      status,
      attempts_used: totalAttempts,
      headline_attempt_id: headline?.attempt_id || null,
      score_raw: headline?.score_raw ?? null,
      score_total: headline?.score_total ?? null,
      score_pct: headline?.score_pct ?? null,
      time_taken_s: headline?.time_taken_s ?? null,
      grade_label: gradeLabel,
      pass_fail: passFail,
      submitted_at: headline?.submitted_at || null,
      attempt_no: headline?.attempt_no ?? null
    };
  });

  // Sort
  const sort = opts.sort || 'name_asc';
  rows.sort((a, b) => {
    if (sort === 'score_desc') return (b.score_pct ?? -1) - (a.score_pct ?? -1);
    if (sort === 'score_asc') return (a.score_pct ?? -1) - (b.score_pct ?? -1);
    if (sort === 'status_asc') return (a.status || '').localeCompare(b.status || '');
    return (a.display_name || '').localeCompare(b.display_name || '');
  });

  // Filter by status
  let filtered = rows;
  if (opts.statusFilter && opts.statusFilter !== 'ALL') {
    filtered = rows.filter(r => r.status === opts.statusFilter);
  }

  return {
    success: true,
    headline_rule: headlineRule,
    quiz_title: quiz.title,
    quiz_preset: quiz.preset,
    class_title: cls?.title || '',
    class_fields: classFields,
    quiz_fields: quizFields,
    score_display_policy: quiz.score_display_policy || 'RAW_AND_PCT',
    pass_threshold_pct: threshold,
    rows: filtered,
    total: rows.length
  };
}


// ------------------------------------------------------------
// GET TEACHER RESULTS ITEM ANALYSIS
// Per-question stats for a quiz+class combination.
// Used by: results.html — item analysis tab
// ------------------------------------------------------------
async function getTeacherResultsItemAnalysis(quizId, classId, opts = {}) {
  const quiz = await getTeacherQuiz(quizId);
  if (!quiz) return { success: false, message: 'Quiz not found.' };

  // Get snapshot items
  const { data: snapItems, error: sErr } = await db.from('teacher_quiz_items')
    .select('*')
    .eq('teacher_quiz_id', quizId)
    .order('position');
  if (sErr) return { success: false, message: sErr.message };
  if (!snapItems?.length) return { success: false, message: 'No published items.' };

  // Get all submitted attempts
  let attQuery = db.from('teacher_quiz_attempts')
    .select('attempt_id, items_json, answers_json, status')
    .eq('teacher_quiz_id', quizId)
    .eq('class_id', classId)
    .in('status', ['SUBMITTED', 'TIMED_OUT']);
  const { data: attempts } = await attQuery;

  const totalAttempts = (attempts || []).length;
  const snapMap = new Map(snapItems.map(s => [s.quiz_item_id, s]));

  // Build per-item stats
  const itemStats = snapItems.map(snap => {
    const qid = snap.quiz_item_id;
    let correctCount = 0, wrongCount = 0, blankCount = 0;
    const optionCounts = {};
    const letters = ['A','B','C','D','E','F'];
    letters.forEach(l => { if (snap['snap_option_' + l.toLowerCase()]) optionCounts[l] = 0; });

    (attempts || []).forEach(att => {
      const items = att.items_json || [];
      const answers = att.answers_json || {};
      const itemEntry = items.find(i => i.quiz_item_id === qid);
      if (!itemEntry) return;

      const studentAnswer = answers[qid];
      const qType = snap.snap_question_type || 'MCQ';
      const correctSet = new Set((snap.snap_correct || '').split(',').map(s => s.trim()).filter(Boolean));

      if (qType === 'SATA') {
        const studentArr = Array.isArray(studentAnswer) ? studentAnswer :
          (typeof studentAnswer === 'string' ? studentAnswer.split(',').map(s => s.trim()).filter(Boolean) : []);
        if (!studentArr.length) { blankCount++; return; }

        // Map back through opt_map
        const origSet = new Set();
        studentArr.forEach(dl => {
          const orig = itemEntry.opt_map ? itemEntry.opt_map[dl] : dl;
          if (orig) origSet.add(orig);
        });

        // Count each option
        origSet.forEach(l => { if (optionCounts[l] !== undefined) optionCounts[l]++; });

        const isCorrect = origSet.size === correctSet.size && [...origSet].every(l => correctSet.has(l));
        if (isCorrect) correctCount++; else wrongCount++;
      } else {
        // MCQ / TF
        const chosen = typeof studentAnswer === 'string' ? studentAnswer.trim() : '';
        if (!chosen) { blankCount++; return; }

        const origChosen = itemEntry.opt_map ? (itemEntry.opt_map[chosen] || chosen) : chosen;
        if (optionCounts[origChosen] !== undefined) optionCounts[origChosen]++;

        if (origChosen === snap.snap_correct) correctCount++; else wrongCount++;
      }
    });

    const attCount = correctCount + wrongCount + blankCount;
    const pctCorrect = attCount > 0 ? Math.round(correctCount / attCount * 10000) / 100 : 0;

    // Find common wrong distractor
    let commonDistractor = null;
    let maxWrong = 0;
    const correctLetters = new Set((snap.snap_correct || '').split(',').map(s => s.trim()));
    Object.entries(optionCounts).forEach(([letter, count]) => {
      if (!correctLetters.has(letter) && count > maxWrong) {
        maxWrong = count;
        commonDistractor = { letter, count, pct: attCount > 0 ? Math.round(count / attCount * 100) : 0 };
      }
    });

    // Flags
    const flags = [];
    if (pctCorrect >= 95 && attCount >= 5) flags.push('TOO_EASY');
    if (pctCorrect <= 20 && attCount >= 5) flags.push('TOO_HARD');
    if (attCount > 0 && blankCount / attCount >= 0.25) flags.push('HIGH_BLANKS');
    if (commonDistractor && commonDistractor.pct > 40 && commonDistractor.pct > pctCorrect) flags.push('DISTRACTOR_DOMINANT');

    return {
      quiz_item_id: qid,
      position: snap.position,
      question_type: snap.snap_question_type || 'MCQ',
      stem_preview: (snap.snap_stem || '').substring(0, 120),
      topic: snap.snap_maintopic || snap.snap_subtopic || '',
      marks: snap.snap_marks || 1,
      correct_answer: snap.snap_correct,
      attempts: attCount,
      correct_count: correctCount,
      wrong_count: wrongCount,
      blank_count: blankCount,
      pct_correct: pctCorrect,
      option_counts: optionCounts,
      common_distractor: commonDistractor,
      flags
    };
  });

  return {
    success: true,
    total_attempts: totalAttempts,
    items: itemStats
  };
}


// ------------------------------------------------------------
// GET STUDENT ATTEMPTS FOR TEACHER
// Returns all attempts for a specific student on a quiz+class.
// Used by: results.html — attempts drawer
// ------------------------------------------------------------
async function getStudentAttemptsForTeacher(quizId, classId, studentUserId) {
  const { data, error } = await db.from('teacher_quiz_attempts')
    .select('attempt_id, attempt_no, status, score_raw, score_total, score_pct, time_taken_s, submitted_at, started_at, candidate_fields_json, grade_bands_json, score_json')
    .eq('teacher_quiz_id', quizId)
    .eq('class_id', classId)
    .eq('user_id', studentUserId)
    .neq('status', 'ABANDONED')
    .order('attempt_no');

  if (error) return { success: false, message: error.message };
  return { success: true, attempts: data || [] };
}


// ------------------------------------------------------------
// GET ATTEMPT DETAIL FOR TEACHER
// Returns full attempt with answer review for teacher viewing.
// Unlike getAttemptReview, no ownership check — teacher access.
// Used by: results.html — view attempt drawer
// ------------------------------------------------------------
async function getAttemptDetailForTeacher(attemptId) {
  const { data: attempt, error: aErr } = await db.from('teacher_quiz_attempts')
    .select('*')
    .eq('attempt_id', attemptId)
    .maybeSingle();

  if (aErr || !attempt) return { success: false, message: 'Attempt not found.' };

  const quiz = await getTeacherQuiz(attempt.teacher_quiz_id);
  if (!quiz) return { success: false, message: 'Quiz not found.' };

  const { data: snapItems } = await db.from('teacher_quiz_items')
    .select('*')
    .eq('teacher_quiz_id', attempt.teacher_quiz_id)
    .order('position');

  const snapMap = new Map((snapItems || []).map(s => [s.quiz_item_id, s]));
  const attemptItems = attempt.items_json || [];
  const answers = attempt.answers_json || {};

  const questions = attemptItems.map((item, idx) => {
    const snap = snapMap.get(item.quiz_item_id);
    if (!snap) return null;
    const qType = snap.snap_question_type || 'MCQ';
    const studentAnswer = answers[item.quiz_item_id];

    // Build options with original letters
    const optMap = item.opt_map || {};
    const reverseMap = {};
    Object.entries(optMap).forEach(([display, orig]) => { reverseMap[orig] = display; });

    const options = [];
    ['A','B','C','D','E','F'].forEach(letter => {
      const text = snap['snap_option_' + letter.toLowerCase()];
      if (!text) return;
      options.push({
        letter,
        text,
        feedback: snap['snap_fb_' + letter.toLowerCase()] || null
      });
    });

    // Determine correctness
    const correctSet = new Set((snap.snap_correct || '').split(',').map(s => s.trim()).filter(Boolean));
    let studentOriginal;
    if (qType === 'SATA') {
      const arr = Array.isArray(studentAnswer) ? studentAnswer : (typeof studentAnswer === 'string' ? studentAnswer.split(',').map(s => s.trim()).filter(Boolean) : []);
      studentOriginal = arr.map(dl => optMap[dl] || dl);
    } else {
      const chosen = typeof studentAnswer === 'string' ? studentAnswer.trim() : '';
      studentOriginal = chosen ? [optMap[chosen] || chosen] : [];
    }

    const isCorrect = qType === 'SATA'
      ? studentOriginal.length === correctSet.size && studentOriginal.every(l => correctSet.has(l))
      : studentOriginal.length === 1 && correctSet.has(studentOriginal[0]);

    return {
      position: idx + 1,
      quiz_item_id: item.quiz_item_id,
      question_type: qType,
      stem: snap.snap_stem,
      options,
      correct_answer: snap.snap_correct,
      student_answer: studentOriginal,
      is_correct: isCorrect,
      marks: snap.snap_marks || 1,
      rationale: snap.snap_rationale,
      rationale_img: snap.snap_rationale_img,
      topic: snap.snap_maintopic || '',
      subtopic: snap.snap_subtopic || '',
      difficulty: snap.snap_difficulty || ''
    };
  }).filter(Boolean);

  const gradeLabel = _gradeLabelFromBands(attempt.grade_bands_json || quiz.grade_bands_json, attempt.score_pct);
  const passThresh = (attempt.score_json || {}).pass_threshold_pct ?? quiz.pass_threshold_pct ?? 50;

  return {
    success: true,
    attempt: {
      attempt_id: attempt.attempt_id,
      teacher_quiz_id: attempt.teacher_quiz_id,
      attempt_no: attempt.attempt_no,
      status: attempt.status,
      score_raw: attempt.score_raw,
      score_total: attempt.score_total,
      score_pct: attempt.score_pct,
      time_taken_s: attempt.time_taken_s,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      grade_label: gradeLabel,
      pass_fail: attempt.score_pct != null ? (attempt.score_pct >= passThresh ? 'PASS' : 'FAIL') : null
    },
    questions
  };
}


// ------------------------------------------------------------
// GET QUIZZES FOR CLASS (TEACHER VERSION)
// Returns PUBLISHED quizzes linked to a class — for the scope dropdown.
// Used by: results.html — quiz selector
// ------------------------------------------------------------
async function getClassQuizzesForTeacher(classId, teacherId) {
  const { data: links, error: linkErr } = await db.from('teacher_quiz_classes')
    .select('teacher_quiz_id')
    .eq('class_id', classId)
    .eq('status', 'ACTIVE');

  if (linkErr || !links?.length) return [];

  const quizIds = links.map(l => l.teacher_quiz_id);
  const { data: quizzes, error: qErr } = await db.from('teacher_quizzes')
    .select('teacher_quiz_id, title, preset, status, open_at, close_at')
    .in('teacher_quiz_id', quizIds)
    .eq('teacher_id', teacherId)
    .in('status', ['PUBLISHED', 'ARCHIVED'])
    .order('created_at', { ascending: false });

  if (qErr) return [];
  return quizzes || [];
}


// ============================================================
// LIBRARY (QAcademy shared question bank)
// ============================================================


// ------------------------------------------------------------
// GET LIBRARY COURSES
// Returns all active courses from teacher_library_courses.
// Used by: library.html — course selector
// ------------------------------------------------------------
async function getLibraryCourses() {
  const { data, error } = await db
    .from('teacher_library_courses')
    .select('*')
    .eq('status', 'active')
    .order('title', { ascending: true });

  if (error) { console.error('getLibraryCourses:', error); return []; }
  return data || [];
}


// ------------------------------------------------------------
// GET LIBRARY ITEMS
// Fetches items from a dynamic table name (e.g. 'items_gp').
// Optional filters: { search, maintopic, subtopic, difficulty, question_type }
// Returns { items, count }
// Used by: library.html — items table
// ------------------------------------------------------------
async function getLibraryItems(tableName, { search = '', maintopic = '', subtopic = '', difficulty = '', question_type = '', tag = '', year_level = '', bloom_level = '', limit = 500, offset = 0 } = {}) {
  if (!tableName) return { items: [], count: 0 };

  let query = db
    .from(tableName)
    .select('*', { count: 'exact' });

  if (maintopic)    query = query.eq('maintopic', maintopic);
  if (subtopic)     query = query.eq('subtopic', subtopic);
  if (difficulty)   query = query.eq('difficulty', difficulty);
  if (question_type) query = query.eq('question_type', question_type);
  if (search)       query = query.ilike('stem', `%${search}%`);
  if (tag)          query = query.contains('tags', [tag]);
  if (year_level)   query = query.eq('year_level', year_level);
  if (bloom_level)  query = query.eq('bloom_level', bloom_level);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) { console.error('getLibraryItems:', error); return { items: [], count: 0 }; }
  return { items: data || [], count: count || 0 };
}


// ------------------------------------------------------------
// GET LIBRARY FILTER OPTIONS
// Fetches distinct values for maintopic, subtopic, difficulty
// from a library items table. Used for filter dropdowns.
// ------------------------------------------------------------
async function getLibraryFilterOptions(tableName) {
  if (!tableName) return { maintopics: [], subtopics: [], difficulties: [], tags: [], year_levels: [], bloom_levels: [] };

  // Fetch all items but only the filter columns
  const { data, error } = await db
    .from(tableName)
    .select('maintopic, subtopic, difficulty, tags, year_level, bloom_level');

  if (error) { console.error('getLibraryFilterOptions:', error); return { maintopics: [], subtopics: [], difficulties: [], tags: [], year_levels: [], bloom_levels: [] }; }

  const mt = new Set(), st = new Set(), df = new Set(), tg = new Set(), yl = new Set(), bl = new Set();
  (data || []).forEach(r => {
    if (r.maintopic)  mt.add(r.maintopic);
    if (r.subtopic)   st.add(r.subtopic);
    if (r.difficulty)  df.add(r.difficulty);
    if (r.year_level)  yl.add(r.year_level);
    if (r.bloom_level) bl.add(r.bloom_level);
    (r.tags || []).forEach(t => { if (t) tg.add(t); });
  });

  return {
    maintopics:   [...mt].sort(),
    subtopics:    [...st].sort(),
    difficulties: [...df].sort(),
    tags:         [...tg].sort(),
    year_levels:  [...yl].sort(),
    bloom_levels: [...bl].sort()
  };
}


// ------------------------------------------------------------
// GET LIBRARY ITEM BY ID
// Fetches a single item from a specific library table.
// Used by: preview, publish resolver
// ------------------------------------------------------------
async function getLibraryItem(tableName, itemId) {
  if (!tableName || !itemId) return null;

  const { data, error } = await db
    .from(tableName)
    .select('*')
    .eq('item_id', itemId)
    .maybeSingle();

  if (error) { console.error('getLibraryItem:', error); return null; }
  return data;
}


// ------------------------------------------------------------
// RESOLVE LIBRARY REFS FOR PUBLISH
// Takes an array of LIB refs (e.g. "LIB:GP:GP_001") and
// fetches the actual items from their respective library tables.
// Returns a Map of ref → item data.
// Used by: publishTeacherQuiz
// ------------------------------------------------------------
async function resolveLibraryRefs(libRefs) {
  const result = new Map();
  if (!libRefs || !libRefs.length) return result;

  // Group refs by course_id
  const groups = {};
  libRefs.forEach(ref => {
    const parts = ref.split(':');
    if (parts.length !== 3 || parts[0] !== 'LIB') return;
    const courseId = parts[1];
    const itemId   = parts[2];
    if (!groups[courseId]) groups[courseId] = [];
    groups[courseId].push({ ref, itemId });
  });

  // Fetch courses to get table names
  const courseIds = Object.keys(groups);
  if (!courseIds.length) return result;

  const { data: courses, error } = await db
    .from('teacher_library_courses')
    .select('course_id, items_table')
    .in('course_id', courseIds);

  if (error || !courses) { console.error('resolveLibraryRefs courses:', error); return result; }

  const courseMap = new Map(courses.map(c => [c.course_id, c.items_table]));

  // Fetch items from each table
  for (const courseId of courseIds) {
    const tableName = courseMap.get(courseId);
    if (!tableName) continue;

    const itemIds = groups[courseId].map(g => g.itemId);

    const { data: items, error: itemErr } = await db
      .from(tableName)
      .select('*')
      .in('item_id', itemIds);

    if (itemErr) { console.error(`resolveLibraryRefs ${tableName}:`, itemErr); continue; }

    const itemMap = new Map((items || []).map(i => [i.item_id, i]));
    groups[courseId].forEach(g => {
      const item = itemMap.get(g.itemId);
      if (item) result.set(g.ref, item);
    });
  }

  return result;
}


// ------------------------------------------------------------
// COPY LIBRARY ITEM TO BANK
// Creates a new teacher_bank_items row from a library item,
// optionally with teacher edits applied.
// source_type = 'LIBRARY', source_course_id / source_item_id set for traceability.
// Used by: quizzes.html — when teacher edits a LIB item in draft
// ------------------------------------------------------------
async function copyLibItemToBank(teacherId, courseId, itemId, edits = {}) {
  // 1. Resolve the library item
  const ref = `LIB:${courseId}:${itemId}`;
  const resolved = await resolveLibraryRefs([ref]);
  const libItem = resolved.get(ref);
  if (!libItem) return { success: false, message: 'Library item not found' };

  // 2. Build payload: library item as base, teacher edits on top
  const payload = {
    question_type  : edits.question_type  || libItem.question_type  || 'MCQ',
    stem           : edits.stem           !== undefined ? edits.stem           : libItem.stem,
    option_a       : edits.option_a       !== undefined ? edits.option_a       : libItem.option_a,
    fb_a           : edits.fb_a           !== undefined ? edits.fb_a           : libItem.fb_a,
    option_b       : edits.option_b       !== undefined ? edits.option_b       : libItem.option_b,
    fb_b           : edits.fb_b           !== undefined ? edits.fb_b           : libItem.fb_b,
    option_c       : edits.option_c       !== undefined ? edits.option_c       : libItem.option_c,
    fb_c           : edits.fb_c           !== undefined ? edits.fb_c           : libItem.fb_c,
    option_d       : edits.option_d       !== undefined ? edits.option_d       : libItem.option_d,
    fb_d           : edits.fb_d           !== undefined ? edits.fb_d           : libItem.fb_d,
    option_e       : edits.option_e       !== undefined ? edits.option_e       : libItem.option_e,
    fb_e           : edits.fb_e           !== undefined ? edits.fb_e           : libItem.fb_e,
    option_f       : edits.option_f       !== undefined ? edits.option_f       : libItem.option_f,
    fb_f           : edits.fb_f           !== undefined ? edits.fb_f           : libItem.fb_f,
    correct        : edits.correct        !== undefined ? edits.correct        : libItem.correct,
    rationale      : edits.rationale      !== undefined ? edits.rationale      : libItem.rationale,
    rationale_img  : edits.rationale_img  !== undefined ? edits.rationale_img  : libItem.rationale_img,
    subject        : edits.subject        !== undefined ? edits.subject        : libItem.subject,
    maintopic      : edits.maintopic      !== undefined ? edits.maintopic      : libItem.maintopic,
    subtopic       : edits.subtopic       !== undefined ? edits.subtopic       : libItem.subtopic,
    difficulty     : edits.difficulty      !== undefined ? edits.difficulty     : libItem.difficulty,
    marks          : edits.marks          !== undefined ? edits.marks          : libItem.marks,
    shuffle_options: edits.shuffle_options !== undefined ? edits.shuffle_options : (libItem.shuffle_options !== false),
  };

  // 3. Insert into bank with source tracking
  const now = new Date().toISOString();
  const bankItemId = 'TBANK_' + Date.now();

  const row = {
    bank_item_id   : bankItemId,
    teacher_id     : teacherId,
    status         : 'ACTIVE',
    source_type    : 'LIBRARY',
    source_course_id: courseId,
    source_item_id : itemId,
    created_at     : now,
    updated_at     : now,
    ...payload,
  };

  const { data, error } = await db
    .from('teacher_bank_items')
    .insert(row)
    .select('*')
    .single();

  if (error) { console.error('copyLibItemToBank:', error); return { success: false, message: error.message }; }
  return { success: true, item: data, bankItemId };
}


// ------------------------------------------------------------
// GET DRAFT QUIZZES (for library picker target selector)
// Returns all DRAFT quizzes for a teacher.
// Used by: library.html — target quiz dropdown
// ------------------------------------------------------------
async function getDraftQuizzes(teacherId) {
  const { data, error } = await db
    .from('teacher_quizzes')
    .select('teacher_quiz_id, title, subject, preset, draft_items_json')
    .eq('teacher_id', teacherId)
    .eq('status', 'DRAFT')
    .order('updated_at', { ascending: false });

  if (error) { console.error('getDraftQuizzes:', error); return []; }
  return data || [];
}


// ── Teacher profile ─────────────────────────────────────────

async function getTeacherFullProfile(teacherId) {
  const { data, error } = await db
    .from('teacher_profiles')
    .select('*')
    .eq('teacher_id', teacherId)
    .maybeSingle();

  if (error) { console.error('getTeacherFullProfile:', error); return null; }
  return data;
}

async function updateTeacherProfile(teacherId, fields) {
  const { error } = await db
    .from('teacher_profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('teacher_id', teacherId);

  if (error) { console.error('updateTeacherProfile:', error); return { success: false, message: error.message }; }
  return { success: true };
}


// ── Helper: grade label from bands ──────────────────────────
function _gradeLabelFromBands(bandsJson, pct) {
  if (pct == null) return null;
  let bands = [];
  try {
    const parsed = typeof bandsJson === 'object' ? bandsJson : JSON.parse(bandsJson || '{}');
    bands = Array.isArray(parsed.bands) ? parsed.bands : [];
  } catch(err) {
    console.warn('[myteacher-api] _gradeLabelFromBands — failed to parse grade_bands_json:', err.message);
    return null;
  }

  if (!bands.length) return null;

  // Sort descending by min_pct so we match highest first
  const sorted = [...bands].sort((a, b) => (b.min_pct || 0) - (a.min_pct || 0));
  for (const band of sorted) {
    if (pct >= (band.min_pct || 0)) return band.label || null;
  }
  return sorted[sorted.length - 1]?.label || null;
}


// ── Shared helpers (copied from api.js for myteacher independence) ──

async function getPrograms() {
    const { data, error } = await db
        .from('programs')
        .select('program_id, program_name, trial_product_id')
        .order('program_name');

    if (error) { console.error('getPrograms:', error); return []; }
    return data || [];
}

async function getUserById(userId) {
  const { data: user, error: userError } = await db
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (userError || !user) {
    console.error('getUserById - user not found:', userError);
    return null;
  }

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

  const { data: subscriptionHistory } = await db
    .from('subscriptions')
    .select(`
      *,
      products ( name, kind )
    `)
    .eq('user_id', userId)
    .order('start_utc', { ascending: false });

  return {
    ...user,
    activeSubscription: activeSubscription || null,
    subscriptionHistory: subscriptionHistory || []
  };
}

async function updateUserProfile(userId, fields) {
  const { error } = await db
    .from('users')
    .update(fields)
    .eq('user_id', userId);

  if (error) { console.error('updateUserProfile:', error); return { success: false, message: error.message }; }
  return { success: true };
}

async function uploadProfileImage(userId, file, prefix = 'user') {
  if (!file) return null;

  const MAX_SIZE = 2 * 1024 * 1024;
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


// ============================================================
// Slice 12: Teacher Courses
// ============================================================

function makeCourseId() {
  return 'TCRS_' + Date.now() + '_' + makeSecureId('').slice(0, 8);
}

async function createCourse(teacherId, payload) {
  const now      = new Date().toISOString();
  const courseId  = makeCourseId();

  const row = {
    course_id  : courseId,
    teacher_id : teacherId,
    title      : payload.title,
    status     : 'ACTIVE',
    created_at : now,
    updated_at : now
  };

  if (payload.description) row.description = payload.description;

  const { data, error } = await db
    .from('teacher_courses')
    .insert(row)
    .select()
    .single();

  if (error) { console.error('createCourse:', error); return { success: false, message: error.message }; }
  return { success: true, data };
}

async function getCourses(teacherId, opts = {}) {
  let query = db
    .from('teacher_courses')
    .select('course_id, teacher_id, title, description, status, created_at, updated_at')
    .eq('teacher_id', teacherId)
    .order('title', { ascending: true });

  if (opts.status && opts.status !== 'ALL') {
    query = query.eq('status', opts.status);
  }

  const { data, error } = await query;
  if (error) { console.error('getCourses:', error); return []; }
  return data || [];
}

async function getCourseById(courseId) {
  const { data, error } = await db
    .from('teacher_courses')
    .select('course_id, teacher_id, title, description, status, created_at, updated_at')
    .eq('course_id', courseId)
    .maybeSingle();

  if (error) { console.error('getCourseById:', error); return null; }
  return data;
}

async function updateCourse(courseId, teacherId, patch) {
  const now = new Date().toISOString();

  const { error } = await db
    .from('teacher_courses')
    .update({ ...patch, updated_at: now })
    .eq('course_id', courseId)
    .eq('teacher_id', teacherId);

  if (error) { console.error('updateCourse:', error); return { success: false, message: error.message }; }
  return { success: true };
}

async function archiveCourse(courseId, teacherId, action) {
  const newStatus = action === 'RESTORE' ? 'ACTIVE' : 'ARCHIVED';
  const now       = new Date().toISOString();

  const { error } = await db
    .from('teacher_courses')
    .update({ status: newStatus, updated_at: now })
    .eq('course_id', courseId)
    .eq('teacher_id', teacherId);

  if (error) { console.error('archiveCourse:', error); return { success: false, message: error.message }; }
  return { success: true, newStatus };
}


// ============================================================
// Slice 13: Teacher Programmes
// ============================================================

function makeProgrammeId() {
  return 'TPRG_' + Date.now() + '_' + makeSecureId('').slice(0, 8);
}

async function createProgramme(teacherId, payload) {
  const now         = new Date().toISOString();
  const programmeId = makeProgrammeId();

  const row = {
    programme_id : programmeId,
    teacher_id   : teacherId,
    title        : payload.title,
    status       : 'ACTIVE',
    created_at   : now,
    updated_at   : now
  };

  const { data, error } = await db
    .from('teacher_programmes')
    .insert(row)
    .select()
    .single();

  if (error) { console.error('createProgramme:', error); return { success: false, message: error.message }; }
  return { success: true, data };
}

async function getProgrammes(teacherId, opts = {}) {
  let query = db
    .from('teacher_programmes')
    .select('programme_id, teacher_id, title, status, created_at, updated_at')
    .eq('teacher_id', teacherId)
    .order('title', { ascending: true });

  if (opts.status && opts.status !== 'ALL') {
    query = query.eq('status', opts.status);
  }

  const { data, error } = await query;
  if (error) { console.error('getProgrammes:', error); return []; }
  return data || [];
}

async function updateProgramme(programmeId, teacherId, patch) {
  const now = new Date().toISOString();

  const { error } = await db
    .from('teacher_programmes')
    .update({ ...patch, updated_at: now })
    .eq('programme_id', programmeId)
    .eq('teacher_id', teacherId);

  if (error) { console.error('updateProgramme:', error); return { success: false, message: error.message }; }
  return { success: true };
}

async function archiveProgramme(programmeId, teacherId, action) {
  const newStatus = action === 'RESTORE' ? 'ACTIVE' : 'ARCHIVED';
  const now       = new Date().toISOString();

  const { error } = await db
    .from('teacher_programmes')
    .update({ status: newStatus, updated_at: now })
    .eq('programme_id', programmeId)
    .eq('teacher_id', teacherId);

  if (error) { console.error('archiveProgramme:', error); return { success: false, message: error.message }; }
  return { success: true, newStatus };
}


// ============================================================
// Slice 13: Teacher Cohorts
// ============================================================

function makeCohortId() {
  return 'TCOH_' + Date.now() + '_' + makeSecureId('').slice(0, 8);
}

async function createCohort(teacherId, payload) {
  const now      = new Date().toISOString();
  const cohortId = makeCohortId();

  const row = {
    cohort_id    : cohortId,
    teacher_id   : teacherId,
    programme_id : payload.programme_id,
    title        : payload.title,
    intake_year  : parseInt(payload.intake_year, 10),
    status       : 'ACTIVE',
    created_at   : now,
    updated_at   : now
  };

  const { data, error } = await db
    .from('teacher_cohorts')
    .insert(row)
    .select()
    .single();

  if (error) { console.error('createCohort:', error); return { success: false, message: error.message }; }
  return { success: true, data };
}

async function getCohorts(teacherId, opts = {}) {
  let query = db
    .from('teacher_cohorts')
    .select('cohort_id, teacher_id, programme_id, title, intake_year, status, created_at, updated_at')
    .eq('teacher_id', teacherId)
    .order('intake_year', { ascending: false })
    .order('title', { ascending: true });

  if (opts.status && opts.status !== 'ALL') {
    query = query.eq('status', opts.status);
  }

  if (opts.programme_id) {
    query = query.eq('programme_id', opts.programme_id);
  }

  const { data, error } = await query;
  if (error) { console.error('getCohorts:', error); return []; }
  return data || [];
}

async function updateCohort(cohortId, teacherId, patch) {
  const now = new Date().toISOString();

  // Ensure intake_year is int if present
  const safePatch = { ...patch, updated_at: now };
  if (safePatch.intake_year !== undefined) {
    safePatch.intake_year = parseInt(safePatch.intake_year, 10);
  }

  const { error } = await db
    .from('teacher_cohorts')
    .update(safePatch)
    .eq('cohort_id', cohortId)
    .eq('teacher_id', teacherId);

  if (error) { console.error('updateCohort:', error); return { success: false, message: error.message }; }
  return { success: true };
}

async function archiveCohort(cohortId, teacherId, action) {
  const newStatus = action === 'RESTORE' ? 'ACTIVE' : 'ARCHIVED';
  const now       = new Date().toISOString();

  const { error } = await db
    .from('teacher_cohorts')
    .update({ status: newStatus, updated_at: now })
    .eq('cohort_id', cohortId)
    .eq('teacher_id', teacherId);

  if (error) { console.error('archiveCohort:', error); return { success: false, message: error.message }; }
  return { success: true, newStatus };
}


// ============================================================
// Student Panel: Overview data
// ============================================================

async function getStudentOverview(userId, teacherId) {
  // Fetch class memberships, attempts, and teacher's quizzes in parallel
  // NOTE: user info comes from teacher_class_members (not users table — RLS blocks teacher reading other users)
  const [membersRes, attemptsRes, quizzesRes] = await Promise.all([
    db.from('teacher_class_members')
      .select(`
        class_id, user_id, teacher_id, display_name, email, status, joined_at, member_fields_json,
        teacher_classes (
          class_id, title, status, colour, programme, academic_year, semester,
          cohort_id, custom_fields_json, end_date
        )
      `)
      .eq('user_id', userId)
      .eq('teacher_id', teacherId)
      .order('joined_at', { ascending: false }),
    db.from('teacher_quiz_attempts')
      .select('attempt_id, user_id, teacher_quiz_id, class_id, attempt_no, status, score_raw, score_total, score_pct, time_taken_s, submitted_at, started_at')
      .eq('user_id', userId)
      .eq('teacher_id', teacherId)
      .neq('status', 'ABANDONED')
      .order('submitted_at', { ascending: false }),
    db.from('teacher_quizzes')
      .select('teacher_quiz_id, title, subject, course_id, status')
      .eq('teacher_id', teacherId)
  ]);

  if (membersRes.error) { console.error('getStudentOverview members:', membersRes.error); }
  if (attemptsRes.error) { console.error('getStudentOverview attempts:', attemptsRes.error); }
  if (quizzesRes.error) { console.error('getStudentOverview quizzes:', quizzesRes.error); }

  // Derive user info from the first membership row (teacher can see these fields)
  const members = membersRes.data || [];
  const firstMember = members[0] || null;
  const user = firstMember ? {
    user_id: firstMember.user_id,
    display_name: firstMember.display_name,
    email: firstMember.email
  } : null;

  // Build quiz lookup map (quiz_id → { title, subject, course_id })
  const quizMap = {};
  (quizzesRes.data || []).forEach(q => {
    quizMap[q.teacher_quiz_id] = { title: q.title, subject: q.subject, course_id: q.course_id };
  });

  // Build class lookup map (class_id → class title) from memberships
  const classMap = {};
  members.forEach(m => {
    const cls = m.teacher_classes;
    if (cls) classMap[cls.class_id] = cls.title;
  });

  return {
    user,
    classes: members,
    attempts: attemptsRes.data || [],
    quizMap,
    classMap
  };
}
