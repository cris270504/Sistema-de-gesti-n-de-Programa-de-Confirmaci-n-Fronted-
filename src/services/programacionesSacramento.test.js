import { describe, it, expect, vi, beforeEach } from 'vitest'

function makeQueryBuilder(resolveValue) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(() => builder),
    then: (resolve) => resolve(resolveValue),
  }
  return builder
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

import { supabase } from '@/lib/supabase'
import {
  resumirProgramacion,
  getProgramacionById,
  getElegibles,
  programarSacramento,
  registrarSacramentos,
  cancelarProgramacion,
} from './programacionesSacramento'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('services/programacionesSacramento — resumirProgramacion', () => {
  it('cuenta jóvenes distintos (no pares joven-sacramento) y quiénes recibieron el principal', () => {
    const row = {
      id: 1,
      sacramento_id: 3,
      detalle: [
        { confirmando_id: 10, sacramento_id: 3, recibio: true },
        { confirmando_id: 10, sacramento_id: 1, recibio: true }, // también Bautismo
        { confirmando_id: 11, sacramento_id: 3, recibio: false },
        { confirmando_id: 12, sacramento_id: 3, recibio: null },
      ],
    }
    const r = resumirProgramacion(row)
    expect(r.total_jovenes).toBe(3)
    expect(r.total_recibieron).toBe(1)
  })

  it('tolera una celebración sin detalle', () => {
    expect(resumirProgramacion({ id: 1, sacramento_id: 3 })).toMatchObject({ total_jovenes: 0, total_recibieron: 0 })
  })
})

describe('services/programacionesSacramento — getProgramacionById', () => {
  it('agrupa el detalle por joven, ordena sus sacramentos por ruta y a los jóvenes por apellido', async () => {
    const conf = (id, apellidos) => ({ id, nombres: 'X', apellidos, estado: 'en_preparacion', grupo: null })
    supabase.from.mockReturnValue(makeQueryBuilder({
      data: {
        id: 5,
        sacramento_id: 3,
        fecha: '2026-11-07 10:00:00',
        estado: 'programada',
        detalle: [
          { confirmando_id: 2, sacramento_id: 3, recibio: null, confirmando: conf(2, 'Ñañez'), sacramento: { id: 3, nombre: 'Confirmación', clave: 'confirmacion' } },
          { confirmando_id: 1, sacramento_id: 3, recibio: null, confirmando: conf(1, 'Álvarez'), sacramento: { id: 3, nombre: 'Confirmación', clave: 'confirmacion' } },
          { confirmando_id: 1, sacramento_id: 1, recibio: null, confirmando: conf(1, 'Álvarez'), sacramento: { id: 1, nombre: 'Bautismo', clave: 'bautismo' } },
        ],
      },
      error: null,
    }))

    const prog = await getProgramacionById('5')

    expect(prog.jovenes.map((j) => j.confirmando_id)).toEqual([1, 2])
    expect(prog.jovenes[0].sacramentos.map((s) => s.clave)).toEqual(['bautismo', 'confirmacion'])
    expect(prog.total_jovenes).toBe(2)
  })
})

describe('services/programacionesSacramento — RPCs', () => {
  it('getElegibles manda ids numéricos y null cuando no se edita', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ confirmando_id: 1, anteriores: null }], error: null })

    const r = await getElegibles('3')

    expect(supabase.rpc).toHaveBeenCalledWith('fn_elegibles_sacramento', { p_sacramento_id: 3, p_programacion_id: null })
    expect(r[0].anteriores).toEqual([])
  })

  it('programarSacramento normaliza el payload de la RPC', async () => {
    supabase.rpc.mockResolvedValue({ data: 9, error: null })

    const id = await programarSacramento({
      sacramentoId: '3',
      fecha: '2026-11-07 10:00',
      items: [{ confirmando_id: '10', sacramento_ids: ['3', '1'] }, { confirmando_id: 11 }],
    })

    expect(id).toBe(9)
    expect(supabase.rpc).toHaveBeenCalledWith('fn_programar_sacramento', {
      p_id: null,
      p_sacramento_id: 3,
      p_fecha: '2026-11-07 10:00',
      p_items: [
        { confirmando_id: 10, sacramento_ids: [3, 1] },
        { confirmando_id: 11, sacramento_ids: [] },
      ],
    })
  })

  it('registrarSacramentos convierte recibio a booleano', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null })

    await registrarSacramentos(4, [{ confirmando_id: '10', sacramento_id: '3', recibio: undefined }])

    expect(supabase.rpc).toHaveBeenCalledWith('fn_registrar_sacramentos', {
      p_id: 4,
      p_items: [{ confirmando_id: 10, sacramento_id: 3, recibio: false }],
    })
  })

  it('propaga el mensaje redactado de la RPC (no el error crudo)', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Solo se puede cancelar una celebración que aún no se registra' },
    })

    await expect(cancelarProgramacion(4)).rejects.toThrow('Solo se puede cancelar una celebración que aún no se registra')
  })
})
