-- ============================================================================
-- Daily Ink — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- USERNAME + PASSWORD SIGN-IN NOTES
--   1. The app never asks for a real email. Accounts are created with a
--      synthetic <username><timestamp>@dailyink.app address, so you MUST
--      disable "Confirm email": Dashboard → Authentication → Providers →
--      Email → uncheck "Confirm email". Otherwise sign-in fails with
--      "Email not confirmed".
--   2. The sign-in email is derived from the username in the browser (see
--      auth_email_for() below), so signed-out visitors never query anything
--      and cannot test whether a username exists. profiles stays owner-only.
--   3. Every sign-in, sign-up and sign-out is recorded in public.login_events
--      through log_auth_event(). The log stores the username, user id, time,
--      result, failure reason and browser — never the password (Supabase
--      hashes passwords server-side). Only admins can read it.
--   4. Recommended Auth settings: minimum password length 8, CAPTCHA
--      protection (Turnstile) on, and the default rate limits left on.
--   5. To make yourself an admin, run this once with your own username:
--        update public.profiles set is_admin = true where username = 'yourname';
--      You may need to sign up in the app first. The is_admin flag cannot be
--      set from the app itself (see profiles_protect_admin below).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- User profile / preferences (created automatically on signup by trigger)
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique,
  email         text unique,
  display_name  text,
  is_admin      boolean not null default false,
  theme         text not null default 'system',
  lock_enabled  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Upgrade path for projects created before username sign-in existed: adds
-- the username/email columns if profiles already exists without them.
alter table public.profiles add column if not exists username text unique;
alter table public.profiles add column if not exists email    text unique;
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Passwords live only in Supabase Auth (bcrypt, server-side). Early versions
-- also kept a browser-made hash in public.credentials and exposed
-- get_credential_for_signin() to anon; both are removed here.
drop function if exists public.get_credential_for_signin(text);
drop table if exists public.credentials;

-- One journal entry per day. Content may be client-side encrypted.
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  entry_date  date not null,
  content     text not null default '',
  mood        text,
  encrypted   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index if not exists entries_user_date_idx on public.entries (user_id, entry_date desc);

-- Tasks attached to a day
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  entry_date  date not null,
  title       text not null,
  done        boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tasks_user_date_idx on public.tasks (user_id, entry_date);

