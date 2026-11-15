-- =============================================================================
-- GymTrack — 0004_admin_clients.sql
-- Phase 2: admin client directory view, audited account status changes,
-- audit triggers for admin-managed identity data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Directory view: one row per client with profile + identity details.
-- security_invoker keeps the caller's RLS active (admins see all, clients self).
-- -----------------------------------------------------------------------------
create or replace view public.admin_client_directory
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
  cd.updated_at    as detail_updated_at
from public.profiles p
left join public.client_details cd on cd.client_id = p.id
where p.role = 'client';

revoke all on public.admin_client_directory from anon;
grant select on public.admin_client_directory to authenticated;

comment on view public.admin_client_directory is
  'Admin client management directory. RLS of profiles/client_details applies via security_invoker.';

-- -----------------------------------------------------------------------------
-- Generic audit trigger (SECURITY DEFINER so it can write audit_logs, which has
-- no client insert policy). Attached to admin-managed tables below.
-- -----------------------------------------------------------------------------
create or replace function public.audit_table_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_id     uuid;
begin
  if tg_op <> 'INSERT' then
    v_before := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    v_after := to_jsonb(new);
  end if;

  v_id := coalesce((v_after ->> 'id')::uuid, (v_before ->> 'id')::uuid);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (auth.uid(), lower(tg_op), tg_table_name, v_id, v_before, v_after);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists audit_client_details_changes on public.client_details;
create trigger audit_client_details_changes
  after insert or update or delete on public.client_details
  for each row execute function public.audit_table_changes();

drop trigger if exists audit_profiles_changes on public.profiles;
create trigger audit_profiles_changes
  after update on public.profiles
  for each row execute function public.audit_table_changes();

-- -----------------------------------------------------------------------------
-- Audited account status transitions. Admin-only, client accounts only,
-- never self-modification of an admin account.
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_account_status(
  p_client_id uuid,
  p_status text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  if p_status not in ('pending', 'approved', 'rejected', 'suspended') then
    raise exception 'Invalid account status: %', p_status using errcode = '22023';
  end if;

  select * into v_profile
    from public.profiles
   where id = p_client_id
   for update;

  if not found then
    raise exception 'Client not found' using errcode = 'P0002';
  end if;

  if v_profile.role <> 'client' then
    raise exception 'Only client accounts can be moderated' using errcode = '42501';
  end if;

  update public.profiles
     set account_status = p_status
   where id = p_client_id
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.admin_set_account_status(uuid, text) from public;
grant execute on function public.admin_set_account_status(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Convenience: pending approval count for the admin nav badge (admin-safe;
-- clients get 0 because the view is RLS-filtered).
-- -----------------------------------------------------------------------------
create or replace function public.pending_approval_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::int
  from public.admin_client_directory
  where account_status = 'pending';
$$;

revoke all on function public.pending_approval_count() from public;
grant execute on function public.pending_approval_count() to authenticated;
