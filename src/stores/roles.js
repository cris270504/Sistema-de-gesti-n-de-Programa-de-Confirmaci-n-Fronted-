import { defineStore } from 'pinia'
import { confirmarEliminacion, showAlerta, showErroresDeValidacion } from '@/funciones'
import { createRoles, deleteRoles, getRoles, getRolesList, updateRoles } from '@/services/roles'

export const useRolesStore = defineStore('roles', {
  state: () => ({
    items: [],
    loading: false,
    error: null,
  }),

  getters: {
    byId: (state) => (id) => state.items.find(r => r.id === id),
    count: (state) => state.items.length,
  },

  actions: {
    async fetchAll(params = {}) {
      this.loading = true
      this.error = null
      try {
        this.items = await getRolesList(params)
      } catch (e) {
        this.error = e?.message || 'Error al listar roles'
      } finally {
        this.loading = false
      }
    },

    async fetchOne(id, params = {}) {
      this.loading = true
      this.error = null
      try {
        const roles = await getRoles(id, params)
        const idx = this.items.findIndex(r => r.id === id)
        if (idx === -1) this.items.unshift(roles)
        else this.items[idx] = roles
      } catch (e) {
        this.error = e?.message || 'Error al obtener autor'
      } finally {
        this.loading = false
      }
    },

    async add(roles) {
      try {
        const created = await createRoles(roles)
        const idx = this.items.findIndex(r => r.id === created.id)
        if (idx !== -1) this.items[idx] = created
        else this.items.unshift(created)
        showAlerta('Creado correctamente', 'success')
        return created
      } catch (e) {
        const errors = e?.response?.data?.errors
        showErroresDeValidacion(errors)
        throw e
      }
    },

    async sge(id, roles) {
      try {
        const updated = await updateRoles(id, roles)
        const idx = this.items.findIndex(r => r.id === id)
        if (idx !== -1) this.items[idx] = updated
        showAlerta('Actualizado correctamente', 'success')
        return updated
      } catch (e) {
        const errors = e?.response?.data?.errors
        showErroresDeValidacion(errors)
        throw e
      }
    },

    /**
         * Confirma y, si aceptan, elimina el post desde el store
         * @param {number|string} id
         * @param {string} nombre
         */
    async remove(id, nombre) {
      const ok = await confirmarEliminacion(nombre)
      if (!ok) {
        showAlerta('Operación cancelada', 'info')
        return false
      }

      try {
        await deleteRoles(id)
        this.items = this.items.filter(p => p.id !== id)
        showAlerta('Eliminado correctamente', 'success')
        return true
      } catch (e) {
        showAlerta(e?.message || 'No se pudo eliminar', 'error')
        return false
      }
    },
  },
})