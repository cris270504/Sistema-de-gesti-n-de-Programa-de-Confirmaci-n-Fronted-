// Smoke test de los 6 stores migrados al factory CRUD (roles, requisitos,
// users, sacramentos, grupos, reunions): instancia cada uno y ejerce
// fetchAll/add/save/remove con los services mockeados. Ninguno tenía test
// propio antes de esta migración; cubre justamente lo que el lint no puede
// (ej. una variable que quedó sin declarar al mover código entre el store y
// el factory — pasó una vez en grupos.js con FRESH_MS).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/funciones', () => ({
  confirmar: vi.fn().mockResolvedValue(true),
  confirmarEliminacion: vi.fn().mockResolvedValue(true),
  showAlerta: vi.fn(),
  showErroresDeValidacion: vi.fn(),
}))

vi.mock('@/services/roles', () => ({
  getRolesList: vi.fn().mockResolvedValue([{ id: 1, nombre: 'Admin' }]),
  getRoles: vi.fn(),
  createRoles: vi.fn().mockResolvedValue({ role: { id: 2, nombre: 'Nuevo' } }),
  updateRoles: vi.fn().mockResolvedValue({ role: { id: 1, nombre: 'Editado' } }),
  deleteRoles: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../services/requisitos', () => ({
  getRequisitoList: vi.fn().mockResolvedValue([{ id: 1, nombre: 'DNI' }]),
  getRequisitoById: vi.fn(),
  createRequisito: vi.fn().mockResolvedValue({ requisito: { id: 2, nombre: 'Nuevo' } }),
  updateRequisito: vi.fn().mockResolvedValue({ requisito: { id: 1, nombre: 'Editado' } }),
  deleteRequisitoById: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/services/users', () => ({
  getUsersList: vi.fn().mockResolvedValue([{ id: 1, name: 'Ana' }]),
  getUserById: vi.fn(),
  createUser: vi.fn().mockResolvedValue({ user: { id: 2, name: 'Nuevo' }, temp_password: 'x' }),
  updateUser: vi.fn().mockResolvedValue({ user: { id: 1, name: 'Editado' } }),
  deleteUserById: vi.fn().mockResolvedValue(undefined),
  setUserEstado: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../services/sacramentos', () => ({
  getSacramentosList: vi.fn().mockResolvedValue([{ id: 1, nombre: 'Bautismo' }]),
  getSacramentoById: vi.fn(),
  createSacramento: vi.fn().mockResolvedValue({ sacramento: { id: 2, nombre: 'Nuevo' } }),
  updateSacramento: vi.fn().mockResolvedValue({ sacramento: { id: 1, nombre: 'Editado' } }),
  deleteSacramentoById: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../services/grupos', () => ({
  getGruposList: vi.fn().mockResolvedValue([{ id: 1, nombre: 'Grupo A' }]),
  getGrupoById: vi.fn(),
  createGrupo: vi.fn().mockResolvedValue({ grupo: { id: 2, nombre: 'Nuevo' } }),
  updateGrupo: vi.fn().mockResolvedValue({ grupo: { id: 1, nombre: 'Editado' } }),
  deleteGrupoById: vi.fn().mockResolvedValue(undefined),
  syncCatequists: vi.fn(),
  syncConfirmandos: vi.fn(),
  getApoderadosByGrupo: vi.fn(),
  generarGruposEquitativos: vi.fn(),
}))
// reunions.js importa del mismo archivo con dos alias distintos
// (@/services/reunions y ../services/reunions) — hay que mockear ambos con
// el set completo de exports (vi.mock se hoistea, no puede referenciar una
// const externa: se repite el literal en los dos mocks).
vi.mock('../services/reunions', () => ({
  getReunionsList: vi.fn().mockResolvedValue([{ id: 1, tema: 'Reunión A' }]),
  getReunionById: vi.fn(),
  createReunion: vi.fn().mockResolvedValue({ reunion: { id: 2, tema: 'Nueva' } }),
  updateReunion: vi.fn().mockResolvedValue({ reunion: { id: 1, tema: 'Editada' } }),
  deleteReunionById: vi.fn().mockResolvedValue(undefined),
  contarAsistenciasReunion: vi.fn().mockResolvedValue(0),
  getUpcomingReuniones: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/services/reunions', () => ({
  getReunionsList: vi.fn().mockResolvedValue([{ id: 1, tema: 'Reunión A' }]),
  getReunionById: vi.fn(),
  createReunion: vi.fn().mockResolvedValue({ reunion: { id: 2, tema: 'Nueva' } }),
  updateReunion: vi.fn().mockResolvedValue({ reunion: { id: 1, tema: 'Editada' } }),
  deleteReunionById: vi.fn().mockResolvedValue(undefined),
  contarAsistenciasReunion: vi.fn().mockResolvedValue(0),
  getUpcomingReuniones: vi.fn().mockResolvedValue([]),
}))

