-- Phase 1: auth hardening. Run once in Supabase → SQL Editor, AFTER the
-- matching app version is deployed (it signs in both before and after this).
-- Safe to run again: every step checks what is already done.
-- (supabase/schema.sql contains the same statements for fresh projects.)

begin;

-- 1. Derived sign-in addresses: move every existing account to
--    'u-<sha256(username)>@users.dailyink.app'. Passwords are not touched.
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

-- 2. Login log: no direct inserts; events go through log_auth_event().
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

-- 3. Remove the unused table of old browser-made password hashes.
drop function if exists public.get_credential_for_signin(text);
drop table if exists public.credentials;

commit;

-- Check: every account should now have a u-…@users.dailyink.app address.
select count(*) filter (where email like 'u-%@users.dailyink.app') as migrated,
       count(*) as total
from auth.users;
