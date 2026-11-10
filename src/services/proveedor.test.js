import { describe, it, expect, vi, beforeEach } from 'vitest'

const invoke = vi.fn()
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (...a) => invoke(...a) } } }))

const { eliminarParroquia, coincideNombreParroquia } = await import('./proveedor')

describe('services/proveedor — eliminar parroquia', () => {
  beforeEach(() => invoke.mockReset())

  it('compara el nombre sin espacios ni mayúsculas', () => {
    expect(coincideNombreParroquia('  prueba ', 'Prueba')).toBe(true)
    expect(coincideNombreParroquia('Prueb', 'Prueba')).toBe(false)
    expect(coincideNombreParroquia('', 'Prueba')).toBe(false)
  })

  it('llama a la Edge Function con id numérico y confirmación', async () => {
    invoke.mockResolvedValue({ data: { message: 'ok', avisos: [] }, error: null })
    await expect(eliminarParroquia('2', 'Prueba')).resolves.toEqual({ message: 'ok', avisos: [] })
    expect(invoke).toHaveBeenCalledWith('eliminar-parroquia', { body: { id: 2, confirmacion: 'Prueba' } })
  })

  it('usa el mensaje del servidor cuando falla', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ message: 'Primero desactiva la parroquia.' }) } },
    })
    await expect(eliminarParroquia(1, 'X')).rejects.toThrow('Primero desactiva la parroquia.')
  })
})
