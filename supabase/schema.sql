-- ===========================================================================
--  Sere package registry — Supabase setup
--
--  Paste this whole file into the Supabase SQL editor:
--    Dashboard -> SQL Editor -> New query -> Run
--
--  It is written to be safe to run more than once.
--
--  Creates:
--    public.developers        one row per account (mirrors auth.users)
--    public.api_tokens        hashed publish credentials
--    public.packages          one row per package
--    public.package_versions  one row per published version
--    public.rate_limits       fixed-window request counters
--    public.audit_log         publish and token events
--    storage bucket packages  the .slib / .tar.gz payloads
--    row level security       everyone reads, owners write, tokens stay private
--    consume_rate_limit()     anonymous-safe rate limiter
--    package_download_count() anonymous download counter
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
--  developers
--
--  One row per account. Mirrors auth.users so package and token rows can point
--  at a developer without anything in the auth schema leaking into the app.
-- ---------------------------------------------------------------------------
create table if not exists public.developers (
  id           uuid primary key references auth.users (id) on delete cascade,
  handle       text unique,
  display_name text,
  created_at   timestamptz not null default now(),
  constraint developers_handle_format
    check (handle is null or handle ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$')
);

alter table public.developers enable row level security;

drop policy if exists "developers read their own record" on public.developers;
create policy "developers read their own record"
  on public.developers for select to authenticated
  using (auth.uid() = id);

drop policy if exists "developers create their own record" on public.developers;
create policy "developers create their own record"
  on public.developers for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "developers update their own record" on public.developers;
create policy "developers update their own record"
  on public.developers for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant select, insert, update on public.developers to authenticated;

-- An account row appears the moment Supabase Auth creates the user.
create or replace function public.handle_new_developer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.developers (id, handle, display_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'handle', ''),
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_developer();

-- ---------------------------------------------------------------------------
--  api_tokens
--
--  Publish credentials. Only a SHA-256 hash of the token is stored — the
--  plaintext is shown once at creation and never again. `token_prefix` is the
--  short public part used to find the row without scanning every hash.
-- ---------------------------------------------------------------------------
create table if not exists public.api_tokens (
  id           uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers (id) on delete cascade,
  label        text not null default 'default',
  token_prefix text not null,
  token_hash   text not null unique,
  scope        text not null default 'publish' check (scope in ('publish')),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  constraint api_tokens_label_length check (char_length(label) between 1 and 60)
);

create index if not exists api_tokens_developer_idx
  on public.api_tokens (developer_id, created_at desc);
create index if not exists api_tokens_prefix_idx
  on public.api_tokens (token_prefix);

alter table public.api_tokens enable row level security;

drop policy if exists "developers read their own tokens" on public.api_tokens;
create policy "developers read their own tokens"
  on public.api_tokens for select to authenticated
  using (auth.uid() = developer_id);

drop policy if exists "developers create their own tokens" on public.api_tokens;
create policy "developers create their own tokens"
  on public.api_tokens for insert to authenticated
  with check (auth.uid() = developer_id);

drop policy if exists "developers revoke their own tokens" on public.api_tokens;
create policy "developers revoke their own tokens"
  on public.api_tokens for update to authenticated
  using (auth.uid() = developer_id)
  with check (auth.uid() = developer_id);

drop policy if exists "developers delete their own tokens" on public.api_tokens;
create policy "developers delete their own tokens"
  on public.api_tokens for delete to authenticated
  using (auth.uid() = developer_id);

grant select, insert, update, delete on public.api_tokens to authenticated;

-- ---------------------------------------------------------------------------
--  packages
-- ---------------------------------------------------------------------------
create table if not exists public.packages (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  display_name   text,
  summary        text not null default '',
  description    text not null default '',
  license        text,
  repository_url text,
  homepage_url   text,
  author         text,
  keywords       text[] not null default '{}',
  owner_id       uuid references public.developers (id) on delete set null,
  latest_version text,
  versions_count integer not null default 0,
  downloads      bigint  not null default 0,
  published      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  search_vector  tsvector generated always as (
                   to_tsvector(
                     'english',
                     coalesce(name, '') || ' ' ||
                     coalesce(display_name, '') || ' ' ||
                     coalesce(summary, '') || ' ' ||
                     coalesce(description, '')
                   )
                 ) stored,
  constraint packages_name_format
    check (name ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  constraint packages_summary_length
    check (char_length(summary) <= 280)
);

create index if not exists packages_downloads_idx on public.packages (downloads desc);
create index if not exists packages_updated_idx   on public.packages (updated_at desc);
create index if not exists packages_name_idx      on public.packages (name);
create index if not exists packages_keywords_idx  on public.packages using gin (keywords);
create index if not exists packages_search_idx    on public.packages using gin (search_vector);
create index if not exists packages_owner_idx     on public.packages (owner_id);

-- ---------------------------------------------------------------------------
--  package_versions
-- ---------------------------------------------------------------------------
create table if not exists public.package_versions (
  id              uuid primary key default gen_random_uuid(),
  package_id      uuid not null references public.packages (id) on delete cascade,
  version         text not null,
  entry           text,
  tarball_path    text not null,
  tarball_bytes   bigint not null default 0,
  checksum_sha256 text,
  manifest        jsonb not null default '{}'::jsonb,
  readme          text,
  yanked          boolean not null default false,
  published_at    timestamptz not null default now(),
  constraint package_versions_version_format
    check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$')
);

create unique index if not exists package_versions_package_version_key
  on public.package_versions (package_id, version);
create index if not exists package_versions_published_idx
  on public.package_versions (published_at desc);

-- ---------------------------------------------------------------------------
--  Row level security — anonymous reads, owner writes
-- ---------------------------------------------------------------------------
alter table public.packages         enable row level security;
alter table public.package_versions enable row level security;

drop policy if exists "packages are public" on public.packages;
create policy "packages are public"
  on public.packages for select
  using (published);

drop policy if exists "owners write their packages" on public.packages;
create policy "owners write their packages"
  on public.packages for insert to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "owners update their packages" on public.packages;
create policy "owners update their packages"
  on public.packages for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "owners delete their packages" on public.packages;
create policy "owners delete their packages"
  on public.packages for delete to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "versions of public packages are public" on public.package_versions;
create policy "versions of public packages are public"
  on public.package_versions for select
  using (
    not yanked
    and exists (
      select 1 from public.packages p
      where p.id = package_id and p.published
    )
  );

drop policy if exists "owners write their versions" on public.package_versions;
create policy "owners write their versions"
  on public.package_versions for insert to authenticated
  with check (
    exists (
      select 1 from public.packages p
      where p.id = package_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "owners update their versions" on public.package_versions;
create policy "owners update their versions"
  on public.package_versions for update to authenticated
  using (
    exists (
      select 1 from public.packages p
      where p.id = package_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "owners delete their versions" on public.package_versions;
create policy "owners delete their versions"
  on public.package_versions for delete to authenticated
  using (
    exists (
      select 1 from public.packages p
      where p.id = package_id and p.owner_id = auth.uid()
    )
  );

grant select on public.packages         to anon, authenticated;
grant select on public.package_versions to anon, authenticated;
grant insert, update, delete on public.packages         to authenticated;
grant insert, update, delete on public.package_versions to authenticated;

-- ---------------------------------------------------------------------------
--  updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists packages_touch_updated_at on public.packages;
create trigger packages_touch_updated_at
  before update on public.packages
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  Storage — the "packages" bucket holds every uploaded payload
--
--  Objects live at:  <name>/<version>/<name>-<version>.<ext>
--  The bucket is public-read so a package manager can fetch tarballs straight
--  from the CDN URL. Only authenticated publishers can write.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'packages',
  'packages',
  true,
  26214400, -- 25 MB
  array[
    'application/gzip',
    'application/x-gzip',
    'application/x-tar',
    'application/zip',
    'application/octet-stream'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "packages bucket is readable" on storage.objects;
create policy "packages bucket is readable"
  on storage.objects for select
  using (bucket_id = 'packages');

drop policy if exists "authenticated publishers can upload" on storage.objects;
create policy "authenticated publishers can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'packages');

drop policy if exists "authenticated publishers can replace" on storage.objects;
create policy "authenticated publishers can replace"
  on storage.objects for update to authenticated
  using (bucket_id = 'packages')
  with check (bucket_id = 'packages');

-- ---------------------------------------------------------------------------
--  Download counter
--
--  Security definer so an anonymous install can bump the counter without
--  being able to touch package rows directly.
-- ---------------------------------------------------------------------------
create or replace function public.package_download_count(package_name text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.packages
     set downloads = downloads + 1
   where name = lower(btrim(package_name));
$$;

grant execute on function public.package_download_count(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
--  rate_limits
--
--  Fixed-window counters keyed by a hashed caller identity. Clients cannot read
--  or write the table: consume_rate_limit() is the only door, and it is safe to
--  call anonymously (it is security definer and only ever touches counters).
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  bucket            text primary key,
  window_started_at timestamptz not null default now(),
  hits              integer not null default 0
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- PostgreSQL will not rename an input parameter in place: `create or replace`
-- fails with 42P13 "cannot change name of input parameter", and the fix is to
-- drop first. The lookup below matches on name rather than signature, so it
-- also clears a definition from an earlier revision that used different
-- argument types. Safe to re-run: with nothing to drop the loop does nothing.
do $$
declare
  existing text;
begin
  for existing in
    select p.oid::regprocedure::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'consume_rate_limit'
  loop
    execute format('drop function %s', existing);
  end loop;
end $$;

-- Parameters are prefixed `p_` on purpose: PL/pgSQL cannot tell a parameter
-- from a column of the same name, and `bucket` is also a column here. Without
-- the prefix every call fails with 42702 "column reference is ambiguous".
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_window_seconds integer,
  p_max_hits integer
)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  entry   public.rate_limits;
  started timestamptz := now();
begin
  insert into public.rate_limits (bucket, window_started_at, hits)
  values (p_bucket, started, 1)
  on conflict (bucket) do update
    set hits = case
                 when public.rate_limits.window_started_at
                      <= started - make_interval(secs => p_window_seconds)
                   then 1
                 else public.rate_limits.hits + 1
               end,
        window_started_at = case
                 when public.rate_limits.window_started_at
                      <= started - make_interval(secs => p_window_seconds)
                   then started
                 else public.rate_limits.window_started_at
               end
  returning * into entry;

  -- Opportunistic cleanup, so no cron job is needed to keep the table small.
  if entry.hits = 1 then
    delete from public.rate_limits
     where bucket <> entry.bucket
       and window_started_at < started - interval '1 day';
  end if;

  return query
    select entry.hits <= p_max_hits,
           greatest(p_max_hits - entry.hits, 0),
           greatest(
             ceil(
               extract(
                 epoch from (
                   entry.window_started_at + make_interval(secs => p_window_seconds) - started
                 )
               )
             )::integer,
             0
           );
end;
$$;

grant execute on function public.consume_rate_limit(text, integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
--  audit_log
--
--  Publish and credential events. A developer can read their own trail; nothing
--  writes directly — the server does, with the service role.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id           bigserial primary key,
  developer_id uuid references public.developers (id) on delete set null,
  kind         text not null,
  subject      text,
  ip_hash      text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists audit_log_created_idx
  on public.audit_log (created_at desc);
create index if not exists audit_log_developer_idx
  on public.audit_log (developer_id, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "developers read their own audit trail" on public.audit_log;
create policy "developers read their own audit trail"
  on public.audit_log for select to authenticated
  using (auth.uid() = developer_id);

grant select on public.audit_log to authenticated;
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------------
--  Optional demo rows — uncomment to give the registry something to show.
--  `tarball_path` must point at an object that exists in the bucket.
-- ---------------------------------------------------------------------------
-- insert into public.packages (name, display_name, summary, description, license, keywords, author, latest_version, versions_count)
-- values (
--   'example-utils',
--   'example-utils',
--   'Sample package used to preview the registry UI.',
--   'A tiny demo package. Replace or delete it once you publish something real.',
--   'MIT',
--   array['demo', 'utilities'],
--   'Sere Language',
--   '0.1.0',
--   1
-- )
-- on conflict (name) do nothing;
