-- ============================================================================
-- Daily Ink — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- USERNAME + PASSWORD SIGN-IN NOTES
--   1. The app never asks for a real email. Accounts are created with a
--      synthetic <username><timestamp>@dailyink.local address, so you MUST
--      disable "Confirm email": Dashboard → Authentication → Providers →
--      Email → uncheck "Confirm email". Otherwise sign-in fails with
--      "Email not confirmed".
--   2. Profiles store the username (unique) and the synthetic email (unique)
--      so sign-in can resolve username → email before authenticating.
--   3. Signed-out visitors resolve a username to its sign-in email through the
--      public.resolve_login_email() function below, NOT by reading profiles.
--      profiles itself stays readable by its owner only.
--   4. Every sign-in attempt is appended to public.login_events. The log stores
--      the username, time, result and device — never the password (Supabase
--      hashes passwords server-side, so no plaintext password ever exists in
--      this project). Only admins can read it.
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

-- Credentials table for pure username/password auth (no email).
-- Stores password hashes only; never stores plaintext passwords.
create table if not exists public.credentials (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  username      text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.credentials enable row level security;

-- Only the credential owner can read their own row (for verification).
-- Service role bypasses RLS for admin operations.
drop policy if exists "credentials_select_own" on public.credentials;
create policy "credentials_select_own" on public.credentials
  for select using (auth.uid() = user_id);

drop policy if exists "credentials_insert_own" on public.credentials;
create policy "credentials_insert_own" on public.credentials
  for insert with check (auth.uid() = user_id);

drop policy if exists "credentials_update_own" on public.credentials;
create policy "credentials_update_own" on public.credentials
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
-- read this table — they resolve username -> sign-in email through
-- public.resolve_login_email(), a security-definer function defined further
-- down. (An older revision of this file allowed public SELECT; the drop below
-- removes that policy on projects that already ran it.)
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

-- Concurrency-safe lookup of a username's sign-in email.
-- SECURITY DEFINER so it can read profiles even though the profiles SELECT
-- policy is owner-only, and so it bypasses the RLS check for signed-out
-- visitors. It returns nothing but the synthetic address, and never exposes
-- any other profile column, so it is safe to expose to anon.
create or replace function public.resolve_login_email(p_username text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select p.email
  from public.profiles p
  where p.username = btrim(p_username)
  limit 1;
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;

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

-- True when no profile has claimed this username yet. Used for a friendly
-- "that username is taken" message at signup; the unique constraint on
-- profiles.username remains the real backstop if two signups race.
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles p where p.username = btrim(p_username)
  );
$$;

grant execute on function public.username_available(text) to anon, authenticated;

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

-- Anyone (including a signed-out visitor whose password was wrong) may append
-- an attempt, otherwise failed logins could not be recorded at all.
drop policy if exists "login_events_insert_any" on public.login_events;
create policy "login_events_insert_any" on public.login_events
  for insert with check (true);

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