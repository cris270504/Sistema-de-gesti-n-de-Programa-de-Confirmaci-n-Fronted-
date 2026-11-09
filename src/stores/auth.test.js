import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { LS_TOKEN_KEY, LS_USER_KEY } from '@/constants/auth'

// Mockeamos lo que auth.js toca hacia afuera: supabase-js, el router y las
// alertas. Todo es Supabase: Edge Function login + setSession + fn_get_user.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    rpc: vi.fn(),
    auth: {
      setSession: vi.fn(),
      signInWithPasskey: vi.fn(),
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
  supabase.functions.invoke.mockResolvedValueOnce({
    data: { access_token: 'sb-access-token', refresh_token: 'sb-refresh' },
    error: null,
  })
  supabase.auth.setSession.mockResolvedValueOnce({
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

  it('login exitoso: autentica en el servidor, fija la sesión e hidrata con fn_get_user', async () => {
    mockLoginOk({ id: 1, name: 'María', grupo_ids: [10] })

    const auth = useAuthStore()
    const ok = await auth.login({ login: '12345678', password: 'secreta' })

    expect(ok).toBe(true)
    expect(supabase.functions.invoke).toHaveBeenCalledWith('login', { body: { login: '12345678', password: 'secreta' } })
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'sb-access-token',
      refresh_token: 'sb-refresh',
    })
    expect(auth.token).toBe('sb-access-token')
    expect(auth.user).toEqual({ id: 1, name: 'María', grupo_ids: [10] })
    expect(auth.isAuthenticated).toBe(true)
    expect(localStorage.getItem(LS_TOKEN_KEY)).toBe('sb-access-token')
    expect(JSON.parse(localStorage.getItem(LS_USER_KEY))).toEqual({ id: 1, name: 'María', grupo_ids: [10] })
  })

  it('login fallido (credenciales inválidas) limpia el estado y devuelve false', async () => {
    supabase.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: { name: 'FunctionsHttpError', context: { status: 401, json: async () => ({ error: 'credenciales' }) } },
    })

    const auth = useAuthStore()
    const ok = await auth.login({ login: 'noexiste@correo.com', password: 'mala' })

    expect(ok).toBe(false)
    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem(LS_TOKEN_KEY)).toBeNull()
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.auth.setSession).not.toHaveBeenCalled()
  })

  it('login con huella: usa la sesión del passkey e hidrata con fn_get_user', async () => {
    supabase.auth.signInWithPasskey.mockResolvedValueOnce({
      data: { session: { access_token: 'tok-huella' }, user: { user_metadata: {} } },
      error: null,
    })
    supabase.rpc.mockResolvedValueOnce({ data: { id: 7, name: 'Ana' }, error: null })

    const auth = useAuthStore()
    const ok = await auth.loginConHuella()

    expect(ok).toBe(true)
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
    expect(auth.token).toBe('tok-huella')
    expect(auth.user).toEqual({ id: 7, name: 'Ana' })
  })

  it('login con huella cancelado por la persona: false y sin alerta', async () => {
    const { showAlerta } = await import('@/funciones')
    supabase.auth.signInWithPasskey.mockResolvedValueOnce({
      data: { session: null },
      error: Object.assign(new Error('The operation either timed out or was not allowed.'), { name: 'NotAllowedError' }),
    })

    const auth = useAuthStore()
    const ok = await auth.loginConHuella()

    expect(ok).toBe(false)
    expect(showAlerta).not.toHaveBeenCalled()
    expect(auth.isAuthenticated).toBe(false)
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

  it('al cerrar sesión vacía los datos en memoria del usuario anterior', async () => {
    const { useDashboardStore } = await import('./dashboard')
    const dashboard = useDashboardStore()
    dashboard.alertas = [{ id: 1, nombre: 'Alerta del catequista anterior' }]
    dashboard.lastFetch = Date.now()

    useAuthStore().logoutLocal()

    expect(dashboard.alertas).toEqual([])
    expect(dashboard.lastFetch).toBe(0)
  })

  it('can() refleja los permissions del usuario hidratado', async () => {
    mockLoginOk({ id: 1, permissions: ['ver dashboard', 'ver grupos'] })

    const auth = useAuthStore()
    await auth.login({ login: '1', password: '1' })

    expect(auth.can('ver dashboard')).toBe(true)
    expect(auth.can('ver usuarios')).toBe(false)
  })
})
