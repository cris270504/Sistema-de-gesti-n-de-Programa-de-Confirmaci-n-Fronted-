import { describe, it, expect, vi } from 'vitest'

function makeQueryBuilder(resolveValue) {
  const builder = {
    select: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    range: vi.fn(() => builder),
    then: (resolve) => resolve(resolveValue),
  }
  return builder
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))

import { supabase } from '@/lib/supabase'
import { buscarApoderados, getConfirmandosPaginado } from './confirmandos'

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

describe('services/confirmandos — getConfirmandosPaginado', () => {
  it('pide con count exact, ordena y pagina con range', async () => {
    const builder = makeQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(builder)

    await getConfirmandosPaginado({ page: 1, pageSize: 25, filters: {} })

    expect(supabase.from).toHaveBeenCalledWith('confirmandos')
    expect(builder.select).toHaveBeenCalledWith(expect.any(String), { count: 'exact' })
    expect(builder.order).toHaveBeenCalledWith('id', { ascending: false })
    expect(builder.range).toHaveBeenCalledWith(0, 24)
  })

  it('calcula el range correcto para una página distinta de la 1', async () => {
    const builder = makeQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(builder)

    await getConfirmandosPaginado({ page: 3, pageSize: 25, filters: {} })

    expect(builder.range).toHaveBeenCalledWith(50, 74)
  })

  it('filtra por estado con eq cuando no es "todos"', async () => {
    const builder = makeQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(builder)

    await getConfirmandosPaginado({ filters: { estado: 'confirmado' } })

    expect(builder.eq).toHaveBeenCalledWith('estado', 'confirmado')
  })

  it('no filtra por estado cuando es "todos"', async () => {
    const builder = makeQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(builder)

    await getConfirmandosPaginado({ filters: { estado: 'todos' } })

    expect(builder.eq).not.toHaveBeenCalledWith('estado', expect.anything())
  })

  it('filtra "sin_grupo" con is(grupo_id, null)', async () => {
    const builder = makeQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(builder)

    await getConfirmandosPaginado({ filters: { grupo: 'sin_grupo' } })

    expect(builder.is).toHaveBeenCalledWith('grupo_id', null)
  })

  it('filtra por grupo_id numérico con eq', async () => {
    const builder = makeQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(builder)

    await getConfirmandosPaginado({ filters: { grupo: '7' } })

    expect(builder.eq).toHaveBeenCalledWith('grupo_id', 7)
  })

  it('usa embed !inner y filtra grupo.procedencia cuando el filtro está activo', async () => {
    const builder = makeQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(builder)

    await getConfirmandosPaginado({ filters: { procedencia: 'parroquia' } })

    expect(builder.select.mock.calls[0][0]).toContain('grupo:grupos!inner(')
    expect(builder.eq).toHaveBeenCalledWith('grupo.procedencia', 'parroquia')
  })

  it('normaliza (sin tildes/minúsculas) y escapa el término antes del ilike sobre nombre_busqueda', async () => {
    const builder = makeQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(builder)

    await getConfirmandosPaginado({ filters: { search: 'José 50%_off' } })

    expect(builder.ilike).toHaveBeenCalledWith('nombre_busqueda', '%jose 50\\%\\_off%')
  })

  it('devuelve items aplanados y total desde count', async () => {
    const row = { id: 1, nombres: 'A', confirmando_sacramento: [{ estado: 'pendiente', sacramento: { id: 1, nombre: 'Bautismo' } }] }
    const builder = makeQueryBuilder({ data: [row], error: null, count: 42 })
    supabase.from.mockReturnValue(builder)

    const result = await getConfirmandosPaginado({})

    expect(result.total).toBe(42)
    expect(result.items[0].sacramentos[0].nombre).toBe('Bautismo')
  })

  it('traduce el error de Supabase a un mensaje legible', async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: 'permission denied for table confirmandos' }, count: null })
    supabase.from.mockReturnValue(builder)

    await expect(getConfirmandosPaginado({})).rejects.toThrow()
  })
})
