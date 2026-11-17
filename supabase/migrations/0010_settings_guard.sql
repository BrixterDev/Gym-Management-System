-- =============================================================================
-- GymTrack — 0010_settings_guard.sql
-- Phase 7: harden the singleton gym settings row.
--
-- RLS already restricts writes to approved admins. This migration adds
-- server-side validation so a malformed timezone or QR URL can never break
-- attendance dates, membership validity, or printed QR codes. Changes are
-- written to audit_logs.
-- =============================================================================

create or replace function public.gym_settings_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.timezone := btrim(coalesce(new.timezone, ''));

  if new.timezone = '' then
    raise exception 'Timezone is required' using errcode = '22023';
  end if;

  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown timezone: %', new.timezone using errcode = '22023';
  end if;

  new.client_qr_url := nullif(btrim(coalesce(new.client_qr_url, '')), '');
  new.admin_qr_url := nullif(btrim(coalesce(new.admin_qr_url, '')), '');

  if new.client_qr_url is not null
     and new.client_qr_url !~* '^https?://[^\s]+$' then
    raise exception 'Client QR URL must start with http:// or https://' using errcode = '22023';
  end if;

  if new.admin_qr_url is not null
     and new.admin_qr_url !~* '^https?://[^\s]+$' then
    raise exception 'Admin QR URL must start with http:// or https://' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_gym_settings on public.gym_settings;
create trigger guard_gym_settings
  before insert or update on public.gym_settings
  for each row execute function public.gym_settings_guard();

drop trigger if exists audit_gym_settings_changes on public.gym_settings;
create trigger audit_gym_settings_changes
  after insert or update or delete on public.gym_settings
  for each row execute function public.audit_table_changes();

comment on function public.gym_settings_guard() is
  'Validates the gym timezone against pg_timezone_names and enforces http(s) QR URLs.';
