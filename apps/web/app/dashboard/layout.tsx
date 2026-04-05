import { redirect } from 'next/navigation'
import { BusinessProvider } from '@/providers/business-provider'
import DashboardLayout from '@/components/dashboard-layout'
import { getCachedDashboardContext } from '@/lib/dashboard/cached-dashboard-context'

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getCachedDashboardContext()

  if (!ctx.user) {
    redirect('/login')
  }

  if (!ctx.business) {
    redirect('/onboarding')
  }

  return (
    <BusinessProvider initialBusiness={ctx.business}>
      <DashboardLayout userEmail={ctx.user.email} userName={ctx.user.displayName}>
        {children}
      </DashboardLayout>
    </BusinessProvider>
  )
}
