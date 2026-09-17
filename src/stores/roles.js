import { defineStore } from 'pinia'
import { showAlerta, showErroresDeValidacion } from '@/funciones'
import { createRoles, deleteRoles, getRoles, getRolesList, updateRoles } from '@/services/roles'
import { crudState, crudActions } from './crudStoreFactory'

export const useRolesStore = defineStore('roles', {
  state: () => ({
    ...crudState(),
  }),

  getters: {
    byId: (state) => (id) => state.items.find(r => r.id === Number(id)),
    count: (state) => state.items.length,
  },

  actions: {
    ...crudActions({
      list: getRolesList,
      create: createRoles,
      update: updateRoles,
      remove: deleteRoles,
      entityLabel: 'rol',
      extract: (r) => r?.role || r,
    }),

    // fetchAll (sin caché, pasa `params` a getRolesList) y add (upsert por id
    // en vez de unshift siempre) tienen lógica propia distinta del patrón
    // genérico del factory: se conservan tal cual, sobreescribiendo el spread.
    async fetchAll(params = {}) {
      this.loading = true
      this.error = null
      try {
        this.items = await getRolesList(params)
      } catch (e) {
        this.error = e?.message || 'Error al listar roles'
        showAlerta(this.error, 'error')
      } finally {
        this.loading = false
      }
    },

    async fetchOne(id, params = {}) {
      this.loading = true
      this.error = null
      try {
        const role = await getRoles(id, params)
        const idx = this.items.findIndex(r => r.id === Number(id))
        if (idx === -1) this.items.unshift(role)
        else this.items[idx] = role
        return role
      } catch (e) {
        this.error = e?.message || 'Error al obtener el rol'
        showAlerta(this.error, 'error')
        throw e
      } finally {
        this.loading = false
      }
    },

    async add(payload) {
      try {
        const response = await createRoles(payload)
        const created = response?.role || response
        if (!created?.id) {
          throw new Error('La API no devolvió un rol válido.')
        }
        const idx = this.items.findIndex(r => r.id === created.id)
        if (idx !== -1) this.items[idx] = created
        else this.items.unshift(created)
        showAlerta('Rol creado correctamente', 'success')
        return created
      } catch (e) {
        showErroresDeValidacion(e)
        throw e
      }
    },

  },
})
