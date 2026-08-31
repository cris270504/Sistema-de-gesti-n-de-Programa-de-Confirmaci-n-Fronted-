import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { LS_TOKEN_KEY, LS_USER_KEY } from '@/constants/auth'

// Mockeamos lo que auth.js toca hacia afuera: supabase-js, el router y las
// alertas. Todo es Supabase: resolver-login + signInWithPassword + fn_get_user.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    rpc: vi.fn(),
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
  currentAccessToken: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/router', () => ({
  default: { push: vi.fn(), currentRoute: { value: { name: 'dashboard', fullPath: '/' } } },
}))
vi.mock('@/funciones', () => ({
  showAlerta: vi.fn(),
  showErroresDeValidacion: vi.fn(),
}))

import { supabase } from '@/lib/supabase'
import router from '@/router'
import { useAuthStore } from './auth'

function mockLoginOk(user) {
  supabase.functions.invoke.mockResolvedValueOnce({ data: { email: 'maria@parroquia.com' }, error: null })
  supabase.auth.signInWithPassword.mockResolvedValueOnce({
    data: { session: { access_token: 'sb-access-token' } },
    error: null,
  })
  supabase.rpc.mockResolvedValueOnce({ data: user, error: null })
}

describe('stores/auth', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('login exitoso: resuelve el identificador, entra a Supabase e hidrata con fn_get_user', async () => {
    mockLoginOk({ id: 1, name: 'María', grupo_ids: [10] })

    const auth = useAuthStore()
    const ok = await auth.login({ login: '12345678', password: 'secreta' })

    expect(ok).toBe(true)
    expect(supabase.functions.invoke).toHaveBeenCalledWith('resolver-login', { body: { login: '12345678' } })
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'maria@parroquia.com',
      password: 'secreta',
    })
    expect(auth.token).toBe('sb-access-token')
    expect(auth.user).toEqual({ id: 1, name: 'María', grupo_ids: [10] })
    expect(auth.isAuthenticated).toBe(true)
    expect(localStorage.getItem(LS_TOKEN_KEY)).toBe('sb-access-token')
    expect(JSON.parse(localStorage.getItem(LS_USER_KEY))).toEqual({ id: 1, name: 'María', grupo_ids: [10] })
  })

  it('login fallido (credenciales inválidas) limpia el estado y devuelve false', async () => {
    supabase.functions.invoke.mockResolvedValueOnce({ data: { email: 'x@y.com' }, error: null })
    supabase.auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Invalid login credentials' } })

    const auth = useAuthStore()
    const ok = await auth.login({ login: 'noexiste@correo.com', password: 'mala' })

    expect(ok).toBe(false)
    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem(LS_TOKEN_KEY)).toBeNull()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('logout cierra la sesión de Supabase, limpia el estado y redirige al login', async () => {
    const auth = useAuthStore()
    auth.token = 'token-viejo'
    auth.user = { id: 1, name: 'María' }
    localStorage.setItem(LS_TOKEN_KEY, 'token-viejo')
    localStorage.setItem(LS_USER_KEY, JSON.stringify({ id: 1 }))

    await auth.logout()

    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(localStorage.getItem(LS_TOKEN_KEY)).toBeNull()
    expect(router.push).toHaveBeenCalledWith({ name: 'login' })
  })

  it('can() refleja los permissions del usuario hidratado', async () => {
    mockLoginOk({ id: 1, permissions: ['ver dashboard', 'ver grupos'] })

    const auth = useAuthStore()
    await auth.login({ login: '1', password: '1' })

    expect(auth.can('ver dashboard')).toBe(true)
    expect(auth.can('ver usuarios')).toBe(false)
  })
})
