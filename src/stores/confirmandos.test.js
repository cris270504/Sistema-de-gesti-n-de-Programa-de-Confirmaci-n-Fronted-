import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../services/confirmandos', () => ({
  createConfirmando: vi.fn(),
  deleteConfirmandoById: vi.fn(),
  getConfirmandoById: vi.fn(),
  getConfirmandosList: vi.fn(),
  getConfirmandosPaginado: vi.fn(),
  updateConfirmando: vi.fn(),
  importarConfirmandosExcel: vi.fn(),
  retirarConfirmandoById: vi.fn(),
  reingresarConfirmandoById: vi.fn(),
  contarAsistenciasConfirmando: vi.fn().mockResolvedValue(0),
  obtenerPerfilConfirmando: vi.fn(),
}))
vi.mock('@/funciones', () => ({
  confirmarEliminacion: vi.fn().mockResolvedValue(true),
  confirmar: vi.fn().mockResolvedValue(true),
  pedirTexto: vi.fn().mockResolvedValue('motivo'),
  showAlerta: vi.fn(),
  showErroresDeValidacion: vi.fn(),
}))

import {
  getConfirmandosPaginado,
  createConfirmando,
  deleteConfirmandoById,
} from '../services/confirmandos'
import { useConfirmandosStore } from './confirmandos'

describe('stores/confirmandos — fetchPaginado', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    getConfirmandosPaginado.mockResolvedValue({ items: [{ id: 1 }, { id: 2 }], total: 40 })
  })

  it('trae items + total y no toca `items` (lista completa)', async () => {
    const store = useConfirmandosStore()
    await store.fetchPaginado()
    expect(store.pagina.items).toEqual([{ id: 1 }, { id: 2 }])
    expect(store.pagina.total).toBe(40)
    expect(store.items).toEqual([])
  })

  it('deduplica peticiones en vuelo', async () => {
    const store = useConfirmandosStore()
    const p1 = store.fetchPaginado()
    const p2 = store.fetchPaginado()
    await Promise.all([p1, p2])
    expect(getConfirmandosPaginado).toHaveBeenCalledTimes(1)
  })

  it('no repite la llamada si página+filtros no cambiaron dentro de la ventana fresca', async () => {
    const store = useConfirmandosStore()
    await store.fetchPaginado()
    await store.fetchPaginado()
    expect(getConfirmandosPaginado).toHaveBeenCalledTimes(1)
  })

  it('cambiar de página vuelve a pedir al backend', async () => {
    const store = useConfirmandosStore()
    await store.fetchPaginado()
    await store.fetchPaginado({ page: 2 })
    expect(getConfirmandosPaginado).toHaveBeenCalledTimes(2)
    expect(getConfirmandosPaginado).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    expect(store.pagination.page).toBe(2)
  })

  it('cambiar filtros vuelve a página 1 y pide al backend', async () => {
    const store = useConfirmandosStore()
    await store.fetchPaginado({ page: 2 })
    await store.fetchPaginado({ filters: { search: 'ana', estado: 'todos', grupo: 'todos', procedencia: 'todos' } })
    expect(store.pagination.page).toBe(1)
    expect(getConfirmandosPaginado).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, filters: expect.objectContaining({ search: 'ana' }) }),
    )
  })
})

describe('stores/confirmandos — mutaciones refrescan `pagina` solo si está activa', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    getConfirmandosPaginado.mockResolvedValue({ items: [], total: 0 })
  })

  it('add NO llama a fetchPaginado si nadie pidió la vista paginada todavía', async () => {
    createConfirmando.mockResolvedValue({ confirmando: { id: 5, nombres: 'A', apellidos: 'B' } })
    const store = useConfirmandosStore()
    await store.add({ nombres: 'A' })
    expect(getConfirmandosPaginado).not.toHaveBeenCalled()
  })

  it('add SÍ llama a fetchPaginado({force:true}) si la vista paginada ya está activa', async () => {
    createConfirmando.mockResolvedValue({ confirmando: { id: 5, nombres: 'A', apellidos: 'B' } })
    const store = useConfirmandosStore()
    getConfirmandosPaginado.mockResolvedValueOnce({ items: [{ id: 1 }], total: 1 })
    await store.fetchPaginado() // activa la vista paginada
    getConfirmandosPaginado.mockClear()
    getConfirmandosPaginado.mockResolvedValue({ items: [{ id: 1 }, { id: 5 }], total: 2 })

    await store.add({ nombres: 'A' })

    expect(getConfirmandosPaginado).toHaveBeenCalledTimes(1)
  })

  it('remove SÍ llama a fetchPaginado({force:true}) si la vista paginada ya está activa', async () => {
    const store = useConfirmandosStore()
    getConfirmandosPaginado.mockResolvedValueOnce({ items: [{ id: 1 }], total: 1 })
    await store.fetchPaginado()
    getConfirmandosPaginado.mockClear()
    getConfirmandosPaginado.mockResolvedValue({ items: [], total: 0 })
    deleteConfirmandoById.mockResolvedValue({})

    await store.remove(1, 'Juan')

    expect(getConfirmandosPaginado).toHaveBeenCalledTimes(1)
  })
})
