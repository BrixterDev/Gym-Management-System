-- =============================================================================
-- GymTrack — 0002_functions.sql
-- Trusted functions and guard triggers.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER: bypass RLS to inspect own actor row).
-- -----------------------------------------------------------------------------
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role(), '') = 'service_role';
$$;

-- True for trusted database sessions (SQL editor, migrations, service role).
-- PostgREST requests run as `authenticator`/`authenticated`, never `postgres`.
create or replace function public.is_trusted_db_session()
returns boolean
language sql
stable
as $$
  select current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
      or public.is_service_role();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.account_status = 'approved'
  );
$$;

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.current_profile() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_service_role() to authenticated;
grant execute on function public.current_profile() to authenticated;

-- -----------------------------------------------------------------------------
-- New auth user -> pending client profile. Role/status are NEVER taken from
-- user-supplied metadata.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, account_status, membership_status)
  values (new.id, coalesce(new.email, ''), 'client', 'pending', 'non-member')
  on conflict (id) do nothing;

  insert into public.client_details (client_id)
  values (new.id)
  on conflict (client_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync when the auth email changes (admin-initiated only).
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- -----------------------------------------------------------------------------
-- profiles: clients may only ever change their phone number.
-- -----------------------------------------------------------------------------
create or replace function public.profiles_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Server-side / admin operations pass through.
  if public.is_trusted_db_session() or public.is_admin() then
    return new;
  end if;

  if auth.uid() is distinct from old.id then
    raise exception 'Not authorized to update this profile' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.account_status is distinct from old.account_status
     or new.membership_status is distinct from old.membership_status
     or new.created_at is distinct from old.created_at then
    raise exception 'Clients may only update their phone number' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.profiles_guard_update();

-- Clients can never insert or delete profile rows (RLS already blocks this;
-- trigger is defence in depth). Inserts happen only via auth trigger/service role.
create or replace function public.profiles_guard_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trusted_db_session() or public.is_admin() then
    if tg_op = 'INSERT' then
      return new;
    end if;
    return old;
  end if;
  raise exception 'Profile rows cannot be created or deleted directly' using errcode = '42501';
end;
$$;

drop trigger if exists profiles_guard_insert on public.profiles;
create trigger profiles_guard_insert
  before insert on public.profiles
  for each row execute function public.profiles_guard_mutation();

drop trigger if exists profiles_guard_delete on public.profiles;
create trigger profiles_guard_delete
  before delete on public.profiles
  for each row execute function public.profiles_guard_mutation();

-- -----------------------------------------------------------------------------
-- body_metrics: ownership + recorded_by integrity.
-- Clients can only create/edit rows they recorded; admin-recorded rows are
-- read-only to the client.
-- -----------------------------------------------------------------------------
create or replace function public.body_metrics_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if public.is_trusted_db_session() or public.is_admin() then
    if tg_op = 'INSERT' then
      new.recorded_by := coalesce(actor, new.recorded_by);
      if new.recorded_by is null then
        raise exception 'recorded_by is required' using errcode = '23502';
      end if;
    end if;
    return new;
  end if;

  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.recorded_by := actor;
    if new.client_id is distinct from actor then
      raise exception 'Clients may only record their own metrics' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.client_id is distinct from actor or old.recorded_by is distinct from actor then
    raise exception 'This metric record is read-only to you' using errcode = '42501';
  end if;
  new.client_id := old.client_id;
  new.recorded_by := old.recorded_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists body_metrics_guard on public.body_metrics;
create trigger body_metrics_guard
  before insert or update on public.body_metrics
  for each row execute function public.body_metrics_guard();

-- -----------------------------------------------------------------------------
-- Membership status helper — recomputes profiles.membership_status from the
-- client's subscriptions. Cancelled is terminal, so only non-cancelled rows
-- count toward Member status.
-- -----------------------------------------------------------------------------
create or replace function public.recompute_membership_status(p_client_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select case
    when exists (
      select 1 from public.memberships m
      where m.client_id = p_client_id
        and m.subscription_status <> 'cancelled'
    ) then 'member'
    else 'non-member'
  end
  into v_status;

  update public.profiles
     set membership_status = v_status
   where id = p_client_id
     and membership_status is distinct from v_status;

  return v_status;
end;
$$;

revoke all on function public.recompute_membership_status(uuid) from public;

-- Keep profiles.membership_status in sync whenever memberships change.
create or replace function public.memberships_sync_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_membership_status(old.client_id);
    return old;
  end if;

  perform public.recompute_membership_status(new.client_id);
  if tg_op = 'UPDATE' and old.client_id is distinct from new.client_id then
    perform public.recompute_membership_status(old.client_id);
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_sync_profile_status on public.memberships;
create trigger memberships_sync_profile_status
  after insert or update or delete on public.memberships
  for each row execute function public.memberships_sync_profile_status();

-- -----------------------------------------------------------------------------
-- Audit helper — only callable through SECURITY DEFINER functions / service role.
-- -----------------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb,
  p_after jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after);
end;
$$;

revoke all on function public.write_audit_log(text, text, uuid, jsonb, jsonb) from public;
