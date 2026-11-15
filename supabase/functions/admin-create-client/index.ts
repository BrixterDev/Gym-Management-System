// Edge Function: admin-create-client
// Creates a client account with the service role. Never exposes privileged keys.
// The caller must be an authenticated, approved admin (verified server-side).

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function safeDelete(admin: SupabaseClient, userId: string) {
  try {
    await admin.auth.admin.deleteUser(userId)
  } catch {
    // Best-effort rollback.
  }
}

interface CreateClientPayload {
  email?: string
  password?: string
  display_name?: string | null
  member_code?: string | null
  phone?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server is not configured' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing authorization token' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Verify the caller's identity and role from the database.
  const token = authHeader.slice('Bearer '.length)
  const { data: callerData, error: callerError } = await admin.auth.getUser(token)
  if (callerError || !callerData.user) {
    return json({ error: 'Invalid or expired session' }, 401)
  }

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, account_status')
    .eq('id', callerData.user.id)
    .maybeSingle()

  if (profileError) return json({ error: 'Could not verify caller' }, 500)
  if (!callerProfile || callerProfile.role !== 'admin' || callerProfile.account_status !== 'approved') {
    return json({ error: 'Admin privileges required' }, 403)
  }

  // 2. Validate input.
  let payload: CreateClientPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const email = (payload.email ?? '').trim().toLowerCase()
  const password = payload.password ?? ''
  const displayName = payload.display_name?.trim() || null
  const memberCode = payload.member_code?.trim() || null
  const phone = payload.phone?.trim() || null

  if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address' }, 400)
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
  if (memberCode && memberCode.length > 60) return json({ error: 'Member code is too long' }, 400)

  // 3. Create the auth user (email pre-confirmed: the admin vetted the member).
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
  })

  if (createError) {
    const message = /already/i.test(createError.message)
      ? 'An account with this email already exists'
      : createError.message
    return json({ error: message }, 409)
  }

  const clientId = created.user.id

  // 4. Activate the profile and set admin-managed identity fields.
  const { error: activateError } = await admin
    .from('profiles')
    .update({ account_status: 'approved', phone })
    .eq('id', clientId)

  if (activateError) {
    await safeDelete(admin, clientId)
    return json({ error: 'Failed to activate the client profile' }, 500)
  }

  const { error: detailError } = await admin.from('client_details').upsert(
    {
      client_id: clientId,
      display_name: displayName,
      member_code: memberCode,
    },
    { onConflict: 'client_id' },
  )

  if (detailError) {
    const message = /duplicate|unique/i.test(detailError.message)
      ? 'That member code is already in use'
      : 'Failed to save client details'
    // Roll back the account so the admin can retry.
    await safeDelete(admin, clientId)
    return json({ error: message }, 409)
  }

  await admin.from('audit_logs').insert({
    actor_id: callerProfile.id,
    action: 'create_client',
    entity_type: 'profiles',
    entity_id: clientId,
    before_data: null,
    after_data: { email, display_name: displayName, member_code: memberCode },
  })

  return json({ id: clientId, email }, 201)
})
