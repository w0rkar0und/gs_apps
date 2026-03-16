export interface AppDefinition {
  slug: string
  name: string
  description: string
  icon: 'referrals' | 'reports' | 'generic'
  basePath: string
}

export const APPS: AppDefinition[] = [
  {
    slug: 'referrals',
    name: 'Referrals',
    description: 'Register and track contractor referrals',
    icon: 'referrals',
    basePath: '/referrals',
  },
  {
    slug: 'reports',
    name: 'Reports',
    description: 'Run self-service reports against Greythorn',
    icon: 'reports',
    basePath: '/reports',
  },
]

export function getAppBySlug(slug: string): AppDefinition | undefined {
  return APPS.find((app) => app.slug === slug)
}

export function getAppByPath(pathname: string): AppDefinition | undefined {
  return APPS.find((app) => pathname === app.basePath || pathname.startsWith(app.basePath + '/'))
}
