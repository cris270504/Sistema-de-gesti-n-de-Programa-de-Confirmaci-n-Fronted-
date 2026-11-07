import { describe, it, expect, vi, beforeEach } from 'vitest'

const fire = vi.fn(() => Promise.resolve({}))
vi.mock('sweetalert2', () => ({ default: { fire: (...a) => fire(...a) } }))

import {
  MENSAJE_JUSTIFICACION, PASOS_JUSTIFICACION,
  debeBloquearJustificada, mostrarAvisoJustificacion, puedeMarcarJustificada,
} from './avisoJustificacion'

describe('lib/avisoJustificacion — regla', () => {
  it('solo coordinador y super-admin pueden marcar justificada', () => {
    expect(puedeMarcarJustificada(['coordinador'])).toBe(true)
    expect(puedeMarcarJustificada(['super-admin'])).toBe(true)
    expect(puedeMarcarJustificada(['catequista'])).toBe(false)
    expect(puedeMarcarJustificada([])).toBe(false)
  })

  it('al catequista se le bloquea elegir justificada', () => {
    expect(debeBloquearJustificada({ nuevoEstado: 'falta justificada', estadoActual: null, roles: ['catequista'] })).toBe(true)
    expect(debeBloquearJustificada({ nuevoEstado: 'falta justificada', estadoActual: 'falta injustificada', roles: ['catequista'] })).toBe(true)
  })

  it('no bloquea otros estados, ni desmarcar una justificada existente, ni al coordinador', () => {
    expect(debeBloquearJustificada({ nuevoEstado: 'falta injustificada', estadoActual: null, roles: ['catequista'] })).toBe(false)
    expect(debeBloquearJustificada({ nuevoEstado: 'falta justificada', estadoActual: 'falta justificada', roles: ['catequista'] })).toBe(false)
    expect(debeBloquearJustificada({ nuevoEstado: 'falta justificada', estadoActual: null, roles: ['coordinador'] })).toBe(false)
  })
})

describe('lib/avisoJustificacion — aviso', () => {
  beforeEach(() => fire.mockClear())

  it('muestra el mensaje y el "?" despliega el proceso en el mismo aviso', () => {
    mostrarAvisoJustificacion()
    const opciones = fire.mock.calls[0][0]
    expect(opciones.confirmButtonText).toBe('Entendido')

    const popup = document.createElement('div')
    popup.innerHTML = opciones.html
    expect(popup.textContent).toContain(MENSAJE_JUSTIFICACION)
    expect(popup.textContent).toContain(PASOS_JUSTIFICACION[2])
    expect(PASOS_JUSTIFICACION[2]).toContain('se registra el acuerdo: motivo')

    opciones.didOpen(popup)
    const boton = popup.querySelector('.aviso-justif__ayuda')
    const proceso = popup.querySelector('.aviso-justif__proceso')
    expect(proceso.hidden).toBe(true)
    boton.click()
    expect(proceso.hidden).toBe(false)
    expect(boton.getAttribute('aria-expanded')).toBe('true')
    boton.click()
    expect(proceso.hidden).toBe(true)
  })
})
