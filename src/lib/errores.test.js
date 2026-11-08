import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/composables/useErrorLogger', () => ({ logFrontendError: vi.fn() }))

import { motivoFalloLogin, LOGIN_MSG, traducirError, esErrorInesperado, errorLegible } from './errores'
import { logFrontendError } from '@/composables/useErrorLogger'

describe('esErrorInesperado / errorLegible', () => {
  beforeEach(() => vi.clearAllMocks())

  it('registra errores de esquema y de PostgREST', () => {
    expect(esErrorInesperado({ code: '42703', message: 'column "x" does not exist' })).toBe(true)
    expect(esErrorInesperado({ code: 'PGRST200', message: 'Could not find a relationship' })).toBe(true)
    errorLegible({ code: '42883', message: 'function fn_x() does not exist' })
    expect(logFrontendError).toHaveBeenCalledWith('[API 42883] function fn_x() does not exist', expect.any(String))
  })

  it('no registra validaciones, permisos, "no encontrado" ni red', () => {
    expect(esErrorInesperado({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(esErrorInesperado({ code: 'P0001', message: 'El nombre es obligatorio.' })).toBe(false)
    expect(esErrorInesperado({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(esErrorInesperado({ code: 'PGRST116', message: '0 rows' })).toBe(false)
    expect(esErrorInesperado(new TypeError('Failed to fetch'))).toBe(false)
    errorLegible({ code: '23505', message: 'duplicate key value violates unique constraint "x"' })
    expect(logFrontendError).not.toHaveBeenCalled()
  })
})

describe('motivoFalloLogin', () => {
  it('sin red → sin conexión', () => {
    expect(motivoFalloLogin(new Error('x'), false)).toBe(LOGIN_MSG.sinConexion)
  })
  it('fetch fallido → sin conexión', () => {
    const e = Object.assign(new Error('Failed to send a request'), { name: 'FunctionsFetchError' })
    expect(motivoFalloLogin(e, true)).toBe(LOGIN_MSG.sinConexion)
    expect(motivoFalloLogin(new TypeError('Failed to fetch'), true)).toBe(LOGIN_MSG.sinConexion)
  })
  it('429 → demasiados intentos', () => {
    expect(motivoFalloLogin({ status: 429, message: '' }, true)).toBe(LOGIN_MSG.demasiados)
    expect(motivoFalloLogin({ name: 'FunctionsHttpError', context: { status: 429 } }, true)).toBe(LOGIN_MSG.demasiados)
  })
  it('5xx o relay → servicio no disponible', () => {
    expect(motivoFalloLogin({ status: 503 }, true)).toBe(LOGIN_MSG.servicio)
    expect(motivoFalloLogin({ name: 'AuthRetryableFetchError', status: 502 }, true)).toBe(LOGIN_MSG.servicio)
    expect(motivoFalloLogin({ name: 'FunctionsRelayError' }, true)).toBe(LOGIN_MSG.servicio)
  })
  it('credenciales malas o identificador inexistente → mismo mensaje', () => {
    expect(motivoFalloLogin({ status: 400, message: 'Invalid login credentials' }, true)).toBe(LOGIN_MSG.credenciales)
    expect(motivoFalloLogin({ name: 'FunctionsHttpError', context: { status: 404 } }, true)).toBe(LOGIN_MSG.credenciales)
    expect(motivoFalloLogin(null, true)).toBe(LOGIN_MSG.credenciales)
  })
})

describe('motivoFalloLogin con respuesta de la Edge Function login', () => {
  const httpErr = (status) => ({ name: 'FunctionsHttpError', context: { status } })
  it('parroquia desactivada', () => {
    expect(motivoFalloLogin(httpErr(403), true, { error: 'parroquia_inactiva' })).toBe(LOGIN_MSG.parroquiaInactiva)
  })
  it('bloqueo con minutos restantes', () => {
    expect(motivoFalloLogin(httpErr(429), true, { error: 'demasiados_intentos', retry_after: 670 }))
      .toBe('Demasiados intentos. Vuelve a intentar en 12 min.')
  })
  it('credenciales', () => {
    expect(motivoFalloLogin(httpErr(401), true, { error: 'credenciales' })).toBe(LOGIN_MSG.credenciales)
  })
  it('error del servidor', () => {
    expect(motivoFalloLogin(httpErr(500), true, { error: 'server_error' })).toBe(LOGIN_MSG.servicio)
  })
})

describe('traducirError', () => {
  it('oculta errores crudos de Postgres', () => {
    expect(traducirError({ message: 'duplicate key value violates unique constraint "x"', code: '23505' }))
      .toBe('Ya existe un registro con esos datos.')
  })
  it('traduce fallo de red', () => {
    expect(traducirError(new TypeError('Failed to fetch'))).toMatch(/conexión/i)
  })
})
