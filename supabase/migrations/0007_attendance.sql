-- =============================================================================
-- GymTrack — 0007_attendance.sql
-- Phase 4: QR identity, trusted check-in/out, admin corrections,
-- attendance directory + stats views, and audit triggers.
--
-- Security rules enforced here (never trusted to the client):
--   - Check-in requires an approved client account and a live subscription
--     (active, today within start_date..end_date).
--   - Paused, expired, cancelled, or future subscriptions cannot check in.
--   - One open session per client (partial unique index + guarded RPCs).
--   - Clients can only act on themselves; admins act via QR/member code or
--     an attendance id, and every correction is audited.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Per-client QR token. Stable, random, and safe to print. Rotatable by an admin.
-- -----------------------------------------------------------------------------
alter table public.client_details
  add column if not exists qr_token uuid not null default gen_random_uuid();

create unique index if not exists client_details_qr_token_idx
  on public.client_details (qr_token);

-- Expose the token in the admin directory (clients already see their own row).
drop view if exists public.admin_client_directory;
create view public.admin_client_directory
with (security_invoker = true)
as
select
  p.id,
  p.email,
  p.phone,
  p.role,
  p.account_status,
  p.membership_status,
  p.created_at,
  p.updated_at,
  cd.id            as client_detail_id,
  cd.display_name,
  cd.member_code,
  cd.height_cm,
  cd.date_of_birth,
  cd.emergency_contact,
  cd.notes,
  cd.qr_token::text as qr_token,
  cd.updated_at    as detail_updated_at
from public.profiles p
left join public.client_details cd on cd.client_id = p.id
where p.role = 'client';

revoke all on public.admin_client_directory from anon;
grant select on public.admin_client_directory to authenticated;

-- -----------------------------------------------------------------------------
-- Audit attendance changes (self check-ins and admin corrections alike).
-- -----------------------------------------------------------------------------
drop trigger if exists audit_attendance_changes on public.attendance;
create trigger audit_attendance_changes
  after insert or update or delete on public.attendance
  for each row execute function public.audit_table_changes();

-- -----------------------------------------------------------------------------
-- Internal helpers (not granted to any API role).
-- -----------------------------------------------------------------------------
create or replace function public.perform_check_in(p_client_id uuid)
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_membership public.memberships;
  v_row public.attendance;
begin
  select * into v_profile from public.profiles where id = p_client_id;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if v_profile.role <> 'client' then
    raise exception 'Only members can check in' using errcode = '22023';
  end if;
  if v_profile.account_status <> 'approved' then
    raise exception 'This account is not active. Ask the gym admin to approve it.'
      using errcode = '22023';
  end if;

  select * into v_membership
    from public.memberships
   where client_id = p_client_id
     and subscription_status = 'active'
     and start_date <= public.gym_today()
     and end_date >= public.gym_today()
   order by end_date desc
   limit 1;

  if not found then
    if exists (
      select 1 from public.memberships
       where client_id = p_client_id
         and subscription_status = 'paused'
    ) then
      raise exception 'Subscription is paused. Resume it before checking in.'
        using errcode = '22023';
    end if;
    raise exception 'No active subscription. Renew the membership before checking in.'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.attendance
     where client_id = p_client_id
       and time_out is null
  ) then
    raise exception 'Member is already checked in' using errcode = '23505';
  end if;

  insert into public.attendance (client_id)
  values (p_client_id)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.perform_check_in(uuid) from public;

create or replace function public.perform_check_out(p_client_id uuid)
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.attendance;
  v_valid boolean;
begin
  select * into v_row
    from public.attendance
   where client_id = p_client_id
     and time_out is null
   for update;

  if not found then
    raise exception 'No open attendance session' using errcode = '22023';
  end if;

  v_valid := exists (
    select 1 from public.memberships
     where client_id = p_client_id
       and subscription_status = 'active'
       and start_date <= public.gym_today()
       and end_date >= public.gym_today()
  );

  update public.attendance
     set time_out = now(),
         expired_during_session = not v_valid
   where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.perform_check_out(uuid) from public;

-- -----------------------------------------------------------------------------
-- Member self-service check-in/out.
-- -----------------------------------------------------------------------------
create or replace function public.client_check_in()
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if public.is_admin() then
    raise exception 'Admins cannot check in as a member' using errcode = '22023';
  end if;
  return public.perform_check_in(v_uid);
end;
$$;

revoke all on function public.client_check_in() from public;
grant execute on function public.client_check_in() to authenticated;

create or replace function public.client_check_out()
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return public.perform_check_out(v_uid);
end;
$$;

revoke all on function public.client_check_out() from public;
grant execute on function public.client_check_out() to authenticated;

