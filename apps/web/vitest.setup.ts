import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  redirect: vi.fn(),
}))

// Mock Next.js font loading
vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: '--font-geist-sans', subsets: [] }),
  Geist_Mono: () => ({ variable: '--font-geist-mono', subsets: [] }),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
  Toaster: () => null,
}))

// Suppress console.error noise from React in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') || args[0].includes('ReactDOM.render'))
    ) {
      return
    }
    originalError(...args)
  }
})

afterAll(() => {
  console.error = originalError
})
