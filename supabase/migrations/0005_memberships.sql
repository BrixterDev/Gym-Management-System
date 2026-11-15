-- =============================================================================
-- GymTrack — 0005_memberships.sql
-- Phase 3: membership plans, subscription lifecycle RPCs, payments,
-- admin directory views, and audit triggers.
--
-- Lifecycle rules enforced here (never trusted to the client):
--   active   -> within date range, not paused/cancelled
--   expired  -> end_date passed (lazily refreshed)
--   paused   -> remaining days frozen; end_date recalculated on resume
--   cancelled-> terminal
-- A client may hold at most one active/paused subscription (partial unique index).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Gym-local "today" — all membership date math uses the configured timezone.
-- -----------------------------------------------------------------------------
create or replace function public.gym_today()
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (
    now() at time zone coalesce((select gs.timezone from public.gym_settings gs limit 1), 'UTC')
  )::date;
$$;

grant execute on function public.gym_today() to authenticated;

-- -----------------------------------------------------------------------------
-- Audit all admin-managed billing tables.
-- -----------------------------------------------------------------------------
drop trigger if exists audit_membership_plans_changes on public.membership_plans;
create trigger audit_membership_plans_changes
  after insert or update or delete on public.membership_plans
  for each row execute function public.audit_table_changes();

drop trigger if exists audit_memberships_changes on public.memberships;
create trigger audit_memberships_changes
  after insert or update or delete on public.memberships
  for each row execute function public.audit_table_changes();

drop trigger if exists audit_payments_changes on public.payments;
create trigger audit_payments_changes
  after insert or update or delete on public.payments
  for each row execute function public.audit_table_changes();

-- -----------------------------------------------------------------------------
-- Lazily expire subscriptions whose end date has passed.
-- -----------------------------------------------------------------------------
create or replace function public.admin_refresh_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  update public.memberships
     set subscription_status = 'expired'
   where subscription_status = 'active'
     and end_date < public.gym_today();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_refresh_subscriptions() from public;
grant execute on function public.admin_refresh_subscriptions() to authenticated;

