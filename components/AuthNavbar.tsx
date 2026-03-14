import { createClient, createServiceClient } from '@/lib/supabase-server'
import Navbar from './Navbar'

export default async function AuthNavbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('display_id, is_admin')
    .eq('id', user.id)
    .single()

  return (
    <Navbar
      isAdmin={profile?.is_admin ?? false}
      displayId={profile?.display_id ?? user.email ?? ''}
    />
  )
}
