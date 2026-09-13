// lib/bank/images.ts
//
// The rationale-image upload (legacy question-bank.html uploadImage):
// the file is stored as `<item_id>.<ext>` in the bucket, upsert, and its
// public URL is what goes into `rationale_img`. Legacy uploaded from the
// browser with the anon key; here the upload runs on the server with the
// service role, after requireAdmin() has already passed (rule #5: the key
// never reaches the browser). The 2 MB limit is legacy's; the bucket
// enforces it as well.

import { createServiceRoleClient } from '@/lib/supabase/server';
import { RATIONALE_IMAGE_BUCKET, RATIONALE_IMAGE_MAX_BYTES } from './types';

/** Returns the public URL, or null when the upload failed (legacy: null). */
export async function uploadRationaleImage(itemId: string, file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > RATIONALE_IMAGE_MAX_BYTES) return null;

  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${itemId}.${ext}`;
  const storage = createServiceRoleClient().storage.from(RATIONALE_IMAGE_BUCKET);

  const { error } = await storage.upload(fileName, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) {
    console.error('Image upload error:', error);
    return null;
  }

  const { data } = storage.getPublicUrl(fileName);
  return data?.publicUrl || null;
}
