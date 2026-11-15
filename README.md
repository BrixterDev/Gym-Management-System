# GymTrack

A secure, responsive gym management application for gym owners and members.

- **Frontend:** React 19 + Vite + TypeScript (strict) + Tailwind CSS 4 + TanStack Query + Recharts
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security, Edge Functions)
- **Authorization:** enforced in PostgreSQL RLS and trusted `SECURITY DEFINER` functions — never in the UI alone

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Architecture, migrations, RLS, `gym_settings`, authentication | ✅ Complete |
| 2 | Client management, `client_details`, approvals, account status | ✅ Complete |
| 3 | Plans, subscriptions lifecycle, payments | ✅ Complete |
| 4 | Attendance, QR codes, check-in/out, admin corrections | ✅ Complete |
| 5 | Body metrics, self-entry, progress charts | ✅ Complete |
| 6 | Analytics, reports, CSV export | ⏳ Next |
| 7 | Polish, mobile optimization, deployment, acceptance testing | ⏳ |

---

## 1. Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the two values below
npm run dev
```

`.env.local` (never committed):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
```

> Only these two variables reach the browser. The service role key is **never** used in the frontend. Server-side secrets belong in Supabase Edge Function secrets or Vercel environment variables.

## 2. Database setup (Supabase dashboard)

Open **Supabase Dashboard → SQL Editor** and run these files **in order**:

1. `supabase/migrations/0001_init.sql` — tables, constraints, indexes, triggers
2. `supabase/migrations/0002_functions.sql` — role helpers, auth triggers, guards
3. `supabase/migrations/0003_rls.sql` — Row Level Security policies and grants
4. `supabase/migrations/0004_admin_clients.sql` — client directory view, audited account-status RPC, audit triggers
5. `supabase/migrations/0005_memberships.sql` — subscription lifecycle RPCs, billing audit triggers, admin billing views
6. `supabase/migrations/0006_billing_summaries.sql` — payment and subscription summary views
7. `supabase/migrations/0007_attendance.sql` — QR tokens, check-in/out RPCs, admin corrections, attendance views
8. `supabase/migrations/0008_metrics.sql` — body metrics audit trigger + BMI directory view
9. `supabase/seed.sql` — singleton gym settings, first admin, demo plans

Every file is idempotent where practical and safe to re-run.

### Edge Functions

Privileged client creation runs server-side with the service role key:

```bash
supabase functions deploy admin-create-client --project-ref <project-ref>
```

The function verifies the caller's JWT, re-checks `role = 'admin'` and `account_status = 'approved'`
against `profiles`, and only then creates the auth user. No service-role key ever reaches the browser.

### First admin

`supabase/seed.sql` provisions:

- **Email:** `admin@gymtrack.local`
- **Password:** `GymTrack#2026`

**Change these before production.** Either edit the variables at the top of the `DO $$` block, or create the user in **Authentication → Users** and then run:

```sql
update public.profiles
   set role = 'admin', account_status = 'approved'
 where email = 'you@example.com';
```

There is **no public admin registration path**. Self-registration always creates a `client` profile with `account_status = 'pending'`.

### Auth settings

In **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:5173` for development, your Vercel URL in production
- **Redirect URLs:** `http://localhost:5173/login`, `https://<your-app>.vercel.app/login`

If email confirmation is enabled, new members must confirm their email before signing in; the pending-approval screen is shown after that.

## 3. Verify Phase 1

```bash
npm run dev      # http://localhost:5173
npm run build    # tsc strict type-check + production bundle
```

Acceptance checks:

1. Visit `/admin` while signed out → redirected to `/login`, then back to `/admin` after signing in as the seeded admin.
2. Sign in as admin → lands on the admin dashboard; sidebar/bottom nav render at 375px and 1440px.
3. Register a new account at `/register` (email + password only) → profile row created with `role = 'client'`, `account_status = 'pending'`, no name field.
4. The new client sees **Approval pending** and cannot reach `/app` or `/checkin`.
5. In SQL editor, confirm RLS:

```sql
-- as admin (auth.uid() is the admin in a normal session):
select count(*) from public.profiles;

-- impersonation smoke test in SQL editor:
set local role authenticated;
set local request.jwt.claims = '{"sub":"<client-uuid>","role":"authenticated"}';
select * from public.profiles;          -- only the client's own row
update public.profiles set role = 'admin';  -- ERROR: Clients may only update their phone number
reset role;
```

