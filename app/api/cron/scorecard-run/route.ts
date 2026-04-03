import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const scorecardUrl = process.env.SCORECARD_SERVICE_URL
  const scorecardSecret = process.env.SCORECARD_SECRET

  if (!scorecardUrl) {
    return NextResponse.json({ error: 'SCORECARD_SERVICE_URL not configured' }, { status: 500 })
  }

  try {
    // Trigger the scorecard pipeline on Railway
    const response = await fetch(`${scorecardUrl}/run`, {
      method: 'POST',
      headers: {
        ...(scorecardSecret ? { 'X-Scorecard-Secret': scorecardSecret } : {}),
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, status: response.status, detail: data.detail || 'Unknown error' },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, ...data })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to reach scorecard service' },
      { status: 502 }
    )
  }
}
