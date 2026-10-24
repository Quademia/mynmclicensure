// lib/profile/actions.ts
//
// The profile page's two writes as Server Actions behind the student
// gate (slice 7e) — legacy savePersonal and saveAcademic on
// student/profile.html called updateUserProfile, a browser update of
// the student's own `users` row, and uploadProfileImage. Each writes
// the signed-in student's own row by user_id; 2a's users_update policy
// (own row, role and active unchanged) is the floor. The checks are
// legacy's, in its order: a first name is required; a typed school
// name is required when "not listed" is chosen; a photo that is not a
// JPG / PNG / WebP under 2 MB fails the whole save with legacy's
// message.

'use server';

import { requireStudent } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { uploadProfileImage } from './images';
import { PROFILE_LEVELS, type AcademicInput, type ActionResult, type PersonalInput, type PersonalResult } from './types';

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

// ── Personal Details (legacy savePersonal) ────────────────────────────
export async function savePersonalDetails(input: PersonalInput, photo: FormData | null): Promise<PersonalResult> {
  const { supabase, profile } = await requireStudent();

  let avatarUrl = profile.avatar_url;
  const file = photo?.get('photo');
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadProfileImage(profile.user_id, file);
    if (!uploaded) return fail('Image must be JPG, PNG, or WebP under 2 MB.');
    avatarUrl = uploaded;
  }

  const forename = String(input.forename || '').trim();
  const surname = String(input.surname || '').trim();
  const phone_number = String(input.phone_number || '').trim();
  if (!forename) return fail('First name is required.');

  const { error } = await supabase
    .from('users')
    .update({
      forename,
      surname,
      name: `${forename} ${surname}`.trim(),
      phone_number,
      avatar_url: avatarUrl,
    })
    .eq('user_id', profile.user_id);
  if (error) {
    console.error('savePersonalDetails:', error);
    return fail(error.message);
  }
  return { ok: true, avatar_url: avatarUrl };
}

// ── Academic Details (legacy saveAcademic) ────────────────────────────
export async function saveAcademicDetails(input: AcademicInput): Promise<ActionResult> {
  const { supabase, profile } = await requireStudent();

  const levelRaw = String(input.level || '');
  const level = (PROFILE_LEVELS as readonly string[]).includes(levelRaw) ? levelRaw : '';
  const cohort = String(input.cohort || '').trim();
  const schoolSel = String(input.school || '');
  const unlisted = String(input.unlisted_school || '').trim();
  const isUnlisted = schoolSel === '__OTHER__';

  if (isUnlisted && (unlisted.length < 3 || unlisted.length > 120)) return fail("Please type your school's name.");

  const school_id = isUnlisted ? null : schoolSel ? Number(schoolSel) : null;
  if (school_id !== null && !Number.isFinite(school_id)) return fail('Unknown school.');

  // a school not listed: the database finds or makes the suggested school
  // and makes it the student's (01)
  if (isUnlisted) {
    const { error: schoolError } = await createServiceRoleClient().rpc('choose_suggested_school', {
      p_user_id: profile.user_id,
      p_name: unlisted,
    });
    if (schoolError) {
      console.error('saveAcademicDetails - school:', schoolError);
      return fail('Could not save your school. Please try again.');
    }
  }

  const fields = isUnlisted ? { level, cohort } : { level, cohort, school_id };
  const { error } = await supabase.from('users').update(fields).eq('user_id', profile.user_id);
  if (error) {
    console.error('saveAcademicDetails:', error);
    return fail(error.message);
  }
  return { ok: true };
}
