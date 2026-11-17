-- =============================================================================
-- GymTrack — 0009_reports.sql
-- Phase 6: admin analytics, date-range reporting, and CSV export feeds.
--
-- Aggregates span multiple RLS-protected tables, so they are exposed as
-- SECURITY DEFINER functions with an explicit admin check. Date ranges are
-- interpreted in the gym's configured timezone, and every entry point rejects
-- reversed or oversized ranges. Row-level exports are capped so a single
-- request can never stream the entire history.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shared range validation (also guards against non-admin callers).
-- -----------------------------------------------------------------------------
create or replace function public.admin_validate_report_range(
  p_from date,
  p_to date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  if p_from is null or p_to is null then
    raise exception 'A start and end date are required' using errcode = '22023';
  end if;

  if p_from > p_to then
    raise exception 'Start date must be on or before the end date' using errcode = '22023';
  end if;

  if p_to - p_from > 366 then
    raise exception 'Date range cannot exceed 366 days' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.admin_validate_report_range(date, date) from public;
revoke all on function public.admin_validate_report_range(date, date) from anon;
grant execute on function public.admin_validate_report_range(date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Period summary with previous-period comparisons.
-- -----------------------------------------------------------------------------
create or replace function public.admin_report_summary(p_from date, p_to date)
returns table (
  revenue_paid numeric,
  revenue_pending numeric,
  revenue_refunded numeric,
  paid_payments integer,
  visits integer,
  unique_visitors integer,
  avg_visit_minutes integer,
  active_members integer,
  new_members integer,
  expiring_soon integer,
  prev_revenue_paid numeric,
  prev_visits integer,
  prev_new_members integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_today date;
  v_days integer;
  v_prev_from date;
  v_prev_to date;
begin
  perform public.admin_validate_report_range(p_from, p_to);

  select gs.timezone, public.gym_today()
    into v_tz, v_today
    from public.gym_settings gs
   limit 1;

  v_days := p_to - p_from;
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_days;

  return query
  select
    coalesce((
      select sum(pay.amount)
        from public.payments pay
       where pay.payment_status = 'paid'
         and (pay.payment_date at time zone v_tz)::date between p_from and p_to
    ), 0)::numeric as revenue_paid,
    coalesce((
      select sum(pay.amount)
        from public.payments pay
       where pay.payment_status = 'pending'
         and (pay.payment_date at time zone v_tz)::date between p_from and p_to
    ), 0)::numeric as revenue_pending,
    coalesce((
      select sum(pay.amount)
        from public.payments pay
       where pay.payment_status = 'refunded'
         and (pay.payment_date at time zone v_tz)::date between p_from and p_to
    ), 0)::numeric as revenue_refunded,
    (
      select count(*)::int
        from public.payments pay
       where pay.payment_status = 'paid'
         and (pay.payment_date at time zone v_tz)::date between p_from and p_to
    ) as paid_payments,
    (
      select count(*)::int
        from public.attendance a
       where (a.time_in at time zone v_tz)::date between p_from and p_to
    ) as visits,
    (
      select count(distinct a.client_id)::int
        from public.attendance a
       where (a.time_in at time zone v_tz)::date between p_from and p_to
    ) as unique_visitors,
    (
      select round(avg(extract(epoch from (a.time_out - a.time_in)) / 60))::int
        from public.attendance a
       where a.time_out is not null
         and (a.time_in at time zone v_tz)::date between p_from and p_to
    ) as avg_visit_minutes,
    (
      select count(distinct m.client_id)::int
        from public.memberships m
       where m.subscription_status = 'active'
    ) as active_members,
    (
      select count(distinct m.client_id)::int
        from public.memberships m
       where m.start_date between p_from and p_to
    ) as new_members,
    (
      select count(distinct m.client_id)::int
        from public.memberships m
       where m.subscription_status = 'active'
         and m.end_date between v_today and v_today + 7
    ) as expiring_soon,
    coalesce((
      select sum(pay.amount)
        from public.payments pay
       where pay.payment_status = 'paid'
         and (pay.payment_date at time zone v_tz)::date between v_prev_from and v_prev_to
    ), 0)::numeric as prev_revenue_paid,
    (
      select count(*)::int
        from public.attendance a
       where (a.time_in at time zone v_tz)::date between v_prev_from and v_prev_to
    ) as prev_visits,
    (
      select count(distinct m.client_id)::int
        from public.memberships m
       where m.start_date between v_prev_from and v_prev_to
    ) as prev_new_members;
end;
$$;

revoke all on function public.admin_report_summary(date, date) from public;
revoke all on function public.admin_report_summary(date, date) from anon;
grant execute on function public.admin_report_summary(date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Daily revenue series (gap-filled so charts have a continuous axis).
-- -----------------------------------------------------------------------------
create or replace function public.admin_revenue_daily(p_from date, p_to date)
returns table (
  report_date date,
  paid_total numeric,
  pending_total numeric,
  refunded_total numeric,
  paid_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  perform public.admin_validate_report_range(p_from, p_to);

  select gs.timezone into v_tz from public.gym_settings gs limit 1;

  return query
  select
    d::date as report_date,
    coalesce(sum(pay.amount) filter (where pay.payment_status = 'paid'), 0)::numeric,
    coalesce(sum(pay.amount) filter (where pay.payment_status = 'pending'), 0)::numeric,
    coalesce(sum(pay.amount) filter (where pay.payment_status = 'refunded'), 0)::numeric,
    count(pay.id) filter (where pay.payment_status = 'paid')::int
  from generate_series(p_from, p_to, interval '1 day') as d
  left join public.payments pay
    on (pay.payment_date at time zone v_tz)::date = d::date
  group by d
  order by d;
end;
$$;

revoke all on function public.admin_revenue_daily(date, date) from public;
revoke all on function public.admin_revenue_daily(date, date) from anon;
grant execute on function public.admin_revenue_daily(date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Daily attendance series.
-- -----------------------------------------------------------------------------
create or replace function public.admin_attendance_daily(p_from date, p_to date)
returns table (
  report_date date,
  visits integer,
  unique_visitors integer,
  avg_minutes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  perform public.admin_validate_report_range(p_from, p_to);

  select gs.timezone into v_tz from public.gym_settings gs limit 1;

  return query
  select
    d::date as report_date,
    count(a.id)::int,
    count(distinct a.client_id)::int,
    round(avg(extract(epoch from (a.time_out - a.time_in)) / 60)
      filter (where a.time_out is not null))::int
  from generate_series(p_from, p_to, interval '1 day') as d
  left join public.attendance a
    on (a.time_in at time zone v_tz)::date = d::date
  group by d
  order by d;
end;
$$;

revoke all on function public.admin_attendance_daily(date, date) from public;
revoke all on function public.admin_attendance_daily(date, date) from anon;
grant execute on function public.admin_attendance_daily(date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Paid revenue by payment method.
-- -----------------------------------------------------------------------------
create or replace function public.admin_payment_method_breakdown(p_from date, p_to date)
returns table (
  payment_method text,
  payment_count integer,
  total_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  perform public.admin_validate_report_range(p_from, p_to);

  select gs.timezone into v_tz from public.gym_settings gs limit 1;

  return query
  select
    pay.payment_method,
    count(*)::int,
    sum(pay.amount)::numeric
  from public.payments pay
  where pay.payment_status = 'paid'
    and (pay.payment_date at time zone v_tz)::date between p_from and p_to
  group by pay.payment_method
  order by sum(pay.amount) desc;
end;
$$;

revoke all on function public.admin_payment_method_breakdown(date, date) from public;
revoke all on function public.admin_payment_method_breakdown(date, date) from anon;
grant execute on function public.admin_payment_method_breakdown(date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Plan performance in the selected period.
-- -----------------------------------------------------------------------------
create or replace function public.admin_plan_performance(p_from date, p_to date)
returns table (
  plan_name text,
  new_memberships integer,
  active_members integer,
  revenue numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  perform public.admin_validate_report_range(p_from, p_to);

  select gs.timezone into v_tz from public.gym_settings gs limit 1;

  return query
  select
    pl.name,
    coalesce(started.total, 0)::int,
    coalesce(live.total, 0)::int,
    coalesce(revenue.total, 0)::numeric
  from public.membership_plans pl
  left join lateral (
    select count(*)::int as total
      from public.memberships m
     where m.plan_id = pl.id
       and m.start_date between p_from and p_to
  ) started on true
  left join lateral (
    select count(distinct m.client_id)::int as total
      from public.memberships m
     where m.plan_id = pl.id
       and m.subscription_status = 'active'
  ) live on true
  left join lateral (
    select sum(pay.amount) as total
      from public.payments pay
      join public.memberships m on m.id = pay.membership_id
     where m.plan_id = pl.id
       and pay.payment_status = 'paid'
       and (pay.payment_date at time zone v_tz)::date between p_from and p_to
  ) revenue on true
  order by coalesce(revenue.total, 0) desc, pl.name;
end;
$$;

revoke all on function public.admin_plan_performance(date, date) from public;
revoke all on function public.admin_plan_performance(date, date) from anon;
grant execute on function public.admin_plan_performance(date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Row-level export feeds. Capped at 20,000 rows per request.
-- -----------------------------------------------------------------------------
create or replace function public.admin_export_payments(p_from date, p_to date)
returns table (
  payment_date timestamptz,
  paid_on date,
  display_name text,
  member_code text,
  email text,
  plan_name text,
  amount numeric,
  payment_method text,
  payment_status text,
  reference_number text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  perform public.admin_validate_report_range(p_from, p_to);

  select gs.timezone into v_tz from public.gym_settings gs limit 1;

  return query
  select
    pay.payment_date,
    (pay.payment_date at time zone v_tz)::date,
    cd.display_name,
    cd.member_code,
    p.email,
    pl.name,
    pay.amount,
    pay.payment_method,
    pay.payment_status,
    pay.reference_number
  from public.payments pay
  join public.memberships m on m.id = pay.membership_id
  join public.profiles p on p.id = m.client_id
  left join public.client_details cd on cd.client_id = m.client_id
  join public.membership_plans pl on pl.id = m.plan_id
  where (pay.payment_date at time zone v_tz)::date between p_from and p_to
  order by pay.payment_date desc
  limit 20000;
end;
$$;

revoke all on function public.admin_export_payments(date, date) from public;
revoke all on function public.admin_export_payments(date, date) from anon;
grant execute on function public.admin_export_payments(date, date) to authenticated;

create or replace function public.admin_export_attendance(p_from date, p_to date)
returns table (
  visit_date date,
  display_name text,
  member_code text,
  email text,
  time_in timestamptz,
  time_out timestamptz,
  duration_minutes integer,
  visit_state text,
  plan_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  perform public.admin_validate_report_range(p_from, p_to);

  select gs.timezone into v_tz from public.gym_settings gs limit 1;

  return query
  select
    (a.time_in at time zone v_tz)::date,
    cd.display_name,
    cd.member_code,
    p.email,
    a.time_in,
    a.time_out,
    case
      when a.time_out is null then null
      else round(extract(epoch from (a.time_out - a.time_in)) / 60)::int
    end,
    case when a.time_out is null then 'open' else 'closed' end,
    pl.name
  from public.attendance a
  join public.profiles p on p.id = a.client_id
  left join public.client_details cd on cd.client_id = a.client_id
  left join lateral (
    select m.plan_id
      from public.memberships m
     where m.client_id = a.client_id
     order by m.start_date desc, m.created_at desc
     limit 1
  ) m on true
  left join public.membership_plans pl on pl.id = m.plan_id
  where (a.time_in at time zone v_tz)::date between p_from and p_to
  order by a.time_in desc
  limit 20000;
end;
$$;

revoke all on function public.admin_export_attendance(date, date) from public;
revoke all on function public.admin_export_attendance(date, date) from anon;
grant execute on function public.admin_export_attendance(date, date) to authenticated;

create or replace function public.admin_export_memberships(p_from date, p_to date)
returns table (
  display_name text,
  member_code text,
  email text,
  plan_name text,
  start_date date,
  end_date date,
  subscription_status text,
  price_at_assignment numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_validate_report_range(p_from, p_to);

  return query
  select
    cd.display_name,
    cd.member_code,
    p.email,
    pl.name,
    m.start_date,
    m.end_date,
    m.subscription_status,
    m.price_at_assignment
  from public.memberships m
  join public.profiles p on p.id = m.client_id
  left join public.client_details cd on cd.client_id = m.client_id
  join public.membership_plans pl on pl.id = m.plan_id
  where m.start_date between p_from and p_to
  order by m.start_date desc, m.created_at desc
  limit 20000;
end;
$$;

revoke all on function public.admin_export_memberships(date, date) from public;
revoke all on function public.admin_export_memberships(date, date) from anon;
grant execute on function public.admin_export_memberships(date, date) to authenticated;

comment on function public.admin_report_summary(date, date) is
  'Admin-only period KPIs with previous-period comparison, interpreted in the gym timezone.';
comment on function public.admin_export_payments(date, date) is
  'Admin-only CSV feed for payments in a gym-local date range (max 20,000 rows).';
