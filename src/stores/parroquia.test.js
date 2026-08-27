import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }))
vi.mock('@/funciones', () => ({ showAlerta: vi.fn(), showErroresDeValidacion: vi.fn() }))

import { useParroquiaStore, CONFIG_DEFAULTS } from './parroquia'

describe('stores/parroquia', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('arranca con los defaults cuando no hay nada guardado', () => {
    const s = useParroquiaStore()
    expect(s.configuracion.dias_ventana_justificacion).toBe(21)
    expect(s.tiposReunion).toEqual(CONFIG_DEFAULTS.tipos_reunion)
    expect(s.branding.color_primario).toBe('#2563eb')
    expect(s.nombreApp).toBe('SGPC')
  })

  it('hydrateFromLogin guarda parroquia + config y persiste en localStorage', () => {
    const s = useParroquiaStore()
    s.hydrateFromLogin({
      parroquia: { id: 1, slug: 'scj', nombre: 'Parroquia SCJ' },
      configuracion: { ...CONFIG_DEFAULTS, dias_ventana_justificacion: 7, branding: { ...CONFIG_DEFAULTS.branding, nombre_publico: 'SCJ' } },
    })

    expect(s.configuracion.dias_ventana_justificacion).toBe(7)
    expect(s.nombreApp).toBe('SCJ')

    const saved = JSON.parse(localStorage.getItem('parroquia'))
    expect(saved.parroquia.slug).toBe('scj')
    expect(saved.configuracion.dias_ventana_justificacion).toBe(7)
  })

  it('rehidrata desde localStorage al crear el store', () => {
    localStorage.setItem('parroquia', JSON.stringify({
      parroquia: { id: 2, nombre: 'Otra' },
      configuracion: { tipos_reunion: ['Confirmandos'] },
    }))

    const s = useParroquiaStore()
    expect(s.tiposReunion).toEqual(['Confirmandos'])
    // Las claves ausentes caen a los defaults
    expect(s.configuracion.dias_ventana_justificacion).toBe(21)
    expect(s.nombreApp).toBe('Otra')
  })

  it('clear vuelve a defaults y limpia localStorage', () => {
    const s = useParroquiaStore()
    s.hydrateFromLogin({ parroquia: { id: 1, nombre: 'X' }, configuracion: { dias_ventana_justificacion: 5 } })
    s.clear()

    expect(s.parroquia).toBeNull()
    expect(s.configuracion.dias_ventana_justificacion).toBe(21)
    expect(localStorage.getItem('parroquia')).toBeNull()
  })
})
