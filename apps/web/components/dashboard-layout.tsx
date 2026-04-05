'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Menu, LogOut, Home, Package, ChefHat, ShoppingBag, Settings, X, HelpCircle } from 'lucide-react'
import { signOut } from '@/lib/auth'
import { toast } from 'sonner'
import { useBusinessContext } from '@/providers/business-provider'
import { createClient } from '@/lib/supabase/client'
import { businessInitials } from '@/lib/brand/business-initials'

interface DashboardLayoutProps {
  children: React.ReactNode
  userEmail?: string
  userName?: string
}

function initialsForUser(name: string, email: string): string {
  const n = name.trim()
  if (n.includes(' ')) {
    return n
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
  }
  if (n.length >= 2) return n.slice(0, 2).toUpperCase()
  if (n.length === 1) return n.toUpperCase()
  const local = email.split('@')[0] ?? ''
  return (local.slice(0, 2) || '?').toUpperCase()
}

export default function DashboardLayout({ children, userEmail, userName }: DashboardLayoutProps) {
  return (
    <DashboardLayoutInner userEmail={userEmail} userName={userName}>
      {children}
    </DashboardLayoutInner>
  )
}

function DashboardLayoutInner({ children, userEmail, userName }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const { businessName, brandColor, logoUrl } = useBusinessContext()

  useEffect(() => {
    let cancelled = false
    void createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (cancelled || !user) return
        const email = user.email ?? ''
        const meta = user.user_metadata as { full_name?: string } | undefined
        const derived =
          meta?.full_name?.trim() || (email ? email.split('@')[0] : '') || 'User'
        setAuthName(derived)
        setAuthEmail(email)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const displayName = (userName?.trim() || authName || 'User').trim() || 'User'
  const displayEmail = userEmail || authEmail
  const userInitials = initialsForUser(displayName, displayEmail)

  const menuItems = [
    { label: 'Home', hint: 'Overview', icon: Home, href: '/dashboard' },
    { label: 'Stock', hint: 'Ingredients & bags', icon: Package, href: '/dashboard/stock' },
    { label: 'Baking', hint: 'What you made', icon: ChefHat, href: '/dashboard/production' },
    { label: 'Sales', hint: 'What you sold', icon: ShoppingBag, href: '/dashboard/sales' },
  ]

  async function handleLogout() {
    try {
      await signOut()
      toast.success('Logged out successfully')
      router.push('/login')
      router.refresh()
    } catch {
      toast.error('Logout failed')
    }
  }

  const initials = businessInitials(businessName)

  const Sidebar = (
    <div className="flex flex-col h-full">
      {/* Header: OB logo + business identity */}
      <div className="p-4 border-b flex items-center gap-3">
        {/* Business logo or initials circle */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ backgroundColor: brandColor }}
        >
          {logoUrl ? (
            <Image src={logoUrl} alt={businessName ?? 'logo'} width={40} height={40} className="object-cover w-full h-full" />
          ) : (
            <span className="text-white font-bold text-sm">{initials}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Business name — prominent */}
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {businessName ?? '…'}
          </p>
          {/* OB badge — subtle, so it doesn't overshadow the business */}
          <p className="text-xs text-gray-400 leading-tight">via OB</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left min-h-[3.25rem] ${
                isActive ? 'font-semibold text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
              style={isActive ? { backgroundColor: brandColor } : undefined}
            >
              <Icon size={22} className="shrink-0" aria-hidden />
              <span className="flex flex-col leading-tight">
                <span className="text-base">{item.label}</span>
                <span className={`text-xs font-normal ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                  {item.hint}
                </span>
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Footer: user info + settings */}
      <div className="border-t p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-500 truncate">{displayEmail || '—'}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Show getting started guide"
              title="Getting started guide"
              onClick={() => window.dispatchEvent(new CustomEvent('operbase:show-helper'))}
            >
              <HelpCircle size={18} className="text-gray-400" />
            </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Account and logout">
                <Settings size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium truncate">{displayName}</p>
                {displayEmail ? (
                  <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut size={16} className="mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )

  // Inject brand color as a CSS variable so all amber classes in child pages
  // automatically pick up the business's color without touching each page.
  const brandStyle = {
    '--brand': brandColor,
    '--brand-light': `color-mix(in srgb, ${brandColor} 12%, white)`,
    '--brand-mid': `color-mix(in srgb, ${brandColor} 20%, white)`,
    '--brand-dark': `color-mix(in srgb, ${brandColor} 85%, black)`,
  } as React.CSSProperties

  return (
    <div className="flex h-screen bg-gray-50" data-dashboard style={brandStyle}>
      <style>{`
        [data-dashboard] .bg-amber-600 { background-color: var(--brand) !important; }
        [data-dashboard] .hover\\:bg-amber-700:hover { background-color: var(--brand) !important; filter: brightness(0.88); }
        [data-dashboard] .bg-amber-50 { background-color: var(--brand-light) !important; }
        [data-dashboard] .hover\\:bg-amber-50:hover { background-color: var(--brand-light) !important; }
        [data-dashboard] .bg-amber-100 { background-color: var(--brand-mid) !important; }
        [data-dashboard] .hover\\:bg-amber-100:hover { background-color: var(--brand-mid) !important; }
        [data-dashboard] .text-amber-600 { color: var(--brand) !important; }
        [data-dashboard] .text-amber-700 { color: var(--brand) !important; }
        [data-dashboard] .text-amber-800 { color: var(--brand-dark) !important; }
        [data-dashboard] .text-amber-900 { color: var(--brand-dark) !important; }
        [data-dashboard] .hover\\:text-amber-700:hover { color: var(--brand) !important; }
        [data-dashboard] .hover\\:text-amber-800:hover { color: var(--brand-dark) !important; }
        [data-dashboard] .border-amber-100 { border-color: var(--brand-light) !important; }
        [data-dashboard] .border-amber-200 { border-color: var(--brand-mid) !important; }
        [data-dashboard] .hover\\:border-amber-200:hover { border-color: var(--brand-mid) !important; }
        [data-dashboard] .ring-amber-300 { --tw-ring-color: color-mix(in srgb, var(--brand) 40%, white) !important; }
        [data-dashboard] .ring-amber-500 { --tw-ring-color: var(--brand) !important; }
        [data-dashboard] .text-orange-600 { color: var(--brand) !important; }
        [data-dashboard] .text-orange-700 { color: var(--brand-dark) !important; }
        [data-dashboard] .bg-orange-50 { background-color: var(--brand-light) !important; }
        [data-dashboard] .text-amber-700.underline { color: var(--brand) !important; }
        [data-dashboard] .focus\\:ring-amber-500:focus { --tw-ring-color: var(--brand) !important; }
      `}</style>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white shadow-sm border-r">
        {Sidebar}
      </aside>

      {/* Mobile sidebar */}
      <aside
        id="dashboard-mobile-nav"
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg flex flex-col transform transition-transform duration-300 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {Sidebar}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden bg-white border-b px-3 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg shrink-0 -ml-1"
            aria-expanded={sidebarOpen}
            aria-controls="dashboard-mobile-nav"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? <X size={22} className="text-gray-700" /> : <Menu size={22} />}
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {logoUrl ? (
                <Image src={logoUrl} alt="" width={28} height={28} className="object-cover w-full h-full" />
              ) : (
                <span className="text-white font-bold text-xs">{initials}</span>
              )}
            </div>
            <span className="text-sm font-semibold text-gray-900 truncate">
              {businessName ?? 'Loading…'}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-gray-800 text-xs font-semibold hover:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                aria-label="Your account"
              >
                {userInitials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium truncate">{displayName}</p>
                {displayEmail ? (
                  <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Signed in</p>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setSidebarOpen(false)
                  void handleLogout()
                }}
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut size={16} className="mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8">{children}</div>
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
