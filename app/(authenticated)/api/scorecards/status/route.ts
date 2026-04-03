import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET() {
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

  const scorecardUrl = process.env.SCORECARD_SERVICE_URL
  const scorecardSecret = process.env.SCORECARD_SECRET

  if (!scorecardUrl) {
    return NextResponse.json({ error: 'SCORECARD_SERVICE_URL not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(`${scorecardUrl}/status`, {
      headers: {
        ...(scorecardSecret ? { 'X-Scorecard-Secret': scorecardSecret } : {}),
      },
    })

    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'Failed to reach scorecard service' },
      { status: 502 }
    )
  }
}
