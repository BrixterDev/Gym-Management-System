-- =============================================================================
-- GymTrack — 0001_init.sql
-- Core schema: tables, constraints, indexes, updated_at triggers.
-- Run order: 0001_init -> 0002_functions -> 0003_rls
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- gym_settings (singleton row)
-- -----------------------------------------------------------------------------
create table if not exists public.gym_settings (
  id uuid primary key default gen_random_uuid(),
  timezone text not null default 'Asia/Manila'
    check (length(trim(timezone)) > 0),
  client_qr_url text,
  admin_qr_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce a single settings row at the database level.
create unique index if not exists gym_settings_singleton_idx
  on public.gym_settings ((true));

-- -----------------------------------------------------------------------------
-- profiles (1:1 with auth.users; credentials stay in auth)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  phone text,
  role text not null default 'client'
    check (role in ('admin', 'client')),
  account_status text not null default 'pending'
    check (account_status in ('pending', 'approved', 'rejected', 'suspended')),
  membership_status text not null default 'non-member'
    check (membership_status in ('non-member', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_account_status_idx on public.profiles (account_status);
create unique index if not exists profiles_email_lower_idx on public.profiles (lower(email));

-- -----------------------------------------------------------------------------
-- client_details (admin-managed identity; replaces full_name on profiles)
-- -----------------------------------------------------------------------------
create table if not exists public.client_details (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.profiles (id) on delete cascade,
  display_name text,
  member_code text unique,
  height_cm numeric(5, 2) check (height_cm is null or (height_cm > 0 and height_cm < 350)),
  date_of_birth date,
  emergency_contact text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_details_display_name_idx
  on public.client_details (lower(display_name));

-- -----------------------------------------------------------------------------
-- membership_plans
-- -----------------------------------------------------------------------------
create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  duration_days integer not null check (duration_days > 0 and duration_days <= 3650),
  price numeric(12, 2) not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists membership_plans_name_lower_idx
  on public.membership_plans (lower(name));

-- -----------------------------------------------------------------------------
-- memberships (subscriptions)
-- -----------------------------------------------------------------------------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete restrict,
  plan_id uuid not null references public.membership_plans (id) on delete restrict,
  start_date date not null,
  end_date date not null,
  subscription_status text not null default 'active'
    check (subscription_status in ('active', 'expired', 'cancelled', 'paused')),
  paused_at timestamptz,
  paused_remaining_days integer
    check (paused_remaining_days is null or paused_remaining_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_date_range_check check (end_date >= start_date),
  constraint memberships_paused_fields_check check (
    (subscription_status = 'paused' and paused_at is not null)
    or (subscription_status <> 'paused')
  ),
  -- Price is snapshotted at assignment time so plan edits never rewrite history.
  price_at_assignment numeric(12, 2) not null default 0 check (price_at_assignment >= 0)
);

create index if not exists memberships_client_idx on public.memberships (client_id);
create index if not exists memberships_status_idx on public.memberships (subscription_status);
create index if not exists memberships_end_date_idx on public.memberships (end_date);
create index if not exists memberships_plan_idx on public.memberships (plan_id);

-- A client may hold only one Active or Paused subscription at a time.
create unique index if not exists memberships_one_live_per_client_idx
  on public.memberships (client_id)
  where subscription_status in ('active', 'paused');

-- -----------------------------------------------------------------------------
-- attendance
-- -----------------------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete restrict,
  time_in timestamptz not null default now(),
  time_out timestamptz,
  expired_during_session boolean not null default false,
  created_at timestamptz not null default now(),
  constraint attendance_time_order_check check (time_out is null or time_out > time_in)
);

create index if not exists attendance_client_time_in_idx
  on public.attendance (client_id, time_in desc);
create index if not exists attendance_time_in_idx
  on public.attendance (time_in desc);

-- At most one open session per client (also guards concurrent check-ins).
create unique index if not exists attendance_one_open_session_idx
  on public.attendance (client_id)
  where time_out is null;

-- -----------------------------------------------------------------------------
-- body_metrics
-- -----------------------------------------------------------------------------
create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric(5, 2) check (weight_kg is null or (weight_kg > 0 and weight_kg < 500)),
  height_cm numeric(5, 2) check (height_cm is null or (height_cm > 0 and height_cm < 350)),
  waist_cm numeric(5, 2) check (waist_cm is null or (waist_cm > 0 and waist_cm < 500)),
  notes text,
  recorded_by uuid not null default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_metrics_has_value_check check (
    weight_kg is not null or height_cm is not null or waist_cm is not null
  )
);

create index if not exists body_metrics_client_measured_idx
  on public.body_metrics (client_id, measured_at desc);

-- -----------------------------------------------------------------------------
-- payments
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_date timestamptz not null default now(),
  payment_method text not null
    check (payment_method in ('cash', 'gcash', 'card', 'bank_transfer')),
  payment_status text not null default 'paid'
    check (payment_status in ('paid', 'pending', 'failed', 'refunded')),
  reference_number text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payments_membership_idx on public.payments (membership_id);
create index if not exists payments_date_idx on public.payments (payment_date desc);
create index if not exists payments_status_idx on public.payments (payment_status);

-- -----------------------------------------------------------------------------
-- audit_logs
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.gym_settings;
create trigger set_updated_at before update on public.gym_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.client_details;
create trigger set_updated_at before update on public.client_details
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.membership_plans;
create trigger set_updated_at before update on public.membership_plans
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.memberships;
create trigger set_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.body_metrics;
create trigger set_updated_at before update on public.body_metrics
  for each row execute function public.set_updated_at();
