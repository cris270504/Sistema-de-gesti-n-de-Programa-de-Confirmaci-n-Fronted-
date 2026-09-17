import { describe, it, expect, vi } from 'vitest'

function makeQueryBuilder(resolveValue) {
  const builder = {
    select: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve) => resolve(resolveValue),
  }
  return builder
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))

import { supabase } from '@/lib/supabase'
import { buscarApoderados } from './confirmandos'

describe('services/confirmandos — buscarApoderados', () => {
  it('escapa "%" y "_" del término antes de armar el patrón ilike', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(builder)

    await buscarApoderados('50%_off')

    // Sin escapar, "%" y "_" son wildcards de ILIKE y alteran el patrón de
    // búsqueda (bug de autocompletado). Escapados, deben viajar como texto
    // literal dentro del patrón *...*.
    expect(builder.or).toHaveBeenCalledWith(
      'nombres.ilike.*50\\%\\_off*,apellidos.ilike.*50\\%\\_off*',
    )
  })

  it('no rompe términos normales sin caracteres especiales', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(builder)

    await buscarApoderados('Garcia')

    expect(builder.or).toHaveBeenCalledWith('nombres.ilike.*Garcia*,apellidos.ilike.*Garcia*')
  })
})
