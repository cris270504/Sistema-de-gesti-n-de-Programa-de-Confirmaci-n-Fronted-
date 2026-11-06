import { describe, it, expect } from 'vitest'
import { calcular, duracionTexto, fmt12, partesFecha, rango, toHHMM, toMin, nombreArchivo } from './cronograma'

const m = (id, duracion_min, extra = {}) => ({ id, nombre: `M${id}`, duracion_min, en_cronograma: true, orden: id, ...extra })

describe('lib/cronograma — utilidades de hora', () => {
  it('convierte entre HH:MM y minutos', () => {
    expect(toMin('08:30')).toBe(510)
    expect(toMin('')).toBeNull()
    expect(toHHMM(510)).toBe('08:30')
    expect(toHHMM(-30)).toBe('23:30')
  })

  it('formatea en 12 horas y rangos', () => {
    expect(fmt12(0)).toBe('12:00 am')
    expect(fmt12(13 * 60 + 5)).toBe('1:05 pm')
    expect(rango(480, 510)).toBe('8:00 am – 8:30 am')
  })

  it('describe la duración', () => {
    expect(duracionTexto(45)).toBe('45 min')
    expect(duracionTexto(60)).toBe('1 h')
    expect(duracionTexto(95)).toBe('1 h 35 min')
    expect(duracionTexto(null)).toBe('')
  })

  it('lee la hora del timestamp sin convertir zona', () => {
    expect(partesFecha('2026-11-20 07:30:00')).toEqual({ fecha: '2026-11-20', hora: '07:30' })
    expect(partesFecha('2026-11-20T18:05:00')).toEqual({ fecha: '2026-11-20', hora: '18:05' })
  })

  it('limpia el nombre de archivo', () => {
    expect(nombreArchivo('Retiro: 1/2 "final"')).toBe('Retiro 12 final')
  })
})

describe('lib/cronograma — calcular', () => {
  it('encadena desde la hora de la reunión, sin huecos', () => {
    const c = calcular('2026-11-20 08:00:00', [m(1, 30), m(2, 60), m(3, 15)])
    expect(c.filas.map((f) => [f.inicio, f.fin])).toEqual([[480, 510], [510, 570], [570, 585]])
    expect(c.total).toBe(105)
    expect(c.claveActiva).toBe(false)
  })

  it('respeta el orden y separa "Sin hora definida"', () => {
    const c = calcular('2026-11-20 08:00:00', [
      m(1, 30, { orden: 2 }), m(2, 10, { orden: 1 }), m(3, null, { en_cronograma: false, orden: 0 }),
    ])
    expect(c.filas.map((f) => f.id)).toEqual([2, 1])
    expect(c.sinHora.map((f) => f.id)).toEqual([3])
  })

  it('con momento clave, el inicio es clave − duraciones previas', () => {
    const c = calcular('2026-11-20 08:00:00', [m(1, 30), m(2, 60), m(3, 60, { es_clave: true, clave_hora: '11:00:00' })])
    expect(c.inicio).toBe(9 * 60 + 30)
    expect(c.filas[2]).toMatchObject({ inicio: 660, esClave: true })
    expect(c.claveActiva).toBe(true)
  })

  it('sin momentos devuelve totales en cero', () => {
    const c = calcular('2026-11-20 08:00:00', [])
    expect(c).toMatchObject({ inicio: 480, fin: 480, total: 0, filas: [], sinHora: [] })
  })
})
