import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

function makeQueryBuilder(resolveValue) {
  const builder = {
    select: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve) => resolve(resolveValue),
  }
  return builder
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))

import { supabase } from '@/lib/supabase'
import { getUpcomingReuniones } from './reunions'

describe('services/reunions — getUpcomingReuniones', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 2026-01-15T02:30:00Z: son las 21:30 del 14 de enero en America/Lima
    // (UTC-5) y las 03:30 del 15 de enero en Europe/Madrid (UTC+1, invierno).
    vi.setSystemTime(new Date('2026-01-15T02:30:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('compara "ahora" en la hora LOCAL de la parroquia, no en UTC crudo', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(builder)

    await getUpcomingReuniones('America/Lima')

    // Antes del fix se comparaba contra '2026-01-15T02:30:00' (UTC sin decirlo),
    // que en Lima corresponde a las 21:30 del día anterior: reuniones de esa
    // noche (fecha guardada en hora local) quedaban descartadas por error.
    expect(builder.gte).toHaveBeenCalledWith('fecha', '2026-01-14T21:30:00')
  })

  it('usa la zona horaria correcta para otra parroquia (zona distinta)', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(builder)

    await getUpcomingReuniones('Europe/Madrid')

    expect(builder.gte).toHaveBeenCalledWith('fecha', '2026-01-15T03:30:00')
  })

  it('usa America/Lima como zona por defecto si no se pasa ninguna', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(builder)

    await getUpcomingReuniones()

    expect(builder.gte).toHaveBeenCalledWith('fecha', '2026-01-14T21:30:00')
  })
})
