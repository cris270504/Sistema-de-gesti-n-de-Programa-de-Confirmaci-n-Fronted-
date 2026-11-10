import { describe, it, expect } from 'vitest'
import {
  sacramentosFiltrables,
  sacramentosPendientes,
  filtrarPorFaltante,
  etiquetaFaltante,
  nombreArchivoExport,
  tituloExport,
  columnasPorClave,
  construirFilas,
} from './exportConfirmandos'

const SAC = [
  { id: 3, nombre: 'Confirmación', clave: 'confirmacion' },
  { id: 2, nombre: 'Primera Comunión', clave: 'comunion' },
  { id: 1, nombre: 'Bautismo', clave: 'bautismo' },
]
const con = (id, estados) => ({
  id,
  sacramentos: Object.entries(estados).map(([sid, estado]) => ({
    ...SAC.find((s) => s.id === Number(sid)), pivot: { estado },
  })),
})

const ana = con(1, { 1: 'recibido', 2: 'pendiente', 3: 'pendiente' })
const beto = con(2, { 1: 'pendiente', 2: 'pendiente', 3: 'pendiente' })
const caro = con(3, { 1: 'recibido', 2: 'recibido', 3: 'pendiente' })
const dani = con(4, {}) // sin registro: no cuenta como "le falta"
const todos = [ana, beto, caro, dani]

describe('lib/exportConfirmandos — sacramentos que faltan', () => {
  it('excluye Confirmación y ordena Bautismo → Comunión', () => {
    expect(sacramentosFiltrables(SAC).map((s) => s.id)).toEqual([1, 2])
  })

  it('lista solo los pendientes, sin Confirmación', () => {
    expect(sacramentosPendientes(beto).map((s) => s.nombre)).toEqual(['Bautismo', 'Primera Comunión'])
    expect(sacramentosPendientes(caro)).toEqual([])
  })

  it('ignora vínculos a sacramentos no visibles (sin id)', () => {
    const raro = { sacramentos: [{ pivot: { estado: 'pendiente' } }] }
    expect(sacramentosPendientes(raro)).toEqual([])
  })

  it('filtra por alguno o por un sacramento concreto', () => {
    expect(filtrarPorFaltante(todos, 'todos')).toHaveLength(4)
    expect(filtrarPorFaltante(todos, 'alguno').map((c) => c.id)).toEqual([1, 2])
    expect(filtrarPorFaltante(todos, '1').map((c) => c.id)).toEqual([2])
    expect(filtrarPorFaltante(todos, 2).map((c) => c.id)).toEqual([1, 2])
  })

  it('arma etiqueta, título y nombre de archivo', () => {
    expect(etiquetaFaltante('todos', SAC)).toBeNull()
    expect(etiquetaFaltante('alguno', SAC)).toBe('Les falta algún sacramento')
    const t = etiquetaFaltante('2', SAC)
    expect(t).toBe('Les falta Primera Comunión')
    expect(tituloExport('en_preparacion', t)).toBe('Confirmandos – En preparación · Les falta Primera Comunión')
    expect(nombreArchivoExport({ estado: 'en_preparacion', fecha: new Date(2026, 10, 10), extension: 'pdf', faltante: t }))
      .toBe('confirmandos_en-preparacion_les-falta-primera-comunion_2026-11-10.pdf')
  })

  it('la columna «Le falta» muestra los pendientes', () => {
    const [col] = columnasPorClave(['pendientes'])
    expect(col.label).toBe('Le falta')
    expect(construirFilas([beto, caro], [col])).toEqual([['Bautismo, Primera Comunión'], ['']])
  })
})
