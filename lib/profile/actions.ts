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
  const schoolOther = String(input.school_other || '').trim();

  if (schoolSel === '__OTHER__' && !schoolOther) return fail("Please type your school's name.");

  const school_id = schoolSel === '__OTHER__' ? null : schoolSel ? Number(schoolSel) : null;
  if (school_id !== null && !Number.isFinite(school_id)) return fail('Unknown school.');
  const school_other = schoolSel === '__OTHER__' ? schoolOther : null;

  const { error } = await supabase.from('users').update({ level, cohort, school_id, school_other }).eq('user_id', profile.user_id);
  if (error) {
    console.error('saveAcademicDetails:', error);
    return fail(error.message);
  }
  return { ok: true };
}
