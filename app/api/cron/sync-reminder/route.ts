import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const recipients = process.env.NOTIFY_TO_EMAILS!.split(',').map(e => e.trim())
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })

  await resend.emails.send({
    from: process.env.NOTIFY_FROM_EMAIL!,
    to: recipients,
    subject: 'Reminder: Run Greythorn Contractor Sync',
    text: [
      `Daily reminder — ${now}`,
      '',
      'Please run the Greythorn contractor sync from a machine with database access:',
      '',
      '  python scripts/contractor_sync.py',
      '',
      'This keeps the contractors table up to date for referral submissions and checks.',
    ].join('\n'),
  })

  return NextResponse.json({ ok: true, message: 'Reminder sent' })
}
