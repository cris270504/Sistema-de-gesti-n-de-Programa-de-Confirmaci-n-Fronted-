import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia, defineStore } from 'pinia'
import { crudState, crudActions, paginatedCrudState, paginatedCrudActions } from './crudStoreFactory'

vi.mock('@/funciones', () => ({
  confirmarEliminacion: vi.fn().mockResolvedValue(true),
  showAlerta: vi.fn(),
  showErroresDeValidacion: vi.fn(),
}))

import { confirmarEliminacion, showAlerta, showErroresDeValidacion } from '@/funciones'

function buildSimpleStore(overrides = {}) {
  const service = {
    list: vi.fn().mockResolvedValue([{ id: 1, nombre: 'A' }]),
    create: vi.fn().mockResolvedValue({ item: { id: 2, nombre: 'B' } }),
    update: vi.fn().mockResolvedValue({ item: { id: 1, nombre: 'A2' } }),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  const useStore = defineStore('_test_simple', {
    state: () => ({ ...crudState() }),
    actions: {
      ...crudActions({
        list: service.list,
        create: service.create,
        update: service.update,
        remove: service.remove,
        entityLabel: 'ítem',
        extract: (r) => r?.item,
      }),
    },
  })
  return { useStore, service }
}

describe('crudStoreFactory — crudActions (no paginado)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchAll trae la lista y marca lastFetch', async () => {
    const { useStore } = buildSimpleStore()
    const store = useStore()
    await store.fetchAll()
    expect(store.items).toEqual([{ id: 1, nombre: 'A' }])
    expect(store.lastFetch).toBeGreaterThan(0)
    expect(store.loading).toBe(false)
  })

  it('fetchAll deduplica peticiones en vuelo (_inflight)', async () => {
    const { useStore, service } = buildSimpleStore()
    const store = useStore()
    const p1 = store.fetchAll()
    const p2 = store.fetchAll()
    await Promise.all([p1, p2])
    expect(service.list).toHaveBeenCalledTimes(1)
  })

  it('fetchAll no repite la llamada si los datos son recientes (stale-while-revalidate)', async () => {
    const { useStore, service } = buildSimpleStore()
    const store = useStore()
    await store.fetchAll()
    await store.fetchAll()
    expect(service.list).toHaveBeenCalledTimes(1)
  })

  it('fetchAll con force=true repite la llamada aunque los datos sean recientes', async () => {
    const { useStore, service } = buildSimpleStore()
    const store = useStore()
    await store.fetchAll()
    await store.fetchAll({ force: true })
    expect(service.list).toHaveBeenCalledTimes(2)
  })

  it('add extrae la entidad creada con extract() y la agrega al principio', async () => {
    const { useStore } = buildSimpleStore()
    const store = useStore()
    const created = await store.add({ nombre: 'B' })
    expect(created).toEqual({ id: 2, nombre: 'B' })
    expect(store.items[0]).toEqual({ id: 2, nombre: 'B' })
    expect(showAlerta).toHaveBeenCalledWith(expect.stringContaining('creado'), 'success')
  })

  it('add muestra errores de validación y relanza si el service falla', async () => {
    const { useStore } = buildSimpleStore({
      create: vi.fn().mockRejectedValue(new Error('boom')),
    })
    const store = useStore()
    await expect(store.add({})).rejects.toThrow('boom')
    expect(showErroresDeValidacion).toHaveBeenCalled()
  })

  it('save actualiza el item existente por id', async () => {
    const { useStore } = buildSimpleStore()
    const store = useStore()
    await store.fetchAll()
    await store.save(1, { nombre: 'A2' })
    expect(store.items[0]).toEqual({ id: 1, nombre: 'A2' })
    expect(showAlerta).toHaveBeenCalledWith(expect.stringContaining('actualizado'), 'success')
  })

  it('remove pide confirmación y, si se acepta, elimina el item', async () => {
    const { useStore } = buildSimpleStore()
    const store = useStore()
    await store.fetchAll()
    const ok = await store.remove(1, 'A')
    expect(confirmarEliminacion).toHaveBeenCalledWith('A')
    expect(ok).toBe(true)
    expect(store.items).toEqual([])
  })

  it('remove no elimina nada si el usuario cancela la confirmación', async () => {
    confirmarEliminacion.mockResolvedValueOnce(false)
    const { useStore, service } = buildSimpleStore()
    const store = useStore()
    await store.fetchAll()
    const ok = await store.remove(1, 'A')
    expect(ok).toBe(false)
    expect(service.remove).not.toHaveBeenCalled()
    expect(store.items).toEqual([{ id: 1, nombre: 'A' }])
  })
})

describe('crudStoreFactory — paginatedCrudActions (paginado server-side)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  function buildPaginatedStore(listImpl) {
    const list = listImpl || vi.fn().mockResolvedValue({ items: [{ id: 1 }, { id: 2 }], total: 40 })
    const useStore = defineStore('_test_paginated', {
      state: () => ({ ...paginatedCrudState({ pageSize: 25 }) }),
      actions: {
        ...paginatedCrudActions({ list, entityLabel: 'ítem' }),
      },
    })
    return { useStore, list }
  }

  it('fetchAll paginado trae items + total y los guarda en pagination', async () => {
    const { useStore, list } = buildPaginatedStore()
    const store = useStore()
    await store.fetchAll()
    expect(store.items).toEqual([{ id: 1 }, { id: 2 }])
    expect(store.pagination.total).toBe(40)
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 25, filters: {} }))
  })

  it('cambiar de página vuelve a pedir al backend aunque los datos sean recientes', async () => {
    const { useStore, list } = buildPaginatedStore()
    const store = useStore()
    await store.fetchAll()
    await store.fetchAll({ page: 2 })
    expect(list).toHaveBeenCalledTimes(2)
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    expect(store.pagination.page).toBe(2)
  })

  it('cambiar filtros vuelve a la página 1 y vuelve a pedir al backend', async () => {
    const { useStore, list } = buildPaginatedStore()
    const store = useStore()
    await store.fetchAll({ page: 2 })
    await store.fetchAll({ filters: { estado: 'activo' } })
    expect(store.pagination.page).toBe(1)
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, filters: { estado: 'activo' } }))
  })

  it('repetir la misma página y filtros dentro de la ventana fresca no repite la llamada', async () => {
    const { useStore, list } = buildPaginatedStore()
    const store = useStore()
    await store.fetchAll()
    await store.fetchAll()
    expect(list).toHaveBeenCalledTimes(1)
  })
})
