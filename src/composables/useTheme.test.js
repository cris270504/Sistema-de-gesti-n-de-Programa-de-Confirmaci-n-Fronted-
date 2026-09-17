import { describe, it, expect, beforeEach, vi } from 'vitest'

const STORAGE_KEY = 'sgpc-theme'

// El tema se lee UNA vez al cargar el módulo (estado a nivel de módulo, no por
// instancia), así que cada caso que necesita partir de una condición distinta
// resetea los módulos y vuelve a importar con ese localStorage/matchMedia ya
// preparado.
async function importarConTema({ guardado, prefiereOscuro = false } = {}) {
  vi.resetModules()
  localStorage.clear()
  if (guardado) localStorage.setItem(STORAGE_KEY, guardado)
  window.matchMedia = vi.fn().mockReturnValue({ matches: prefiereOscuro })
  document.documentElement.removeAttribute('data-bs-theme')
  return import('./useTheme')
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-bs-theme')
  })

  it('usa el tema guardado en localStorage si existe', async () => {
    const { useTheme } = await importarConTema({ guardado: 'dark', prefiereOscuro: false })
    const { esOscuro } = useTheme()
    expect(esOscuro.value).toBe(true)
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark')
  })

  it('sin preferencia guardada, cae a prefers-color-scheme', async () => {
    const { useTheme } = await importarConTema({ prefiereOscuro: true })
    const { esOscuro } = useTheme()
    expect(esOscuro.value).toBe(true)
  })

  it('sin preferencia guardada ni del SO, arranca en claro', async () => {
    const { useTheme } = await importarConTema({ prefiereOscuro: false })
    const { esOscuro } = useTheme()
    expect(esOscuro.value).toBe(false)
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light')
  })

  it('alternarTema cambia el valor, lo persiste y actualiza el atributo', async () => {
    const { useTheme } = await importarConTema({ guardado: 'light' })
    const { esOscuro, alternarTema } = useTheme()

    alternarTema()
    expect(esOscuro.value).toBe(true)
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')

    alternarTema()
    expect(esOscuro.value).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
  })

  it('dos consumidores comparten el mismo estado (módulo, no por instancia)', async () => {
    const { useTheme } = await importarConTema({ guardado: 'light' })
    const a = useTheme()
    const b = useTheme()

    a.alternarTema()
    expect(b.esOscuro.value).toBe(true)
  })
})
