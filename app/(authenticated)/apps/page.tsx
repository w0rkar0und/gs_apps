import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase-server'
import { APPS } from '@/lib/apps'
import Link from 'next/link'

const APP_ICONS: Record<string, React.ReactNode> = {
  referrals: (
    <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-1.997m0 0A8.961 8.961 0 0 1 12 15.75c-1.99 0-3.832.648-5.323 1.747" />
    </svg>
  ),
  reports: (
    <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
    </svg>
  ),
  scorecards: (
    <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
    </svg>
  ),
  generic: (
    <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
    </svg>
  ),
}

export default async function AppsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()

  const [{ data: profile }, { data: userApps }] = await Promise.all([
    serviceClient.from('profiles').select('display_id, is_admin').eq('id', user.id).single(),
    serviceClient.from('user_apps').select('app_slug').eq('user_id', user.id),
  ])

  const isAdmin = profile?.is_admin ?? false
  const grantedSlugs = new Set((userApps ?? []).map((ua: { app_slug: string }) => ua.app_slug))

  // Admins see all apps; non-admins see only granted apps
  const visibleApps = APPS.filter((app) => isAdmin || grantedSlugs.has(app.slug))

  return (
    <div className="py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-slate-900">GS Apps</h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, {profile?.display_id ?? 'user'}
          </p>
        </div>

        {visibleApps.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm">
              You do not have access to any applications. Please contact your administrator.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleApps.map((app) => (
              <Link
                key={app.slug}
                href={app.basePath}
                className="group bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all"
              >
                <div className="mb-4">
                  <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                    {APP_ICONS[app.icon] ?? APP_ICONS.generic}
                  </div>
                </div>
                <h2 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {app.name}
                </h2>
                <p className="text-sm text-slate-500 mt-1">{app.description}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
