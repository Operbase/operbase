import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, resetSupabaseMocks } from '../helpers/supabase-mock'

// Mock the supabase client module before importing auth
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

import { signIn, signUp, signOut, signInWithGoogle } from '@/lib/auth'

beforeEach(() => {
  resetSupabaseMocks()
})

describe('signIn()', () => {
  it('calls signInWithPassword with email and password', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: '123' } },
      error: null,
    })

    await signIn('user@example.com', 'password123')

    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    })
  })

  it('throws when Supabase returns an error', async () => {
    const supabaseError = new Error('Invalid login credentials')
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: supabaseError,
    })

    await expect(signIn('bad@example.com', 'wrong')).rejects.toThrow(
      'Invalid login credentials'
    )
  })

  it('does not throw when login succeeds', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'abc' } },
      error: null,
    })

    await expect(signIn('ok@example.com', 'correctpass')).resolves.toBeUndefined()
  })
})

describe('signUp()', () => {
  it('calls supabase signUp with email and password', async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'new-user' } },
      error: null,
    })

    await signUp('new@example.com', 'mypassword')

    expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'mypassword',
      options: { data: undefined },
    })
  })

  it('throws when Supabase returns a signup error', async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
      data: {},
      error: new Error('Email already registered'),
    })

    await expect(signUp('taken@example.com', 'pass')).rejects.toThrow(
      'Email already registered'
    )
  })
})

describe('signOut()', () => {
  it('calls supabase signOut', async () => {
    mockSupabaseClient.auth.signOut.mockResolvedValueOnce({ error: null })

    await signOut()

    expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledOnce()
  })

  it('throws when signOut returns an error', async () => {
    mockSupabaseClient.auth.signOut.mockResolvedValueOnce({
      error: new Error('Session expired'),
    })

    await expect(signOut()).rejects.toThrow('Session expired')
  })
})

describe('signInWithGoogle()', () => {
  beforeEach(() => {
    // jsdom does not provide window.location.origin — stub it
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
      writable: true,
    })
  })

  it('calls signInWithOAuth with google provider and correct redirectTo', async () => {
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValueOnce({
      data: {},
      error: null,
    })

    await signInWithGoogle()

    expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback',
      },
    })
  })

  it('throws when signInWithOAuth returns an error', async () => {
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValueOnce({
      data: {},
      error: new Error('OAuth provider not enabled'),
    })

    await expect(signInWithGoogle()).rejects.toThrow('OAuth provider not enabled')
  })

  it('does not throw when OAuth succeeds', async () => {
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValueOnce({
      data: {},
      error: null,
    })

    await expect(signInWithGoogle()).resolves.toBeUndefined()
  })
})