-- -----------------------------------------------------------------------------
-- Admin QR / member-code toggle used by the scanner.
-- Accepts the QR token or the member code (case-insensitive).
-- -----------------------------------------------------------------------------
create or replace function public.admin_toggle_attendance(p_code text)
returns table (
  action text,
  attendance_id uuid,
  client_id uuid,
  display_name text,
  member_code text,
  occurred_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := lower(trim(coalesce(p_code, '')));
  v_client uuid;
  v_detail public.client_details;
  v_row public.attendance;
  v_action text;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;
  if v_code = '' then
    raise exception 'Enter a QR code or member code' using errcode = '22023';
  end if;

  select cd.* into v_detail
    from public.client_details cd
   where lower(cd.qr_token::text) = v_code
      or lower(coalesce(cd.member_code, '')) = v_code
   limit 1;

  if not found then
    raise exception 'No member matches that QR code or member code'
      using errcode = '22023';
  end if;
  v_client := v_detail.client_id;

  if exists (
    select 1 from public.attendance a
     where a.client_id = v_client
       and a.time_out is null
  ) then
    v_row := public.perform_check_out(v_client);
    v_action := 'checked_out';
  else
    v_row := public.perform_check_in(v_client);
    v_action := 'checked_in';
  end if;

  return query
  select
    v_action,
    v_row.id,
    v_client,
    v_detail.display_name,
    v_detail.member_code,
    coalesce(v_row.time_out, v_row.time_in);
end;
$$;

revoke all on function public.admin_toggle_attendance(text) from public;
grant execute on function public.admin_toggle_attendance(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Close a specific open session from the admin table.
-- -----------------------------------------------------------------------------
create or replace function public.admin_close_attendance(p_attendance_id uuid)
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.attendance;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  select * into v_row from public.attendance where id = p_attendance_id for update;
  if not found then
    raise exception 'Attendance record not found' using errcode = '22023';
  end if;
  if v_row.time_out is not null then
    raise exception 'This session is already closed' using errcode = '22023';
  end if;

  return public.perform_check_out(v_row.client_id);
end;
$$;

revoke all on function public.admin_close_attendance(uuid) from public;
grant execute on function public.admin_close_attendance(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Admin correction: edit time in/out. Times are validated in the database.
-- -----------------------------------------------------------------------------
create or replace function public.admin_update_attendance(
  p_attendance_id uuid,
  p_time_in timestamptz,
  p_time_out timestamptz
)
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.attendance;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;
  if p_time_in is null then
    raise exception 'Time in is required' using errcode = '22023';
  end if;
  if p_time_out is not null and p_time_out <= p_time_in then
    raise exception 'Time out must be after time in' using errcode = '22023';
  end if;

  select * into v_row from public.attendance where id = p_attendance_id for update;
  if not found then
    raise exception 'Attendance record not found' using errcode = '22023';
  end if;

  begin
    update public.attendance
       set time_in = p_time_in,
           time_out = p_time_out
     where id = p_attendance_id
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'This member already has another open session' using errcode = '23505';
  end;

  return v_row;
end;
$$;

revoke all on function public.admin_update_attendance(uuid, timestamptz, timestamptz) from public;
grant execute on function public.admin_update_attendance(uuid, timestamptz, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- Rotate a member's QR token (lost/leaked badge).
-- -----------------------------------------------------------------------------
create or replace function public.admin_regenerate_client_qr(p_client_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  update public.client_details
     set qr_token = gen_random_uuid()
   where client_id = p_client_id
  returning qr_token into v_token;

  if v_token is null then
    raise exception 'Member details not found' using errcode = '22023';
  end if;

  return v_token::text;
end;
$$;

revoke all on function public.admin_regenerate_client_qr(uuid) from public;
grant execute on function public.admin_regenerate_client_qr(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Directory + stats views (security_invoker keeps RLS in force).
-- -----------------------------------------------------------------------------
create or replace view public.admin_attendance_directory
with (security_invoker = true)
as
select
  a.id,
  a.client_id,
  p.email,
  p.account_status,
  cd.display_name,
  cd.member_code,
  cd.qr_token::text as qr_token,
  a.time_in,
  a.time_out,
  a.expired_during_session,
  a.created_at,
  (a.time_in at time zone gs.timezone)::date as visit_date,
  case
    when a.time_out is null then null
    else round(extract(epoch from (a.time_out - a.time_in)) / 60)::int
  end as duration_minutes,
  case when a.time_out is null then 'open' else 'closed' end as visit_state,
  m.plan_id,
  pl.name as plan_name,
  m.subscription_status
from public.attendance a
join public.profiles p on p.id = a.client_id
left join public.client_details cd on cd.client_id = a.client_id
cross join lateral (
  select gs.timezone from public.gym_settings gs limit 1
) gs
left join lateral (
  select m.plan_id, m.subscription_status
    from public.memberships m
   where m.client_id = a.client_id
   order by m.start_date desc, m.created_at desc
   limit 1
) m on true
left join public.membership_plans pl on pl.id = m.plan_id;

revoke all on public.admin_attendance_directory from anon;
grant select on public.admin_attendance_directory to authenticated;

create or replace view public.admin_attendance_stats
with (security_invoker = true)
as
with settings as (
  select gs.timezone, public.gym_today() as today
    from public.gym_settings gs
   limit 1
)
select
  s.today,
  count(a.id) filter (
    where (a.time_in at time zone s.timezone)::date = s.today
  )::int as today_visits,
  count(a.id) filter (where a.time_out is null)::int as currently_in,
  count(a.id) filter (
    where (a.time_in at time zone s.timezone)::date >= s.today - 6
  )::int as week_visits,
  round(avg(extract(epoch from (a.time_out - a.time_in)) / 60) filter (
    where a.time_out is not null
      and (a.time_in at time zone s.timezone)::date = s.today
  ))::int as avg_minutes_today
from settings s
left join public.attendance a on true
group by s.today;

revoke all on public.admin_attendance_stats from anon;
grant select on public.admin_attendance_stats to authenticated;
