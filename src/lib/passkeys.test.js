import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: { auth: {} } }))

import { mensajePasskey } from './passkeys'

describe('mensajePasskey', () => {
  it('cancelar el diálogo del sistema no es un error (null)', () => {
    expect(mensajePasskey(Object.assign(new Error('The operation either timed out or was not allowed.'), { name: 'NotAllowedError' }))).toBeNull()
    expect(mensajePasskey({ name: 'AbortError', message: 'aborted' })).toBeNull()
  })

  it('huella no vinculada a ninguna cuenta', () => {
    expect(mensajePasskey({ code: 'webauthn_credential_not_found' })).toMatch(/no está vinculada/)
  })

  it('función no habilitada en el servidor', () => {
    expect(mensajePasskey({ code: 'passkey_disabled' })).toMatch(/todavía no está habilitado/)
  })

  it('dispositivo ya registrado y límite de dispositivos', () => {
    expect(mensajePasskey({ code: 'webauthn_credential_exists' })).toMatch(/ya está registrado/)
    expect(mensajePasskey({ code: 'too_many_passkeys' })).toMatch(/máximo de dispositivos/)
  })

  it('cualquier otro error: mensaje genérico con salida', () => {
    expect(mensajePasskey({ code: 'algo_raro', message: 'x' })).toMatch(/Entra con tu contraseña/)
  })
})
