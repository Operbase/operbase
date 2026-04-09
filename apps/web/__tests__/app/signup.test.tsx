import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockSupabaseClient, resetSupabaseMocks } from '../helpers/supabase-mock'
import { toast } from 'sonner'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  usePathname: () => '/signup',
}))

import SignupPage from '@/app/signup/page'

/** Meets signup PASSWORD_RULES (length, upper, number, special). */
const VALID_PASSWORD = 'Valid1!pass'

beforeEach(() => {
  resetSupabaseMocks()
  mockPush.mockClear()
})

describe('SignupPage — step 1 (account details)', () => {
  it('renders email and password fields', () => {
    render(<SignupPage />)

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), VALID_PASSWORD)
    await user.type(screen.getByLabelText(/^confirm password$/i), 'Other1!pwd')
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(toast.error).toHaveBeenCalledWith('Passwords do not match')
  })

  it('shows error when password is too short', async () => {
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'Ab1!')
    await user.type(screen.getByLabelText(/^confirm password$/i), 'Ab1!')
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(toast.error).toHaveBeenCalledWith('Password must have: at least 8 characters')
  })

  it('advances to confirm step when form is valid', async () => {
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), VALID_PASSWORD)
    await user.type(screen.getByLabelText(/^confirm password$/i), VALID_PASSWORD)
    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByText(/confirm your details/i)).toBeInTheDocument()
    })
  })
})

describe('SignupPage — step 2 (confirm)', () => {
  async function advanceToConfirm() {
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), VALID_PASSWORD)
    await user.type(screen.getByLabelText(/^confirm password$/i), VALID_PASSWORD)
    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => screen.getByText(/confirm your details/i))
    return user
  }

  it('shows the entered email on the confirm screen', async () => {
    await advanceToConfirm()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('goes back to step 1 when Back is clicked', async () => {
    const user = await advanceToConfirm()
    await user.click(screen.getByRole('button', { name: /back/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    })
  })

  it('calls signUp and redirects to /login on success', async () => {
    const user = await advanceToConfirm()

    mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'new' } },
      error: null,
    })

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: VALID_PASSWORD,
        })
      )
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('shows error toast when signup fails', async () => {
    const user = await advanceToConfirm()

    mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
      data: {},
      error: new Error('Email already registered'),
    })

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'An account with this email already exists.',
        expect.objectContaining({ description: expect.stringContaining('Sign in') })
      )
    })
  })
})
