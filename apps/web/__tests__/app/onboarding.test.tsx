import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockSupabaseClient, resetSupabaseMocks, createQueryBuilder } from '../helpers/supabase-mock'
import { toast } from 'sonner'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  usePathname: () => '/onboarding',
}))

import OnboardingPage from '@/app/onboarding/page'
import { onboardingDraftStorageKey } from '@/lib/onboarding/draft-storage'
import { installMemoryLocalStorage } from '@/__tests__/helpers/memory-local-storage'

const TEST_USER = { id: 'user-123', email: 'owner@example.com' }

beforeEach(() => {
  installMemoryLocalStorage()
  resetSupabaseMocks()
  mockPush.mockClear()
  mockRefresh.mockClear()
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: TEST_USER },
    error: null,
  })
})

describe('OnboardingPage — draft persistence', () => {
  it('restores step and fields from localStorage', async () => {
    localStorage.setItem(
      onboardingDraftStorageKey(TEST_USER.id),
      JSON.stringify({
        v: 1,
        savedAt: Date.now(),
        step: 'branding',
        form: {
          businessName: 'Draft Co',
          logoUrl: '',
          brandColor: '#dc2626',
          businessType: 'bakery',
          currency: 'EUR',
        },
      })
    )

    render(<OnboardingPage />)

    await waitFor(() => {
      expect(screen.getByText(/brand your business/i)).toBeInTheDocument()
    })
    const currency = screen.getByLabelText(/currency/i) as HTMLSelectElement
    expect(currency.value).toBe('EUR')
  })

  it('clears saved draft after successful finish', async () => {
    const user = userEvent.setup()
    render(<OnboardingPage />)
    await user.type(screen.getByPlaceholderText(/sweet delights bakery/i), 'My Bakery')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByText(/brand your business/i))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByText(/what type of business/i))

    mockSupabaseClient.rpc = vi.fn().mockResolvedValue({ data: 'biz-456', error: null })

    await user.click(screen.getByRole('button', { name: /get started/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
    expect(localStorage.getItem(onboardingDraftStorageKey(TEST_USER.id))).toBeNull()
  })

  it('start over clears draft and returns to step 1', async () => {
    localStorage.setItem(
      onboardingDraftStorageKey(TEST_USER.id),
      JSON.stringify({
        v: 1,
        savedAt: Date.now(),
        step: 'type',
        form: {
          businessName: 'X',
          logoUrl: '',
          brandColor: '#d97706',
          businessType: 'bakery',
          currency: 'USD',
        },
      })
    )

    render(<OnboardingPage />)

    await waitFor(() => screen.getByText(/what type of business/i))

    await userEvent.click(
      screen.getByRole('button', { name: /start over and clear saved progress/i })
    )

    await waitFor(() => {
      expect(screen.getByText(/create your business/i)).toBeInTheDocument()
    })
    expect(localStorage.getItem(onboardingDraftStorageKey(TEST_USER.id))).toBeNull()
  })
})

describe('OnboardingPage — step 1 (business name)', () => {
  it('renders the business name input on first load', async () => {
    render(<OnboardingPage />)

    await waitFor(() => {
      expect(screen.getByText(/create your business/i)).toBeInTheDocument()
    })
    expect(screen.getByPlaceholderText(/sweet delights bakery/i)).toBeInTheDocument()
  })

  it('shows error when business name is empty', async () => {
    const user = userEvent.setup()
    render(<OnboardingPage />)

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(toast.error).toHaveBeenCalledWith('Please enter your business name')
  })

  it('advances to branding step when name is filled', async () => {
    const user = userEvent.setup()
    render(<OnboardingPage />)

    await user.type(screen.getByPlaceholderText(/sweet delights bakery/i), 'My Bakery')
    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByText(/brand your business/i)).toBeInTheDocument()
    })
  })
})

describe('OnboardingPage — step 2 (branding)', () => {
  async function goToBranding() {
    const user = userEvent.setup()
    render(<OnboardingPage />)
    await user.type(screen.getByPlaceholderText(/sweet delights bakery/i), 'My Bakery')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByText(/brand your business/i))
    return user
  }

  it('shows color picker and logo URL input', async () => {
    await goToBranding()
    expect(screen.getByText(/brand color/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/https:\/\/example.com\/logo/i)).toBeInTheDocument()
  })

  it('can go back to step 1', async () => {
    const user = await goToBranding()
    await user.click(screen.getByRole('button', { name: /back/i }))
    await waitFor(() => screen.getByText(/create your business/i))
  })

  it('advances to business type step', async () => {
    const user = await goToBranding()
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByText(/what type of business/i))
  })
})

describe('OnboardingPage — step 3 (business type)', () => {
  async function goToTypeStep() {
    const user = userEvent.setup()
    render(<OnboardingPage />)
    await user.type(screen.getByPlaceholderText(/sweet delights bakery/i), 'My Bakery')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByText(/brand your business/i))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByText(/what type of business/i))
    return user
  }

  it('shows business type options', async () => {
    await goToTypeStep()
    expect(screen.getByText('Bakery')).toBeInTheDocument()
    expect(screen.getByText('Restaurant')).toBeInTheDocument()
    expect(screen.getByText('Cafe')).toBeInTheDocument()
  })

  it('calls create_business_with_owner RPC on finish', async () => {
    const user = await goToTypeStep()

    mockSupabaseClient.rpc = vi.fn().mockResolvedValue({ data: 'biz-456', error: null })

    await user.click(screen.getByRole('button', { name: /get started/i }))

    await waitFor(() => {
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'create_business_with_owner',
        expect.objectContaining({
          p_name: 'My Bakery',
          p_brand_color: expect.any(String),
          p_business_type: expect.any(String),
        })
      )
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('redirects to dashboard when RPC reports user already has a business', async () => {
    const user = await goToTypeStep()

    mockSupabaseClient.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'User already has a business' },
    })

    await user.click(screen.getByRole('button', { name: /get started/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
    expect(toast.error).not.toHaveBeenCalled()
  })
})
