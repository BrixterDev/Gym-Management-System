-- =============================================================================
-- Phase 3 extension: record a payment atomically with a subscription.
--
-- Both functions wrap the existing trusted lifecycle RPCs and insert the
-- payment in the same transaction. Any failure rolls everything back, so a
-- membership can never be created without the payment the admin submitted.
-- =============================================================================

create or replace function public.admin_create_subscription_with_payment(
  p_client_id uuid,
  p_plan_id uuid,
  p_start_date date,
  p_amount numeric,
  p_payment_method text,
  p_payment_status text,
  p_payment_date timestamptz,
  p_reference_number text default null
)
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

  if p_amount is null or p_amount < 0 then
    raise exception 'Payment amount must be zero or more' using errcode = '22023';
  end if;
  if p_payment_method not in ('cash', 'gcash', 'card', 'bank_transfer') then
    raise exception 'Invalid payment method' using errcode = '22023';
  end if;
  if p_payment_status not in ('paid', 'pending', 'failed', 'refunded') then
    raise exception 'Invalid payment status' using errcode = '22023';
  end if;

  v_row := public.admin_create_subscription(p_client_id, p_plan_id, p_start_date);

  insert into public.payments (
    membership_id,
    amount,
    payment_method,
    payment_status,
    payment_date,
    reference_number
  )
  values (
    v_row.id,
    p_amount,
    p_payment_method,
    p_payment_status,
    coalesce(p_payment_date, now()),
    nullif(btrim(coalesce(p_reference_number, '')), '')
  );

  return v_row;
end;
$$;

revoke all on function public.admin_create_subscription_with_payment(
  uuid, uuid, date, numeric, text, text, timestamptz, text
) from public;
grant execute on function public.admin_create_subscription_with_payment(
  uuid, uuid, date, numeric, text, text, timestamptz, text
) to authenticated;

create or replace function public.admin_renew_subscription_with_payment(
  p_membership_id uuid,
  p_plan_id uuid,
  p_start_date date,
  p_amount numeric,
  p_payment_method text,
  p_payment_status text,
  p_payment_date timestamptz,
  p_reference_number text default null
)
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

  if p_amount is null or p_amount < 0 then
    raise exception 'Payment amount must be zero or more' using errcode = '22023';
  end if;
  if p_payment_method not in ('cash', 'gcash', 'card', 'bank_transfer') then
    raise exception 'Invalid payment method' using errcode = '22023';
  end if;
  if p_payment_status not in ('paid', 'pending', 'failed', 'refunded') then
    raise exception 'Invalid payment status' using errcode = '22023';
  end if;

  v_row := public.admin_renew_subscription(p_membership_id, p_plan_id, p_start_date);

  insert into public.payments (
    membership_id,
    amount,
    payment_method,
    payment_status,
    payment_date,
    reference_number
  )
  values (
    v_row.id,
    p_amount,
    p_payment_method,
    p_payment_status,
    coalesce(p_payment_date, now()),
    nullif(btrim(coalesce(p_reference_number, '')), '')
  );

  return v_row;
end;
$$;

revoke all on function public.admin_renew_subscription_with_payment(
  uuid, uuid, date, numeric, text, text, timestamptz, text
) from public;
grant execute on function public.admin_renew_subscription_with_payment(
  uuid, uuid, date, numeric, text, text, timestamptz, text
) to authenticated;
