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

describe('services/proveedor — gestores, historial y errores', async () => {
  const { filtrarGestores, describirAuditoria, resumirErroresRecientes } = await import('./proveedor')

  it('deja solo super-admin y coordinadores, super-admin primero', () => {
    const r = filtrarGestores([
      { id: 1, name: 'Zoe', roles: [{ name: 'coordinador' }] },
      { id: 2, name: 'Ana', roles: [{ name: 'catequista' }] },
      { id: 3, name: 'Luis', roles: [{ name: 'super-admin' }, { name: 'coordinador' }] },
    ])
    expect(r.map((u) => [u.id, u.rol])).toEqual([[3, 'super-admin'], [1, 'coordinador']])
  })

  it('describe las acciones del historial', () => {
    expect(describirAuditoria({ accion: 'renombrar', parroquia_nombre: 'B', detalle: { antes: 'A', despues: 'B' } }))
      .toEqual({ accion: 'Renombró', objetivo: 'A', extra: 'ahora «B»' })
    expect(describirAuditoria({ accion: 'mantenimiento_on', detalle: { alcance: 'todas' } }))
      .toEqual({ accion: 'Activó el mantenimiento', objetivo: '', extra: 'en todas las parroquias' })
    expect(describirAuditoria({ accion: 'restablecer_contrasena', parroquia_nombre: 'P', detalle: { usuario: 'Ana' } }).extra)
      .toBe('de Ana')
  })

  it('agrupa errores recientes por parroquia', () => {
    const r = resumirErroresRecientes(
      [{ parroquia_id: 1 }, { parroquia_id: 1 }, { parroquia_id: null }],
      [{ id: 1, nombre: 'SCJ' }],
    )
    expect(r).toEqual({ total: 3, parroquias: [{ id: 1, nombre: 'SCJ', n: 2 }, { id: null, nombre: 'Sin parroquia', n: 1 }] })
  })
})
