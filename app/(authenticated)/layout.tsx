import AuthNavbar from '@/components/AuthNavbar'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <AuthNavbar />
      {children}
    </>
  )
}
