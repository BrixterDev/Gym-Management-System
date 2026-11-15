-- =============================================================================
-- GymTrack — seed.sql
-- Safe to re-run. Idempotent.
--
-- 1. Creates the singleton gym_settings row.
-- 2. Provisions the first admin directly in auth.users (no public signup path).
--
-- CHANGE THE ADMIN EMAIL + PASSWORD BELOW before running in production.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Gym settings (single row)
-- -----------------------------------------------------------------------------
insert into public.gym_settings (timezone)
select 'Asia/Manila'
where not exists (select 1 from public.gym_settings);

-- -----------------------------------------------------------------------------
-- First admin
-- -----------------------------------------------------------------------------
do $$
declare
  v_email    text := 'admin@gymtrack.local';
  v_password text := 'GymTrack#2026';
  v_user_id  uuid;
begin
  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  end if;

  -- The auth trigger created a pending client profile — promote it.
  insert into public.profiles (id, email, role, account_status, membership_status)
  values (v_user_id, v_email, 'admin', 'approved', 'non-member')
  on conflict (id) do update
    set role = 'admin',
        account_status = 'approved',
        email = excluded.email;

  insert into public.client_details (client_id)
  values (v_user_id)
  on conflict (client_id) do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Optional demo plans (comment out in production if undesired)
-- -----------------------------------------------------------------------------
insert into public.membership_plans (name, description, duration_days, price)
values
  ('Monthly', '30 days of full gym access', 30, 1500.00),
  ('Quarterly', '90 days of full gym access', 90, 4000.00),
  ('Annual', '365 days of full gym access', 365, 14000.00)
on conflict ((lower(name))) do nothing;
