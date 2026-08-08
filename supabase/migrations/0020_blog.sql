-- Blog & promotion posts.
--
-- One table for both: "chương trình giảm giá" here is promotional CONTENT
-- (an announcement post), not a transactional coupon/discount-code engine —
-- Pancake's client (src/lib/pancake/client.ts) has no API for that, and
-- building a real one is a separate, larger initiative. `post_type`
-- distinguishes the two so the public site can tab between them while admin
-- edits both through one form.
--
-- Images live in the `media` bucket's `blog` folder, already declared in
-- MEDIA_FOLDERS (src/lib/media.ts) ahead of this feature existing.

create table if not exists public.blog_posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  excerpt          text,
  content          text not null,
  cover_image_url  text,
  post_type        text not null default 'article'
                     check (post_type in ('article', 'promotion')),
  is_published     boolean not null default false,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists blog_posts_published_idx
  on public.blog_posts (post_type, published_at desc)
  where is_published;

alter table public.blog_posts enable row level security;

-- Same posture as rewards/loyalty_settings (0002): public marketing content
-- readable by anon, fully admin-managed by authenticated.
drop policy if exists "anon read published posts" on public.blog_posts;
create policy "anon read published posts"
  on public.blog_posts for select to anon using (is_published);

drop policy if exists "admin manage blog posts" on public.blog_posts;
create policy "admin manage blog posts"
  on public.blog_posts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.blog_posts to anon;
grant select, insert, update, delete on public.blog_posts to authenticated;
