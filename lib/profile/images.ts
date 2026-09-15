// lib/profile/images.ts
//
// The profile-photo upload (legacy js/mynmclicensure-api.js
// uploadProfileImage with prefix 'student'): the file is stored as
// `student_<user_id>.<ext>` in the bucket, upsert — one file per student,
// overwritten in place — and its public URL is what goes into
// `avatar_url`. Legacy uploaded from the browser with the anon key; here
// the upload runs on the server with the service role, after
// requireStudent() has already passed (rule #5: the key never reaches
// the browser). The 2 MB limit and the three types are legacy's; the
// bucket enforces the size as well.

import { createServiceRoleClient } from '@/lib/supabase/server';
import { PROFILE_IMAGE_BUCKET, PROFILE_IMAGE_MAX_BYTES, PROFILE_IMAGE_TYPES } from './types';

/** Returns the public URL, or null when the upload failed (legacy: null). */
export async function uploadProfileImage(userId: string, file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > PROFILE_IMAGE_MAX_BYTES) return null;
  if (!(PROFILE_IMAGE_TYPES as readonly string[]).includes(file.type)) return null;

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const fileName = `student_${userId}.${ext}`;
  const storage = createServiceRoleClient().storage.from(PROFILE_IMAGE_BUCKET);

  const { error } = await storage.upload(fileName, file, { upsert: true, contentType: file.type });
  if (error) {
    console.error('uploadProfileImage:', error);
    return null;
  }

  const { data } = storage.getPublicUrl(fileName);
  if (!data?.publicUrl) return null;

  // A version stamp on the saved address (Sam, 2026-09-14): the file is
  // still one per student, overwritten in place, but the storage
  // delivery network and the browser cache the address for an hour, so
  // legacy's plain address kept showing the previous photo. A new stamp
  // per upload is a new address; the old one simply goes unused.
  return `${data.publicUrl}?v=${Date.now()}`;
}
