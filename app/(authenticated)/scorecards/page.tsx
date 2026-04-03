import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase-server'
import ScorecardDashboard from '@/components/scorecards/ScorecardDashboard'
import type { ScorecardRun } from '@/lib/types'

export default async function ScorecardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return (
      <div className="py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h1 className="text-xl font-semibold text-slate-900 mb-6">Scorecards</h1>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-slate-500 text-sm">
              Access restricted to administrators.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { data: runs } = await serviceClient
    .from('scorecard_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20)

  return (
    <div className="py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h1 className="text-xl font-semibold text-slate-900 mb-6">Scorecards</h1>
        <ScorecardDashboard initialRuns={(runs ?? []) as ScorecardRun[]} />
      </div>
    </div>
  )
}
