import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const maxDuration = 60

interface GreythornContractor {
  HrCode: string
  FirstName: string
  LastName: string
  IsActive: boolean
  LastWorkedDate: string | null
  StatusChangedAt: string | null
}

const BATCH_SIZE = 500

export async function POST() {
  // Auth
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  // Call Railway proxy
  let contractors: GreythornContractor[]
  try {
    const proxyRes = await fetch(`${process.env.RAILWAY_PROXY_URL}/report/contractor-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Report-Secret': process.env.RAILWAY_PROXY_SECRET!,
      },
      body: JSON.stringify({}),
    })

    if (!proxyRes.ok) {
      const err = await proxyRes.json()
      return NextResponse.json({ error: err.error || 'Sync query failed.' }, { status: proxyRes.status })
    }

    const data = await proxyRes.json()
    contractors = data.contractors
  } catch {
    return NextResponse.json({ error: 'Failed to connect to report service.' }, { status: 502 })
  }

  // Upsert to Supabase in batches
  const now = new Date().toISOString()
  try {
    const records = contractors.map(c => ({
      hr_code: c.HrCode.trim(),
      first_name: c.FirstName.trim(),
      last_name: c.LastName.trim(),
      is_active: c.IsActive,
      last_worked_date: c.LastWorkedDate || null,
      status_changed_at: c.StatusChangedAt || null,
      synced_at: now,
    }))

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)
      const { error } = await serviceClient
        .from('contractors')
        .upsert(batch, { onConflict: 'hr_code' })

      if (error) throw error
    }

    // Log success
    await serviceClient.from('sync_log').insert({
      status: 'success',
      records_synced: records.length,
      triggered_by: 'manual',
    })

    return NextResponse.json({
      status: 'success',
      records_synced: records.length,
      ran_at: now,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)

    // Log error
    try {
      await serviceClient.from('sync_log').insert({
        status: 'error',
        error_message: message,
        triggered_by: 'manual',
      })
    } catch {
      console.error('Failed to log sync error to sync_log')
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
