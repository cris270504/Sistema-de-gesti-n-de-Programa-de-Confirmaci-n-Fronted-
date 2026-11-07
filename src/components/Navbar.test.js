import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal()),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/composables/useTheme', async () => {
  const { ref } = await import('vue')
  return { useTheme: () => ({ esOscuro: ref(false), alternarTema: vi.fn() }) }
})

import Navbar from './Navbar.vue'

// Simula el ancho: `escritorio` = la consulta del cajón NO coincide.
function simularAncho({ escritorio }) {
  window.matchMedia = vi.fn((query) => ({
    matches: query.includes('not all and (min-width: 1024px)') ? !escritorio : escritorio,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

const montar = () => {
  setActivePinia(createPinia())
  return mount(Navbar, { global: { stubs: { RouterLink: true } } })
}

describe('Navbar — botón de menú', () => {
  afterEach(() => vi.restoreAllMocks())

  it('en escritorio (barra fija) no muestra el botón de tres líneas', () => {
    simularAncho({ escritorio: true })
    expect(montar().find('[aria-label="Abrir menú"]').exists()).toBe(false)
  })

  it('en celular/tablet (barra como cajón) muestra el botón y abre el cajón', async () => {
    simularAncho({ escritorio: false })
    const w = montar()
    const boton = w.find('[aria-label="Abrir menú"]')
    expect(boton.exists()).toBe(true)
    await boton.trigger('click')
    expect(w.emitted('toggle-drawer')).toHaveLength(1)
  })
})
