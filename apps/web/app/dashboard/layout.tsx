import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { BusinessProvider } from '@/providers/business-provider'
import DashboardLayout from '@/components/dashboard-layout'
import { getCachedDashboardContext } from '@/lib/dashboard/cached-dashboard-context'
import { businessInitials } from '@/lib/brand/business-initials'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getCachedDashboardContext()
  if (!ctx.business) {
    return {}
  }

  const b = ctx.business
  const title = b.businessName ? `${b.businessName} · Dashboard` : 'Dashboard'

  if (b.logoUrl) {
    return {
      title,
      icons: {
        icon: [{ url: b.logoUrl }],
        apple: [{ url: b.logoUrl }],
      },
    }
  }

  const initials = businessInitials(b.businessName)
  const hex = (b.brandColor ?? '#d97706').replace(/^#/, '')
  const faviconPath = `/api/brand-favicon?i=${encodeURIComponent(initials)}&c=${encodeURIComponent(hex)}`

  return {
    title,
    icons: {
      icon: [{ url: faviconPath, type: 'image/svg+xml' }],
      apple: [{ url: faviconPath, type: 'image/svg+xml' }],
    },
  }
}

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