-- -----------------------------------------------------------------------------
-- Create a subscription. End date is derived from the plan duration.
-- -----------------------------------------------------------------------------
create or replace function public.admin_create_subscription(
  p_client_id uuid,
  p_plan_id uuid,
  p_start_date date default null
)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.membership_plans;
  v_client public.profiles;
  v_start date;
  v_row public.memberships;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  select * into v_client from public.profiles where id = p_client_id;
  if not found or v_client.role <> 'client' then
    raise exception 'Client not found' using errcode = 'P0002';
  end if;

  select * into v_plan from public.membership_plans where id = p_plan_id;
  if not found then
    raise exception 'Membership plan not found' using errcode = 'P0002';
  end if;
  if not v_plan.is_active then
    raise exception 'This membership plan is inactive' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.memberships
    where client_id = p_client_id
      and subscription_status in ('active', 'paused')
  ) then
    raise exception 'Client already has an active or paused subscription'
      using errcode = '23505';
  end if;

  v_start := coalesce(p_start_date, public.gym_today());

  insert into public.memberships (
    client_id, plan_id, start_date, end_date, subscription_status, price_at_assignment
  )
  values (
    p_client_id,
    p_plan_id,
    v_start,
    v_start + (v_plan.duration_days - 1),
    'active',
    v_plan.price
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_create_subscription(uuid, uuid, date) from public;
grant execute on function public.admin_create_subscription(uuid, uuid, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Renew: retire the current subscription and start a new one.
-- Active subscriptions continue the day after their current end date.
-- -----------------------------------------------------------------------------
create or replace function public.admin_renew_subscription(
  p_membership_id uuid,
  p_plan_id uuid default null,
  p_start_date date default null
)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.memberships;
  v_plan public.membership_plans;
  v_start date;
  v_today date := public.gym_today();
  v_row public.memberships;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  select * into v_old from public.memberships where id = p_membership_id for update;
  if not found then
    raise exception 'Subscription not found' using errcode = 'P0002';
  end if;
  if v_old.subscription_status = 'cancelled' then
    raise exception 'Cancelled subscriptions cannot be renewed. Create a new subscription.'
      using errcode = '22023';
  end if;
  if v_old.subscription_status = 'paused' then
    raise exception 'Resume this subscription before renewing it' using errcode = '22023';
  end if;

  select * into v_plan
    from public.membership_plans
   where id = coalesce(p_plan_id, v_old.plan_id);
  if not found then
    raise exception 'Membership plan not found' using errcode = 'P0002';
  end if;
  if not v_plan.is_active then
    raise exception 'This membership plan is inactive' using errcode = '22023';
  end if;

  v_start := coalesce(
    p_start_date,
    case
      when v_old.end_date >= v_today then v_old.end_date + 1
      else v_today
    end
  );

  if v_start <= v_old.end_date and v_old.subscription_status in ('active', 'expired') then
    raise exception 'Renewal must start after the current end date (%)', v_old.end_date
      using errcode = '22023';
  end if;

  update public.memberships
     set subscription_status = 'expired'
   where id = p_membership_id;

  insert into public.memberships (
    client_id, plan_id, start_date, end_date, subscription_status, price_at_assignment
  )
  values (
    v_old.client_id,
    v_plan.id,
    v_start,
    v_start + (v_plan.duration_days - 1),
    'active',
    v_plan.price
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_renew_subscription(uuid, uuid, date) from public;
grant execute on function public.admin_renew_subscription(uuid, uuid, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Pause: freeze remaining days. Remaining is inclusive of the current day.
-- -----------------------------------------------------------------------------
create or replace function public.admin_pause_subscription(p_membership_id uuid)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.memberships;
  v_remaining integer;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  select * into v_row from public.memberships where id = p_membership_id for update;
  if not found then
    raise exception 'Subscription not found' using errcode = 'P0002';
  end if;
  if v_row.subscription_status <> 'active' then
    raise exception 'Only active subscriptions can be paused' using errcode = '22023';
  end if;

  v_remaining := v_row.end_date - public.gym_today() + 1;
  if v_remaining <= 0 then
    raise exception 'This subscription has already ended' using errcode = '22023';
  end if;

  update public.memberships
     set subscription_status = 'paused',
         paused_at = now(),
         paused_remaining_days = v_remaining
   where id = p_membership_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_pause_subscription(uuid) from public;
grant execute on function public.admin_pause_subscription(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Resume: extend the end date by the frozen remaining days.
-- -----------------------------------------------------------------------------
create or replace function public.admin_resume_subscription(p_membership_id uuid)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.memberships;
  v_days integer;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  select * into v_row from public.memberships where id = p_membership_id for update;
  if not found then
    raise exception 'Subscription not found' using errcode = 'P0002';
  end if;
  if v_row.subscription_status <> 'paused' then
    raise exception 'Only paused subscriptions can be resumed' using errcode = '22023';
  end if;

  v_days := greatest(coalesce(v_row.paused_remaining_days, 1), 1);

  update public.memberships
     set subscription_status = 'active',
         paused_at = null,
         paused_remaining_days = null,
         end_date = public.gym_today() + (v_days - 1)
   where id = p_membership_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_resume_subscription(uuid) from public;
grant execute on function public.admin_resume_subscription(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Cancel: terminal.
-- -----------------------------------------------------------------------------
create or replace function public.admin_cancel_subscription(p_membership_id uuid)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.memberships;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  select * into v_row from public.memberships where id = p_membership_id for update;
  if not found then
    raise exception 'Subscription not found' using errcode = 'P0002';
  end if;
  if v_row.subscription_status = 'cancelled' then
    raise exception 'This subscription is already cancelled' using errcode = '22023';
  end if;

  update public.memberships
     set subscription_status = 'cancelled',
         paused_at = null,
         paused_remaining_days = null
   where id = p_membership_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_cancel_subscription(uuid) from public;
grant execute on function public.admin_cancel_subscription(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Change plan: cancel the current subscription and start a new one today.
-- -----------------------------------------------------------------------------
create or replace function public.admin_change_subscription_plan(
  p_membership_id uuid,
  p_plan_id uuid
)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.memberships;
  v_plan public.membership_plans;
  v_row public.memberships;
  v_today date := public.gym_today();
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  select * into v_old from public.memberships where id = p_membership_id for update;
  if not found then
    raise exception 'Subscription not found' using errcode = 'P0002';
  end if;
  if v_old.subscription_status not in ('active', 'paused') then
    raise exception 'Only active or paused subscriptions can change plans'
      using errcode = '22023';
  end if;

  select * into v_plan from public.membership_plans where id = p_plan_id;
  if not found then
    raise exception 'Membership plan not found' using errcode = 'P0002';
  end if;
  if not v_plan.is_active then
    raise exception 'This membership plan is inactive' using errcode = '22023';
  end if;
  if v_plan.id = v_old.plan_id then
    raise exception 'This subscription is already on that plan' using errcode = '22023';
  end if;

  update public.memberships
     set subscription_status = 'cancelled',
         paused_at = null,
         paused_remaining_days = null
   where id = p_membership_id;

  insert into public.memberships (
    client_id, plan_id, start_date, end_date, subscription_status, price_at_assignment
  )
  values (
    v_old.client_id,
    v_plan.id,
    v_today,
    v_today + (v_plan.duration_days - 1),
    'active',
    v_plan.price
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_change_subscription_plan(uuid, uuid) from public;
grant execute on function public.admin_change_subscription_plan(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Admin directory views (security_invoker keeps RLS in force).
-- -----------------------------------------------------------------------------
create or replace view public.admin_plan_directory
with (security_invoker = true)
as
select
  pl.id,
  pl.name,
  pl.description,
  pl.duration_days,
  pl.price,
  pl.is_active,
  pl.created_at,
  pl.updated_at,
  coalesce(live.count, 0)     as live_subscribers,
  coalesce(all_time.count, 0) as total_subscribers
from public.membership_plans pl
left join lateral (
  select count(*)::int as count
  from public.memberships m
  where m.plan_id = pl.id
    and m.subscription_status in ('active', 'paused')
) live on true
left join lateral (
  select count(*)::int as count
  from public.memberships m
  where m.plan_id = pl.id
) all_time on true;

revoke all on public.admin_plan_directory from anon;
grant select on public.admin_plan_directory to authenticated;

create or replace view public.admin_subscription_directory
with (security_invoker = true)
as
select
  m.id,
  m.client_id,
  m.plan_id,
  m.start_date,
  m.end_date,
  m.subscription_status,
  m.paused_at,
  m.paused_remaining_days,
  m.price_at_assignment,
  m.created_at,
  m.updated_at,
  p.email,
  p.account_status,
  p.membership_status,
  cd.display_name,
  cd.member_code,
  pl.name          as plan_name,
  pl.duration_days as plan_duration_days,
  pl.price         as plan_price,
  coalesce(pay.paid_amount, 0)    as paid_amount,
  coalesce(pay.pending_amount, 0) as pending_amount,
  coalesce(pay.payment_count, 0)  as payment_count
from public.memberships m
join public.profiles p on p.id = m.client_id
left join public.client_details cd on cd.client_id = m.client_id
join public.membership_plans pl on pl.id = m.plan_id
left join lateral (
  select
    sum(case when pay.payment_status = 'paid' then pay.amount else 0 end) as paid_amount,
    sum(case when pay.payment_status = 'pending' then pay.amount else 0 end) as pending_amount,
    count(*)::int as payment_count
  from public.payments pay
  where pay.membership_id = m.id
) pay on true;

revoke all on public.admin_subscription_directory from anon;
grant select on public.admin_subscription_directory to authenticated;

create or replace view public.admin_payments_directory
with (security_invoker = true)
as
select
  pay.id,
  pay.membership_id,
  pay.amount,
  pay.payment_date,
  pay.payment_method,
  pay.payment_status,
  pay.reference_number,
  pay.recorded_by,
  pay.created_at,
  m.client_id,
  m.subscription_status,
  m.start_date,
  m.end_date,
  p.email,
  cd.display_name,
  cd.member_code,
  pl.name as plan_name
from public.payments pay
join public.memberships m on m.id = pay.membership_id
join public.profiles p on p.id = m.client_id
left join public.client_details cd on cd.client_id = m.client_id
join public.membership_plans pl on pl.id = m.plan_id;

revoke all on public.admin_payments_directory from anon;
grant select on public.admin_payments_directory to authenticated;
