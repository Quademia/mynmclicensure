-- 20260914233000_profile_images_bucket.sql — slice 7e
--
-- The profile-photo bucket. Legacy uploaded to the project-wide
-- `profile-images` bucket that MyTeacher shares; this product's rule
-- (AGENTS.md #1) is a bucket of its own with the `licensure-gh-` prefix,
-- as the rationale images have. Public, 2 MB (legacy's limit). The
-- upload runs on the server with the service role after the student
-- gate (rule #5), so no storage policy is needed for the browser.

insert into storage.buckets (id, name, public, file_size_limit)
values ('licensure-gh-profile-images', 'licensure-gh-profile-images', true, 2097152)
on conflict (id) do nothing;