-- Spaced-repetition schedule per entry date
create table if not exists public.reviews (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  entry_date       date not null,
  interval_days    integer not null default 0,
  ease_factor      real not null default 2.5,
  repetitions      integer not null default 0,
  due_date         date not null default (now() at time zone 'utc')::date,
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index if not exists reviews_user_due_idx on public.reviews (user_id, due_date);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.entries  enable row level security;
alter table public.tasks    enable row level security;
alter table public.reviews  enable row level security;

-- Profiles: readable by the owner only. Signed-out visitors never need to
-- read this table. (An older revision of this file allowed public SELECT; the
-- drop below removes that policy on projects that already ran it.)
drop policy if exists "profiles_select_for_signin" on public.profiles;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Entries: full CRUD scoped to the owner
drop policy if exists "entries_select_own" on public.entries;
create policy "entries_select_own" on public.entries
  for select using (auth.uid() = user_id);

drop policy if exists "entries_insert_own" on public.entries;
create policy "entries_insert_own" on public.entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "entries_update_own" on public.entries;
create policy "entries_update_own" on public.entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "entries_delete_own" on public.entries;
create policy "entries_delete_own" on public.entries
  for delete using (auth.uid() = user_id);

-- Tasks: full CRUD scoped to the owner
drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own" on public.tasks
  for delete using (auth.uid() = user_id);

-- Reviews: full CRUD scoped to the owner
drop policy if exists "reviews_select_own" on public.reviews;
create policy "reviews_select_own" on public.reviews
  for select using (auth.uid() = user_id);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews
  for insert with check (auth.uid() = user_id);

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own" on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own" on public.reviews
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------

-- Auto-create a profile row when a user signs up, storing the chosen
-- username and the synthetic sign-in email
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email, display_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Realtime (live sync across devices)
-- Tables must be members of the supabase_realtime publication for
-- postgres_changes subscriptions to deliver events. Idempotent so the
-- whole file can be re-run safely.
-- ----------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.entries;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.reviews;
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- Routines / Custom Interval Schedule
-- ----------------------------------------------------------------------------

create table if not exists public.routines (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  title             text not null,
  gap_days          integer not null default 3,
  start_date        date not null,
  color             text not null default '#f59e0b',
  icon              text default '',
  adjust_from_last  boolean not null default true,
  completions       jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists routines_user_idx on public.routines (user_id);

alter table public.routines enable row level security;

drop policy if exists "routines_select_own" on public.routines;
create policy "routines_select_own" on public.routines
  for select using (auth.uid() = user_id);

drop policy if exists "routines_insert_own" on public.routines;
create policy "routines_insert_own" on public.routines
  for insert with check (auth.uid() = user_id);

drop policy if exists "routines_update_own" on public.routines;
create policy "routines_update_own" on public.routines
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "routines_delete_own" on public.routines;
create policy "routines_delete_own" on public.routines
  for delete using (auth.uid() = user_id);

drop trigger if exists routines_set_updated_at on public.routines;
create trigger routines_set_updated_at
  before update on public.routines
  for each row execute function public.set_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.routines;
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- Admin & login activity
-- ============================================================================

-- Sign-in addresses are derived from the username in the browser
-- (src/utils/authEmail.js): 'u-' + first 40 hex chars of sha256(lower(trim(
-- username))) + '@users.dailyink.app'. Signing in therefore needs no lookup,
-- and the lookup functions that let anyone test whether a username exists
-- are dropped. Older accounts used '<name><timestamp>@dailyink.app'; the block
-- below moves them to the new address. Passwords are untouched, and running
-- it again changes nothing.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.auth_email_for(p_username text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select 'u-' || substr(encode(extensions.digest(lower(btrim(p_username)), 'sha256'), 'hex'), 1, 40)
         || '@users.dailyink.app';
$$;

revoke execute on function public.auth_email_for(text) from public, anon, authenticated;

with target as (
  select u.id,
         public.auth_email_for(coalesce(p.username, u.raw_user_meta_data ->> 'username')) as new_email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where coalesce(p.username, u.raw_user_meta_data ->> 'username') is not null
)
update auth.users u
set email = t.new_email, updated_at = now()
from target t
where u.id = t.id
  and u.email is distinct from t.new_email
  and not exists (select 1 from auth.users o where o.email = t.new_email and o.id <> u.id);

update auth.identities i
set identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(u.email)),
    updated_at = now()
from auth.users u
where i.user_id = u.id
  and i.provider = 'email'
  and i.identity_data ->> 'email' is distinct from u.email;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is distinct from u.email;

drop function if exists public.resolve_login_email(text);
drop function if exists public.username_available(text);

-- True when the signed-in user is flagged as an admin. SECURITY DEFINER so the
-- login_events policies below can call it without recursing into the profiles
-- policy, and STABLE so Postgres can cache it per statement.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Backfill profiles for accounts created before the signup trigger or the
-- username/email columns existed, so every account can be resolved at sign-in.
insert into public.profiles (id, username, email, display_name)
select u.id,
       u.raw_user_meta_data ->> 'username',
       u.email,
       coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

update public.profiles p
set username = u.raw_user_meta_data ->> 'username'
from auth.users u
where p.id = u.id
  and p.username is null
  and u.raw_user_meta_data ->> 'username' is not null
  and not exists (
    select 1 from public.profiles o
    where lower(o.username) = lower(u.raw_user_meta_data ->> 'username')
  );

-- Case-insensitive uniqueness, so "Maya" and "maya" can't both register.
-- Skipped with a notice if existing data already has such duplicates.
do $$
begin
  create unique index if not exists profiles_username_lower_key
    on public.profiles (lower(username));
exception when unique_violation then
  raise notice 'profiles has usernames differing only by case; lower(username) index not created';
end $$;

-- Refuse to let a normal signed-in user promote themselves. The app can update
-- its own profile row (theme, display name…), so without this guard anybody
-- could set is_admin = true and read the whole login log. The SQL editor has no
-- auth.uid(), so you can still set the flag by hand there.
create or replace function public.protect_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not public.is_admin()
  then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_admin on public.profiles;
create trigger profiles_protect_admin
  before update on public.profiles
  for each row execute function public.protect_admin_flag();

-- Append-only audit trail of sign-in activity. Deliberately stores no
-- password: Supabase Auth hashes passwords server-side, so a plaintext
-- password is never available to the app (or to this table).
create table if not exists public.login_events (
  id          uuid primary key default gen_random_uuid(),
  username    text not null default '' check (char_length(username) <= 64),
  user_id     uuid references auth.users (id) on delete set null,
  event       text not null default 'sign_in' check (event in ('sign_in', 'sign_up', 'sign_out')),
  success     boolean not null default false,
  reason      text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists login_events_created_idx on public.login_events (created_at desc);
create index if not exists login_events_username_idx on public.login_events (lower(username), created_at desc);

alter table public.login_events enable row level security;

-- Nobody inserts directly. Events go through log_auth_event(), which takes the
-- user id from the caller's own session (so events can't be forged for
-- someone else), only lets signed-out callers record failures, and ignores
-- floods: at most 20 events per username per 10 minutes.
drop policy if exists "login_events_insert_any" on public.login_events;

create or replace function public.log_auth_event(
  p_username   text,
  p_event      text,
  p_success    boolean,
  p_reason     text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(coalesce(btrim(p_username), ''), 64);
begin
  if p_event not in ('sign_in', 'sign_up', 'sign_out') then
    return;
  end if;
  if auth.uid() is null and p_success then
    return;
  end if;
  if (select count(*) from public.login_events
      where lower(username) = lower(v_name)
        and created_at > now() - interval '10 minutes') >= 20 then
    return;
  end if;
  insert into public.login_events (username, user_id, event, success, reason, user_agent)
  values (v_name, auth.uid(), p_event, p_success, left(p_reason, 200), left(p_user_agent, 300));
end;
$$;

revoke execute on function public.log_auth_event(text, text, boolean, text, text) from public;
grant execute on function public.log_auth_event(text, text, boolean, text, text) to anon, authenticated;

-- Only admins may read or clear the log. There is intentionally no UPDATE
-- policy: entries are append-only.
drop policy if exists "login_events_select_admin" on public.login_events;
create policy "login_events_select_admin" on public.login_events
  for select using (public.is_admin());

drop policy if exists "login_events_delete_admin" on public.login_events;
create policy "login_events_delete_admin" on public.login_events
  for delete using (public.is_admin());

-- ============================================================================
-- Make yourself an admin (run this after you have signed up in the app):
--   update public.profiles set is_admin = true where username = 'yourname';
-- Then open /admin. The flag can only be set from here, never from the app.
-- ============================================================================