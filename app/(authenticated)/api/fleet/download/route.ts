import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { generateVehicleStatusExcel } from '@/lib/excel-vehicle-status'

export async function POST(request: NextRequest) {
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

  const [{ data: profile }, { data: access }] = await Promise.all([
    serviceClient.from('profiles').select('is_admin').eq('id', user.id).single(),
    serviceClient.from('user_apps').select('id').eq('user_id', user.id).eq('app_slug', 'fleet').limit(1),
  ])

  if (!profile?.is_admin && (!access || access.length === 0)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { vehicles, filters } = await request.json()

  if (!vehicles || !Array.isArray(vehicles)) {
    return NextResponse.json({ error: 'vehicles array is required.' }, { status: 400 })
  }

  try {
    const buffer = await generateVehicleStatusExcel(vehicles, filters)
    const date = new Date().toISOString().slice(0, 10)
    const filename = `Vehicle_Status_${date}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('Excel generation error:', err)
    return NextResponse.json({ error: 'Failed to generate Excel file.' }, { status: 500 })
  }
}
