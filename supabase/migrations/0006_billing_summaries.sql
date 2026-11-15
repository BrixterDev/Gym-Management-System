-- =============================================================================
-- GymTrack — 0006_billing_summaries.sql
-- Aggregate views for subscription and payment summaries (RLS-safe).
-- =============================================================================

create or replace view public.admin_payment_summary
with (security_invoker = true)
as
select
  pay.payment_status,
  count(*)::int                as payment_count,
  coalesce(sum(pay.amount), 0) as total_amount
from public.payments pay
group by pay.payment_status;

revoke all on public.admin_payment_summary from anon;
grant select on public.admin_payment_summary to authenticated;

create or replace view public.admin_subscription_summary
with (security_invoker = true)
as
select
  m.subscription_status,
  count(*)::int as subscription_count
from public.memberships m
group by m.subscription_status;

revoke all on public.admin_subscription_summary from anon;
grant select on public.admin_subscription_summary to authenticated;
