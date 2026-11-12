import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { cicloReabrible, filtrarArchivados } = await import('./ciclos')

describe('services/ciclos', () => {
  it('solo se puede reabrir el último cierre, y si fue «mantener»', () => {
    expect(cicloReabrible([{ id: 2, modo: 'mantener' }, { id: 1, modo: 'mantener' }])?.id).toBe(2)
    expect(cicloReabrible([{ id: 2, modo: 'eliminar' }, { id: 1, modo: 'mantener' }])).toBeNull()
    expect(cicloReabrible([{ id: 2, modo: 'mantener', reabierto_at: 'x' }, { id: 1, modo: 'mantener' }])?.id).toBe(1)
    expect(cicloReabrible([])).toBeNull()
  })

  it('busca archivados sin importar tildes ni mayúsculas', () => {
    const lista = [{ apellidos: 'Antón Sánchez', nombres: 'Dariana' }, { apellidos: 'Paz', nombres: 'Luis' }]
    expect(filtrarArchivados(lista, 'anton')).toHaveLength(1)
    expect(filtrarArchivados(lista, '  ')).toHaveLength(2)
    expect(filtrarArchivados(lista, 'xyz')).toHaveLength(0)
  })
})
