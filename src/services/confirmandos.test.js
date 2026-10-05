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
import { buscarApoderados, getConfirmandosExport, getConfirmandosPaginado } from './confirmandos'

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

describe('services/confirmandos — getConfirmandosExport', () => {
  // Builder cuya resolución cambia en cada `await` (una respuesta por página).
  function makePagedBuilder(pages) {
    const queue = [...pages]
    const builder = {
      select: vi.fn(() => builder),
      order: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      range: vi.fn(() => builder),
      then: (resolve) => resolve(queue.shift() ?? { data: [], error: null }),
    }
    return builder
  }
  const filas = (n, desde = 1) => Array.from({ length: n }, (_, i) => ({ id: desde + i, nombres: 'N' }))

  it('trae todas las páginas de 1000 en 1000 hasta recibir una incompleta', async () => {
    const builder = makePagedBuilder([
      { data: filas(1000), error: null },
      { data: filas(1000, 1001), error: null },
      { data: filas(5, 2001), error: null },
    ])
    supabase.from.mockReturnValue(builder)

    const result = await getConfirmandosExport({ filters: {} })

    expect(builder.range).toHaveBeenNthCalledWith(1, 0, 999)
    expect(builder.range).toHaveBeenNthCalledWith(2, 1000, 1999)
    expect(builder.range).toHaveBeenNthCalledWith(3, 2000, 2999)
    expect(result).toHaveLength(2005)
  })

  it('se detiene tras la primera página si viene incompleta', async () => {
    const builder = makePagedBuilder([{ data: filas(3), error: null }])
    supabase.from.mockReturnValue(builder)

    const result = await getConfirmandosExport({ filters: {} })

    expect(builder.range).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(3)
  })

  it('aplica los mismos filtros que el listado (estado, grupo, procedencia, búsqueda)', async () => {
    const builder = makePagedBuilder([{ data: [], error: null }])
    supabase.from.mockReturnValue(builder)

    await getConfirmandosExport({
      filters: { estado: 'retirado', grupo: '4', procedencia: 'sede', search: 'José' },
    })

    expect(builder.select.mock.calls[0][0]).toContain('grupo:grupos!inner(')
    expect(builder.eq).toHaveBeenCalledWith('estado', 'retirado')
    expect(builder.eq).toHaveBeenCalledWith('grupo_id', 4)
    expect(builder.eq).toHaveBeenCalledWith('grupo.procedencia', 'sede')
    expect(builder.ilike).toHaveBeenCalledWith('nombre_busqueda', '%jose%')
  })

  it('selecciona apoderados y requisitos y ordena de forma estable', async () => {
    const builder = makePagedBuilder([{ data: [], error: null }])
    supabase.from.mockReturnValue(builder)

    await getConfirmandosExport({ filters: {} })

    const select = builder.select.mock.calls[0][0]
    expect(select).toContain('confirmando_apoderado(')
    expect(select).toContain('confirmando_requisito(')
    expect(builder.order).toHaveBeenCalledWith('apellidos', { ascending: true })
    expect(builder.order).toHaveBeenCalledWith('id', { ascending: true })
  })

  it('aplana sacramentos, requisitos y apoderados', async () => {
    const row = {
      id: 1,
      confirmando_sacramento: [{ estado: 'pendiente', sacramento: { id: 1, nombre: 'Bautismo' } }],
      confirmando_requisito: [{ estado: 'entregado', fecha_entrega: null, requisito: { id: 2, nombre: 'Partida' } }],
      confirmando_apoderado: [{ tipo_apoderado_id: 1, apoderado: { id: 3, nombres: 'Ana', apellidos: 'Paz', celular: '1' } }],
    }
    supabase.from.mockReturnValue(makePagedBuilder([{ data: [row], error: null }]))

    const [c] = await getConfirmandosExport({ filters: {} })

    expect(c.sacramentos[0].pivot.estado).toBe('pendiente')
    expect(c.requisitos[0].nombre).toBe('Partida')
    expect(c.apoderados[0].pivot.tipo_apoderado_id).toBe(1)
  })

  it('traduce el error de Supabase y no devuelve resultados parciales', async () => {
    supabase.from.mockReturnValue(
      makePagedBuilder([{ data: null, error: { message: 'permission denied for table confirmandos' } }]),
    )

    await expect(getConfirmandosExport({ filters: {} })).rejects.toThrow()
  })
})
