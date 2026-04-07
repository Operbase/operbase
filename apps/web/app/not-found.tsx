import Link from 'next/link'
import { Wheat, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f7f4ee] flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-amber-900/10 bg-[#f7f4ee]/90 shadow-sm shadow-stone-900/5 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
              <Wheat className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-stone-900">Operbase</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 pt-20">
        <div className="text-center max-w-md">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600 mb-6">
            <span className="text-4xl font-bold">404</span>
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-3">
            Page not found
          </h1>
          <p className="text-stone-600 mb-8">
            That page is not here. The link may be old or the page moved. Try home or sign in below.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              className="h-11 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-6 font-semibold text-white shadow-md"
            >
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go home
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-xl border-stone-300 px-6 font-semibold text-stone-700"
            >
              <Link href="/login">
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-amber-900/10 bg-white/50 py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-stone-500 sm:px-6">
          &copy; {new Date().getFullYear()} Operbase. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
