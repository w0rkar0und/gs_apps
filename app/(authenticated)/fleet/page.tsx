import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase-server'
import VehicleStatusDashboard from '@/components/fleet/VehicleStatusDashboard'

export default async function FleetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()

  const [{ data: profile }, { data: access }] = await Promise.all([
    serviceClient.from('profiles').select('is_admin').eq('id', user.id).single(),
    serviceClient.from('user_apps').select('id').eq('user_id', user.id).eq('app_slug', 'fleet').limit(1),
  ])

  const isAdmin = profile?.is_admin ?? false
  const hasAccess = isAdmin || (access && access.length > 0)

  if (!hasAccess) {
    return (
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h1 className="text-2xl font-bold text-gt-dark mb-6">Fleet</h1>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-slate-500 text-sm">
              You do not have access to the Fleet dashboard. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <h1 className="text-2xl font-bold text-gt-dark mb-6">Fleet</h1>
        <VehicleStatusDashboard />
      </div>
    </div>
  )
}
