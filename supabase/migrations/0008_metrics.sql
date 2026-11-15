-- =============================================================================
-- GymTrack — 0008_metrics.sql
-- Phase 5: body metrics audit trail + RLS-safe directory view with BMI.
--
-- body_metrics already has ownership guards and RLS from Phases 1–2:
--   - clients may only create/edit/delete rows they recorded for themselves
--   - admin-recorded rows are read-only to the member
--   - admin-recorded measurements stay attributed to the admin
-- This migration adds auditing and a joined view for the UI.
-- =============================================================================

drop trigger if exists audit_body_metrics_changes on public.body_metrics;
create trigger audit_body_metrics_changes
  after insert or update or delete on public.body_metrics
  for each row execute function public.audit_table_changes();

create or replace view public.admin_body_metrics_directory
with (security_invoker = true)
as
select
  bm.id,
  bm.client_id,
  p.email,
  cd.display_name,
  cd.member_code,
  bm.measured_at,
  bm.weight_kg,
  bm.height_cm,
  bm.waist_cm,
  case
    when bm.weight_kg is not null
      and bm.height_cm is not null
      and bm.height_cm > 0
    then round(bm.weight_kg / ((bm.height_cm / 100) ^ 2), 1)
  end as bmi,
  bm.notes,
  bm.recorded_by,
  rp.email as recorded_by_email,
  bm.created_at,
  bm.updated_at
from public.body_metrics bm
join public.profiles p on p.id = bm.client_id
left join public.client_details cd on cd.client_id = bm.client_id
left join public.profiles rp on rp.id = bm.recorded_by;

revoke all on public.admin_body_metrics_directory from anon;
grant select on public.admin_body_metrics_directory to authenticated;

comment on view public.admin_body_metrics_directory is
  'Body metric history with member identity and derived BMI. RLS of body_metrics applies via security_invoker.';
