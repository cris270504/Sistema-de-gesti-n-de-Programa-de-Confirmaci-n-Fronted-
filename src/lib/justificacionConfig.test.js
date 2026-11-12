import { describe, it, expect } from 'vitest'
import { validarAcciones, validarMotivos } from './justificacionConfig'

const accion = (o = {}) => ({ nombre: 'Lectura', cupo_por_fecha: 3, pide_detalle: false, activo: true, ...o })

describe('lib/justificacionConfig', () => {
  it('valida motivos', () => {
    expect(validarMotivos(['Salud', ' '])).toBe('')
    expect(validarMotivos(['  '])).not.toBe('')
    expect(validarMotivos(['x'.repeat(81)])).not.toBe('')
  })

  it('acepta acciones válidas, con o sin cupo', () => {
    expect(validarAcciones([accion(), accion({ nombre: 'Otros', cupo_por_fecha: '' })])).toBe('')
  })

  it('rechaza nombres vacíos, repetidos y cupos fuera de rango', () => {
    expect(validarAcciones([accion({ nombre: ' ' })])).toMatch(/nombre/)
    expect(validarAcciones([accion(), accion({ nombre: 'lectura ' })])).toMatch(/mismo nombre/)
    expect(validarAcciones([accion({ cupo_por_fecha: 0 })])).toMatch(/entre 1 y 99/)
    expect(validarAcciones([accion({ activo: false })])).toMatch(/activa/)
  })
})
