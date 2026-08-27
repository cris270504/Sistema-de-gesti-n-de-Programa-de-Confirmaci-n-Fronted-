import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { LS_TOKEN_KEY, LS_USER_KEY } from '@/constants/auth'

// Mockeamos todo lo que auth.js toca hacia afuera: la instancia de axios, el
// router (evita levantar todas las rutas reales en el test) y las alertas de
// SweetAlert2 (no nos interesa la UI del toast, solo la transición de estado).
vi.mock('@/lib/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}))
vi.mock('@/router', () => ({
  default: { push: vi.fn(), currentRoute: { value: { name: 'dashboard', fullPath: '/' } } },
}))
vi.mock('@/funciones', () => ({
  showAlerta: vi.fn(),
  showErroresDeValidacion: vi.fn(),
}))

import api from '@/lib/api'
import router from '@/router'
import { useAuthStore } from './auth'

describe('stores/auth', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(api.post).mockReset()
    vi.mocked(api.get).mockReset()
    vi.mocked(router.push).mockClear()
  })

  it('login exitoso guarda token/user en el store y en localStorage', async () => {
    api.post.mockResolvedValueOnce({
      data: { token: 'token-123', user: { id: 1, name: 'María', grupo_ids: [10] } },
    })

    const auth = useAuthStore()
    const ok = await auth.login({ login: '12345678', password: 'secreta' })

    expect(ok).toBe(true)
    expect(auth.token).toBe('token-123')
    expect(auth.user).toEqual({ id: 1, name: 'María', grupo_ids: [10] })
    expect(auth.isAuthenticated).toBe(true)
    expect(localStorage.getItem(LS_TOKEN_KEY)).toBe('token-123')
    expect(JSON.parse(localStorage.getItem(LS_USER_KEY))).toEqual({ id: 1, name: 'María', grupo_ids: [10] })
  })

  it('login fallido (credenciales inválidas) limpia el estado y devuelve false', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 401, data: { message: 'Unauthenticated' } } })

    const auth = useAuthStore()
    const ok = await auth.login({ login: 'noexiste@correo.com', password: 'mala' })

    expect(ok).toBe(false)
    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem(LS_TOKEN_KEY)).toBeNull()
  })

  it('logout limpia el estado y redirige al login aunque el POST /logout falle', async () => {
    api.post.mockRejectedValueOnce(new Error('network error')) // logout no debe romperse si esto falla

    const auth = useAuthStore()
    // Simulamos una sesión ya iniciada
    auth.token = 'token-viejo'
    auth.user = { id: 1, name: 'María' }
    localStorage.setItem(LS_TOKEN_KEY, 'token-viejo')
    localStorage.setItem(LS_USER_KEY, JSON.stringify({ id: 1 }))

    await auth.logout()

    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(localStorage.getItem(LS_TOKEN_KEY)).toBeNull()
    expect(router.push).toHaveBeenCalledWith({ name: 'login' })
  })

  it('can() refleja los permissions del usuario logueado', async () => {
    api.post.mockResolvedValueOnce({
      data: { token: 't', user: { id: 1, permissions: ['ver dashboard', 'ver grupos'] } },
    })

    const auth = useAuthStore()
    await auth.login({ login: '1', password: '1' })

    expect(auth.can('ver dashboard')).toBe(true)
    expect(auth.can('ver usuarios')).toBe(false)
  })
})
