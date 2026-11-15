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
| 3 | Plans, subscriptions lifecycle, payments | ⏳ Next |
| 4 | Attendance, QR codes, check-in/out, admin corrections | ⏳ |
| 5 | Body metrics, self-entry, progress charts | ⏳ |
| 6 | Analytics, reports, CSV export | ⏳ |
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
5. `supabase/seed.sql` — singleton gym settings, first admin, demo plans

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

## 4. Project structure

```
src/
  app/            routing, guards, query client
  components/ui/  reusable primitives (button, input, badge, card, feedback)
  features/       auth, dashboard (clients, memberships, attendance, metrics, reports, payments next)
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

## 6. Deployment (summary — full config in Phase 7)

- Vercel: framework preset **Vite**, build `npm run build`, output `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Production + Preview)
- SPA fallback `vercel.json` rewrite lands in Phase 7
- Add the Vercel domain to Supabase **Site URL / Redirect URLs**