6. `select tablename, rowsecurity from pg_tables where schemaname = 'public';` → `rowsecurity = true` for all nine tables.

### Phase 2 acceptance

1. **Clients page** (`/admin/clients`): search by name/email/member code, filter by account and
   membership status, sort, paginate. Filters reset paging.
2. **Approvals** (`/admin/approvals`): pending registrations listed oldest-first; Approve/Reject
   with confirmation; sidebar shows a live pending badge.
3. **Client profile** (`/admin/clients/:id`): edit display name, member code, phone, DOB, height,
   emergency contact, notes; email is read-only; subscription history shown.
4. **Create client** (Add client): calls the `admin-create-client` Edge Function. The account is
   approved immediately and appears in the directory. Duplicate emails/member codes return a
   clear error and the auth user is rolled back.
5. **Suspend/Reactivate** writes through `admin_set_account_status` and appends `audit_logs`
   rows (`create_client`, `update`). Non-admins calling the RPC or Edge Function get 403.
6. A client reading `admin_client_directory` sees only their own row.

### Phase 3 acceptance

1. **Plans** (`/admin/plans`): create/edit plans with name, duration, price, description.
   Plan names are unique (case-insensitive). Plans with subscriptions cannot be deleted — deactivate
   them instead; inactive plans are hidden from new subscriptions but keep history intact.
2. **Assign a subscription** (`/admin/subscriptions` → New subscription, or Assign plan on a client
   profile): the end date is derived from the plan duration, and the plan price is snapshotted into
   `price_at_assignment`. A second active/paused subscription for the same client is rejected by a
   partial unique index and the RPC guard.
3. **Pause** freezes the remaining days (inclusive of the current day) and blocks check-in later.
   **Resume** extends the end date by the frozen days. **Renew** marks the old subscription
   `expired` and creates a new one (default start: the day after the current end date).
   **Change plan** cancels the old subscription (terminal) and starts the new plan today.
4. **Lazy expiry:** opening Subscriptions calls `admin_refresh_subscriptions()`, which moves active
   subscriptions past `end_date` to `expired`. Dates use `gym_today()` from `gym_settings.timezone`
   (Asia/Manila by default), not the browser clock.
5. **Payments** (`/admin/payments`): record cash/GCash/card/bank-transfer payments against a
   subscription with paid/pending/failed/refunded status, optional reference number, date, and
   amount. Mark pending/failed payments as paid or refund paid payments. Summary cards aggregate
   totals by status. Every write is audited.
6. **Authorization:** plan/payment writes, and all lifecycle RPCs, require an admin and are
   re-checked server-side (`is_admin()`); a client token receives `403`. Members only see their own
   subscription/payment rows through RLS. Client-supplied statuses, prices, and dates are ignored —
   the database derives them.
7. **Verification:** `npm run build` passes strict type-check. Lifecycle E2E tested against the live
   project: assign → duplicate blocked → pause → resume → renew → change plan → cancel → renew
   rejected; inactive plans rejected; client reads scoped to own rows.

### Phase 4 acceptance

1. **Member QR:** every client profile carries a random `client_details.qr_token`. Members see their
   QR on `/checkin`; admins see it on the client profile and can regenerate it (the old token stops
   working immediately).
2. **Member self check-in** (`/checkin`): one tap times in or out. `/app/attendance` lists the
   member's visit history with durations, status, and pagination.
3. **Admin scanner** (`/admin/attendance` → Scan member): camera QR scanning where the browser
   supports `BarcodeDetector`, with manual QR-token/member-code entry as a fallback. One action
   toggles check-in or check-out and shows the member name, code, and time.
4. **Server-side eligibility:** check-in requires an approved account and a subscription that is
   `active` and within `start_date..end_date` (evaluated with `gym_today()`). Paused, cancelled,
   expired, future-dated, and non-approved accounts are rejected by the RPC, not just the UI.
5. **Sessions:** the unique open-session index blocks double check-ins even under concurrency.
   Check-out stamps `time_out` server-side and sets `expired_during_session` if the membership
   lapsed during the visit. Open sessions can also be closed from the admin table.
6. **Admin corrections:** edit time in/out (database validates order and open-session conflicts) or
   delete a record. Every insert/update/delete is written to `audit_logs`. Clients cannot call admin
   attendance RPCs (`403`) and only see their own rows through RLS.
