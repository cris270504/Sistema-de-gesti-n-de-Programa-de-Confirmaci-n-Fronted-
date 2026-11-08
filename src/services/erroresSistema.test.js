import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { agruparErrores } from './erroresSistema'

describe('agruparErrores', () => {
  it('agrupa por mensaje, cuenta y ordena por el más reciente', () => {
    const filas = [
      { message: 'A', created_at: '2026-11-01T10:00:00Z', parroquia_id: 1, user_id: 10 },
      { message: 'B', created_at: '2026-11-03T10:00:00Z', parroquia_id: 2, user_id: 20 },
      { message: 'A', created_at: '2026-11-02T10:00:00Z', parroquia_id: 2, user_id: 10 },
    ]
    const g = agruparErrores(filas)
    expect(g.map((x) => x.message)).toEqual(['B', 'A'])
    const a = g[1]
    expect(a.veces).toBe(2)
    expect(a.ultimo).toBe('2026-11-02T10:00:00Z')
    expect(a.primero).toBe('2026-11-01T10:00:00Z')
    expect(a.parroquias.sort()).toEqual([1, 2])
    expect(a.usuarios).toBe(1)
  })

  it('lista vacía', () => {
    expect(agruparErrores([])).toEqual([])
  })
})
