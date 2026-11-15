-- =============================================================================
-- GymTrack — 0003_rls.sql
-- Row Level Security: the real authorization boundary.
-- Pattern: every table is denied by default; permissive policies are explicit.
-- =============================================================================

alter table public.gym_settings    enable row level security;
alter table public.profiles        enable row level security;
alter table public.client_details  enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships     enable row level security;
alter table public.attendance      enable row level security;
alter table public.body_metrics    enable row level security;
alter table public.payments        enable row level security;
alter table public.audit_logs      enable row level security;

-- Remove any permissive baseline grants; RLS still governs, but least privilege
-- is enforced at the grant layer too.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- -----------------------------------------------------------------------------
-- gym_settings
-- -----------------------------------------------------------------------------
drop policy if exists gym_settings_select_authenticated on public.gym_settings;
create policy gym_settings_select_authenticated
  on public.gym_settings for select
  to authenticated
  using (true);

drop policy if exists gym_settings_admin_all on public.gym_settings;
create policy gym_settings_admin_all
  on public.gym_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists profiles_update_own_phone on public.profiles;
create policy profiles_update_own_phone
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- client_details
-- -----------------------------------------------------------------------------
drop policy if exists client_details_select_own on public.client_details;
create policy client_details_select_own
  on public.client_details for select
  to authenticated
  using (client_id = auth.uid());

drop policy if exists client_details_admin_all on public.client_details;
create policy client_details_admin_all
  on public.client_details for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- membership_plans
-- -----------------------------------------------------------------------------
drop policy if exists membership_plans_select_active on public.membership_plans;
create policy membership_plans_select_active
  on public.membership_plans for select
  to authenticated
  using (is_active or public.is_admin());

drop policy if exists membership_plans_admin_all on public.membership_plans;
create policy membership_plans_admin_all
  on public.membership_plans for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- memberships
-- -----------------------------------------------------------------------------
drop policy if exists memberships_select_own on public.memberships;
create policy memberships_select_own
  on public.memberships for select
  to authenticated
  using (client_id = auth.uid());

drop policy if exists memberships_admin_all on public.memberships;
create policy memberships_admin_all
  on public.memberships for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- attendance (reads only for clients; writes go through RPCs)
-- -----------------------------------------------------------------------------
drop policy if exists attendance_select_own on public.attendance;
create policy attendance_select_own
  on public.attendance for select
  to authenticated
  using (client_id = auth.uid());

drop policy if exists attendance_admin_all on public.attendance;
create policy attendance_admin_all
  on public.attendance for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- body_metrics
-- -----------------------------------------------------------------------------
drop policy if exists body_metrics_select_own on public.body_metrics;
create policy body_metrics_select_own
  on public.body_metrics for select
  to authenticated
  using (client_id = auth.uid());

drop policy if exists body_metrics_insert_own on public.body_metrics;
create policy body_metrics_insert_own
  on public.body_metrics for insert
  to authenticated
  with check (client_id = auth.uid() and recorded_by = auth.uid());

drop policy if exists body_metrics_update_own on public.body_metrics;
create policy body_metrics_update_own
  on public.body_metrics for update
  to authenticated
  using (client_id = auth.uid() and recorded_by = auth.uid())
  with check (client_id = auth.uid() and recorded_by = auth.uid());

drop policy if exists body_metrics_delete_own on public.body_metrics;
create policy body_metrics_delete_own
  on public.body_metrics for delete
  to authenticated
  using (client_id = auth.uid() and recorded_by = auth.uid());

drop policy if exists body_metrics_admin_all on public.body_metrics;
create policy body_metrics_admin_all
  on public.body_metrics for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- payments (clients read only through their memberships)
-- -----------------------------------------------------------------------------
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.id = payments.membership_id
        and m.client_id = auth.uid()
    )
  );

drop policy if exists payments_admin_all on public.payments;
create policy payments_admin_all
  on public.payments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- audit_logs (admin read-only; writes only via SECURITY DEFINER functions)
-- -----------------------------------------------------------------------------
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());
