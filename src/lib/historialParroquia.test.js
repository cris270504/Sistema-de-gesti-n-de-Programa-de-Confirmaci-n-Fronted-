import { describe, it, expect } from 'vitest'
import { describirCambio } from './historialParroquia'

describe('lib/historialParroquia', () => {
  it('describe cambios de configuración sin repetir campos', () => {
    expect(describirCambio({ accion: 'configuracion', detalle: { campos: ['grupos_edad_min', 'grupos_edad_max', 'contacto'] } }))
      .toEqual({ texto: 'Cambió la configuración:', objetivo: 'edades de grupos, contacto', extra: '', tono: 'normal' })
  })

  it('marca retiros como peligro y confirmaciones como ok', () => {
    expect(describirCambio({ accion: 'confirmando_estado', detalle: { nombre: 'Ruiz, Ana', de: 'en_preparacion', a: 'retirado' } }))
      .toEqual({ texto: 'Cambió el estado de', objetivo: 'Ruiz, Ana', extra: 'de En preparación a Retirado', tono: 'peligro' })
    expect(describirCambio({ accion: 'confirmando_estado', detalle: { a: 'confirmado', de: 'en_preparacion' } }).tono).toBe('ok')
  })

  it('cae a la clave si la acción es desconocida', () => {
    expect(describirCambio({ accion: 'otra_cosa', detalle: {} }).texto).toBe('otra_cosa')
  })
})
