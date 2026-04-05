import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockSupabaseClient, resetSupabaseMocks } from '../helpers/supabase-mock'
import { toast } from 'sonner'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

// Import after mocks
import LoginPage from '@/app/login/page'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  usePathname: () => '/login',
}))

beforeEach(() => {
  resetSupabaseMocks()
  mockPush.mockClear()
  mockRefresh.mockClear()
})

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    render(<LoginPage />)

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders a link to the signup page', () => {
    render(<LoginPage />)

    const link = screen.getByRole('link', { name: /create one/i })
    expect(link).toHaveAttribute('href', '/signup')
  })

  it('submits with entered credentials', async () => {
    const user = userEvent.setup()
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: '1' } },
      error: null,
    })

    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'mypassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'mypassword',
      })
    })
  })

  it('redirects to /dashboard on successful login', async () => {
    const user = userEvent.setup()
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: '1' } },
      error: null,
    })

    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'mypassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows error toast on failed login', async () => {
    const user = userEvent.setup()
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: new Error('Invalid login credentials'),
    })

    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'bad@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid login credentials')
    })
  })

  it('shows loading state while submitting', async () => {
    const user = userEvent.setup()
    // Never resolves — keeps loading state visible
    mockSupabaseClient.auth.signInWithPassword.mockReturnValueOnce(new Promise(() => {}))

    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByText(/signing in/i)).toBeInTheDocument()
  })
})