7. **Stats:** today's visits, currently-in-gym, last-7-days visits, and average session length today
   come from `admin_attendance_stats` using the gym timezone.
8. **Verification:** `npm run build` passes. Live E2E passed: self in → double blocked → self out →
   admin in by member code → admin out by QR → paused rejected → cancelled rejected → correction →
   invalid correction rejected → RLS scoping → stats → QR regeneration with old token rejected.

### Phase 5 acceptance

1. **My Progress** (`/app/progress`): members record weight, height, and waist with a measurement
   time and optional notes. At least one measurement is required; ranges are validated in the form
   and by database check constraints.
2. **Summary + charts:** latest weight, BMI (with category), waist, and height cards. Recharts line
   charts show weight and waist trends; a chart asks for a second data point when there is only one.
3. **History:** full measurement table with source badges (**Self** vs **Gym**) and derived BMI.
   Members can edit/delete only rows they recorded themselves; admin-recorded rows are read-only.
4. **Admin recording:** the client profile has a **Body metrics** card with the latest measurements
   and a Record/Edit dialog. Rows created by an admin are attributed to that admin (`recorded_by`).
5. **Profile** (`/app/profile`): account identity, current membership and validity, read-only personal
   details, and a phone editor. The database guard still only permits `phone` changes — attempts to
   alter `role` or other fields are rejected.
6. **Security:** RLS prevents members from inserting metrics for another client; the
   `body_metrics_guard` forces `recorded_by` to the acting user and blocks edits to admin rows.
   `admin_body_metrics_directory` uses `security_invoker`, so members only see their own history.
7. **Audit:** all `body_metrics` inserts/updates/deletes are written to `audit_logs`.
8. **Verification:** `npm run build` passes. Live E2E passed: self insert → BMI view → self update →
   cross-client insert blocked → admin insert → member edit of admin row ignored → RLS scoping →
   phone update → role escalation blocked → self delete → admin delete → audit rows present.

## 4. Project structure

```
src/
  app/            routing, guards, query client
  components/ui/  reusable primitives (button, input, badge, card, feedback)
  features/       auth, dashboard, clients, memberships, payments, attendance, metrics, profile (reports next)
  layouts/        auth layout, portal shell (sidebar + mobile nav)
  lib/            supabase client, env, utilities
  pages/          check-in, placeholders, 404
  types/          typed database models
supabase/
  migrations/     versioned SQL (schema → functions → RLS)
  seed.sql        admin provisioning + gym settings + demo plans
```

## 5. Security model (Phase 1)

| Table | Client | Admin |
| --- | --- | --- |
| `gym_settings` | read | full |
| `profiles` | read own, update `phone` only | full |
| `client_details` | read own | full |
| `membership_plans` | read active | full |
| `memberships` | read own | full |
| `attendance` | read own | full (corrections via RPC in Phase 4) |
| `body_metrics` | CRUD own rows **recorded by self** | full |
| `payments` | read via own memberships | full |
| `audit_logs` | none | read |

Defence in depth:

- All tables have RLS enabled and `anon` has no grants.
- `profiles` update guard trigger blocks any change except `phone`.
- Profile insert/delete guard blocks clients entirely.
- `recorded_by` is forced to the acting user; admin-recorded metrics stay read-only to members.
- `membership_status` is recomputed by trigger from subscription rows; clients can never write it.
- Partial unique indexes prevent duplicate open attendance sessions and multiple live subscriptions.
- Subscription dates, prices, and statuses are derived by `SECURITY DEFINER` RPCs; clients cannot
  insert or update `memberships` or `payments` directly. Audit triggers on `membership_plans`,
  `memberships`, and `payments` record `before_data`/`after_data` with the acting admin.
- Attendance writes go through guarded RPCs. Check-in re-validates the live subscription in the
  database, QR tokens are random UUIDs, and clients can only read their own attendance rows. Admin
  corrections and QR regeneration are audited.
- Body metric ownership is enforced by trigger and RLS: clients can only write rows they recorded
  for themselves, `recorded_by` cannot be spoofed, and admin-recorded measurements are read-only to
  members. Metric changes are audited.

## 6. Deployment (summary — full config in Phase 7)

- Vercel: framework preset **Vite**, build `npm run build`, output `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Production + Preview)
- SPA fallback `vercel.json` rewrite lands in Phase 7
- Add the Vercel domain to Supabase **Site URL / Redirect URLs**