import { useRolesStore } from './roles'
import { useRequisitosStore } from './requisitos'
import { useUsersStore } from './users'
import { useSacramentosStore } from './sacramentos'
import { useGruposStore } from './grupos'
import { useReunionesStore } from './reunions'

describe('smoke: stores migrados al factory no revientan en runtime', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('roles: fetchAll, add, save, remove', async () => {
    const store = useRolesStore()
    await store.fetchAll()
    expect(store.items).toHaveLength(1)
    await store.add({ nombre: 'Nuevo' })
    await store.save(1, { nombre: 'Editado' })
    const ok = await store.remove(1, 'Admin')
    expect(ok).toBe(true)
  })

  it('requisitos: fetchAll, add, save, remove', async () => {
    const store = useRequisitosStore()
    await store.fetchAll()
    expect(store.items).toHaveLength(1)
    await store.add({ nombre: 'Nuevo' })
    await store.save(1, { nombre: 'Editado' })
    const ok = await store.remove(1, 'DNI')
    expect(ok).toBe(true)
  })

  it('users: fetchAll (factory) + add/save/remove (custom)', async () => {
    const store = useUsersStore()
    await store.fetchAll()
    expect(store.items).toHaveLength(1)
    await store.add({ name: 'Nuevo' })
    await store.save(1, { name: 'Editado' })
    const ok = await store.remove(1, 'Ana')
    expect(ok).toBe(true)
  })

  it('sacramentos: fetchAll/add/save (factory) + remove (custom)', async () => {
    const store = useSacramentosStore()
    await store.fetchAll()
    expect(store.items).toHaveLength(1)
    await store.add({ nombre: 'Nuevo' })
    await store.save(1, { nombre: 'Editado' })
    const ok = await store.remove(1, 'Bautismo')
    expect(ok).toBe(true)
  })

  it('grupos: fetchAll/add/remove (custom) + save (factory) — aquí vivía el bug de FRESH_MS', async () => {
    const store = useGruposStore()
    await store.fetchAll()
    expect(store.items).toHaveLength(1)
    // Segunda llamada dentro de la ventana fresca: no debe explotar por
    // FRESH_MS indefinida (esto es justo lo que el lint/tests no detectaban).
    await store.fetchAll()
    await store.add({ nombre: 'Nuevo' })
    await store.save(1, { nombre: 'Editado' })
    const ok = await store.remove(1, 'Grupo A')
    expect(ok).toBe(true)
  })

  it('reunions: fetchAll/add/save/remove siguen 100% custom (sin factory actions)', async () => {
    const store = useReunionesStore()
    await store.fetchAll()
    expect(store.items).toHaveLength(1)
    await store.fetchAll() // segunda llamada en ventana fresca
    await store.add({ tema: 'Nueva' })
    await store.save(1, { tema: 'Editada' })
    const ok = await store.remove(1, 'Reunión A')
    expect(ok).toBe(true)
  })
})
