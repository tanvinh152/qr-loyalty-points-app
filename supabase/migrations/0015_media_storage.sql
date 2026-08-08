-- The `media` bucket: image storage for rewards, and later the blog.
--
-- Until now `rewards.image_url` (0001) was a bare text column and the admin had
-- to host the picture somewhere else and paste a link. The shop owner has no
-- such somewhere else, so the app needs a bucket of its own.
--
-- Why the bucket is declared HERE and not in supabase/config.toml. That file has
-- a commented-out `[storage.buckets.images]` block which looks like the obvious
-- home, but it is read only by `supabase start` — a hosted project built from
-- `db push` would silently have no bucket at all, and the failure would surface
-- as a 404 on the first upload. A migration runs against both, so the bucket is
-- part of the schema like every other object. The insert is idempotent because
-- `db reset` and a re-run of `db push` must both be no-ops on the second pass.
--
-- ONE bucket with per-feature FOLDERS (`rewards/…`, later `blog/…`) rather than
-- one bucket each: the access rules are identical for both, so a second bucket
-- would only duplicate the two policies below and the public-URL prefix that
-- src/lib/storage.ts parses.
--
-- PUBLIC, not signed URLs. These are catalog photos on a page anyone logged in
-- can see; a signed URL would expire inside the CDN cache and inside any HTML
-- the browser kept, which is a lot of machinery to protect a picture of a dog
-- treat. `image_url` therefore stores the plain public URL and every existing
-- render site keeps working unchanged.
--
-- 5 MiB and a four-format allowlist: the bucket refuses anything else even if a
-- caller reaches it directly, so the checks in src/lib/storage.ts are the
-- friendly error rather than the only line of defence. SVG is deliberately NOT
-- allowed — it is a script container, and these files are served from the
-- project's own origin.

-- ---- bucket ----

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---- policies ----
--
-- Same shape as `rewards` in 0005: public read gated on nothing but the bucket,
-- writes gated on public.is_admin() (0005), which reads the JWT claim
-- app_metadata.role. RLS is already enabled on storage.objects by Supabase —
-- enabling it again here would be a privilege error, not a no-op.
--
-- Note what these policies do NOT protect. The upload path
-- (src/app/admin/media-actions.ts) uses the service-role client, which bypasses
-- RLS entirely, so `admin manage media` is not what keeps a stranger out of the
-- bucket — the explicit admin check inside that Server Action is. The policies
-- exist so anon read is stated rather than implied, and so a future
-- browser-direct upload needs no migration.
--
-- No 0013_grants.sql edit. That file's lesson — a policy without its GRANT is
-- unreachable — is real, but the `storage` schema's grants are owned by
-- supabase_storage_admin and shipped by the platform. Adding them here would
-- fail on ownership.

drop policy if exists "read media" on storage.objects;
create policy "read media"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'media');

drop policy if exists "admin manage media" on storage.objects;
create policy "admin manage media"
  on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());
