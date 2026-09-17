import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/stores/confirmandos', () => ({
  useConfirmandosStore: vi.fn(),
}))
vi.mock('@/stores/grupos', () => ({
  useGruposStore: vi.fn(),
}))
vi.mock('@/stores/parroquia', () => ({
  useParroquiaStore: vi.fn(),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}))

import { useConfirmandosStore } from '@/stores/confirmandos'
import { useGruposStore } from '@/stores/grupos'
import { useParroquiaStore } from '@/stores/parroquia'
import { useAuthStore } from '@/stores/auth'
import { useConfirmandosFilters } from './useConfirmandosFilters'

function mockStores() {
  const fetchPaginado = vi.fn()
  useConfirmandosStore.mockReturnValue({
    fetchPaginado,
    pagina: { total: 40 },
    pagination: { page: 1, pageSize: 25 },
  })
  useGruposStore.mockReturnValue({ items: [{ id: 1, nombre: 'A', procedencia: 'colegio' }] })
  useParroquiaStore.mockReturnValue({ confirmandosEstadoDefault: 'todos' })
  useAuthStore.mockReturnValue({ can: () => true, user: { grupos: [] } })
  return { fetchPaginado }
}

describe('useConfirmandosFilters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('escribir en el buscador espera el debounce antes de pedir al backend', async () => {
    const { fetchPaginado } = mockStores()
    const { filtros } = useConfirmandosFilters()

    filtros.value.search = 'jose'
    await nextTick() // deja correr el watcher (flush "pre" de Vue)
    expect(fetchPaginado).not.toHaveBeenCalled()

    vi.advanceTimersByTime(299)
    expect(fetchPaginado).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(fetchPaginado).toHaveBeenCalledWith({ page: 1, filters: expect.objectContaining({ search: 'jose' }) })
  })

  it('cambiar un select (estado) dispara la consulta al instante, sin debounce', async () => {
    const { fetchPaginado } = mockStores()
    const { filtros } = useConfirmandosFilters()

    filtros.value.estado = 'confirmado'
    await nextTick() // deja correr el watcher (flush "pre" de Vue)
    expect(fetchPaginado).toHaveBeenCalledWith({ page: 1, filters: expect.objectContaining({ estado: 'confirmado' }) })
  })

  it('limpiarFiltros vuelve todo a los valores por defecto', () => {
    mockStores()
    const { filtros, limpiarFiltros } = useConfirmandosFilters()
    filtros.value.search = 'algo'
    limpiarFiltros()
    expect(filtros.value).toEqual({ search: '', estado: 'todos', grupo: 'todos', procedencia: 'todos' })
  })

  it('cambiarPagina no llama al backend si la página pedida está fuera de rango', () => {
    const { fetchPaginado } = mockStores()
    const { cambiarPagina } = useConfirmandosFilters()
    fetchPaginado.mockClear()
    cambiarPagina(0)
    cambiarPagina(999)
    expect(fetchPaginado).not.toHaveBeenCalled()
  })
})
