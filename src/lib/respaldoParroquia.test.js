import { describe, it, expect } from 'vitest'
import { armarHojasRespaldo, nombreArchivoRespaldo, TIPO_ASISTENTE } from './respaldoParroquia'

describe('lib/respaldoParroquia', () => {
  const datos = {
    confirmandos: [
      { id: 1, nombres: 'Ana', apellidos: 'Ruiz', estado: 'en_preparacion', sacramentos: [], requisitos: [], apoderados: [] },
      { id: 2, nombres: 'Luis', apellidos: 'Paz', estado: 'confirmado', archivado_ciclo_id: 4, sacramentos: [], requisitos: [], apoderados: [] },
    ],
    ciclos: [{ id: 4, nombre: '2025' }],
    apoderados: [{ id: 5, nombres: 'Luz', apellidos: 'Ruiz', celular: '999' }],
    usuarios: [{ id: 9, name: 'Cate', roles: [{ name: 'catequista' }], grupos: [{ nombre: 'G1' }], activo: true }],
    reuniones: [{ id: 3, nombre_tema: 'Tema 1', fecha: '2026-10-01T18:00:00', tipo: 'Confirmandos' }],
    asistencias: [
      { id: 7, reunion_id: 3, asistente_type: TIPO_ASISTENTE.confirmando, asistente_id: 1, estado: 'falta injustificada' },
      { id: 8, reunion_id: 3, asistente_type: TIPO_ASISTENTE.usuario, asistente_id: 9, estado: 'asistio' },
    ],
    justificaciones: [{ asistencia_id: 7, motivo: 'Salud', tipo_accion: 'lectura', estado: 'pendiente', fecha_acuerdo: '2026-10-05' }],
    acciones: [{ clave: 'lectura', nombre: 'Lectura' }],
  }

  it('arma una hoja por tabla', () => {
    expect(armarHojasRespaldo(datos).map((h) => h.titulo)).toEqual(
      ['Jóvenes', 'Apoderados', 'Grupos', 'Usuarios', 'Reuniones', 'Asistencias', 'Justificaciones'])
  })

  it('resuelve nombres de personas y acciones', () => {
    const hojas = Object.fromEntries(armarHojasRespaldo(datos).map((h) => [h.titulo, h]))
    expect(hojas.Asistencias.filas).toEqual([
      ['2026-10-01 18:00', 'Tema 1', 'Joven', 'Ruiz, Ana', 'falta injustificada', ''],
      ['2026-10-01 18:00', 'Tema 1', 'Catequista', 'Cate', 'asistio', ''],
    ])
    expect(hojas.Justificaciones.filas[0]).toEqual(
      ['2026-10-01 18:00', 'Ruiz, Ana', 'Salud', 'Lectura', '', '2026-10-05', 'pendiente'])
    expect(hojas.Usuarios.filas[0]).toEqual(['Cate', '', '', '', 'catequista', 'G1', 'Sí'])
  })

  it('indica el ciclo de cada joven', () => {
    const jovenes = armarHojasRespaldo(datos)[0]
    expect(jovenes.columnas.at(-1).label).toBe('Ciclo')
    expect(jovenes.filas.map((f) => f.at(-1))).toEqual(['Actual', 'Archivado (2025)'])
  })

  it('nombra el archivo con el slug y la fecha', () => {
    expect(nombreArchivoRespaldo('sagrado-corazon', new Date(2026, 10, 12))).toBe('respaldo_sagrado-corazon_2026-11-12.xlsx')
  })
})
