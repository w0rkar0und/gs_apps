import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase-server'
import UserManagement from './UserManagement'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/referrals')

  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <a
            href="/admin"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Back to Dashboard
          </a>
        </div>

        <UserManagement initialProfiles={profiles ?? []} />
      </div>
    </div>
  )
}
