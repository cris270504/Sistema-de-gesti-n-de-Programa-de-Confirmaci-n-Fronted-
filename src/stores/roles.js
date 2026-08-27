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
    byId: (state) => (id) => state.items.find(r => r.id === Number(id)),
    count: (state) => state.items.length,
  },

  actions: {
    async fetchAll(params = {}) {
      this.loading = true
      this.error = null
      try {
        this.items = await getRolesList(params)
      } catch (e) {
        this.error = e?.response?.data?.message || e?.message || 'Error al listar roles'
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
        this.error = e?.response?.data?.message || e?.message || 'Error al obtener el rol'
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
        showErroresDeValidacion(e?.response?.data?.errors || e)
        throw e
      }
    },

    async save(id, payload) {
      try {
        const response = await updateRoles(id, payload)
        const updated = response?.role || response
        if (!updated?.id) {
          throw new Error('La API no devolvió un rol actualizado.')
        }
        const idx = this.items.findIndex(r => r.id === Number(id))
        if (idx !== -1) this.items[idx] = updated
        showAlerta('Rol actualizado correctamente', 'success')
        return updated
      } catch (e) {
        showErroresDeValidacion(e?.response?.data?.errors || e)
        if (!e?.response?.data?.errors) {
          showAlerta(e?.response?.data?.message || e?.message || 'Error al actualizar el rol', 'error')
        }
        throw e
      }
    },

    /**
     * Confirma y, si aceptan, elimina el rol desde el store
     * @param {number|string} id
     * @param {string} nombre
     */
    async remove(id, nombre) {
      const ok = await confirmarEliminacion(nombre || `rol con ID ${id}`)
      if (!ok) {
        showAlerta('Operación cancelada', 'info')
        return false
      }

      try {
        await deleteRoles(id)
        this.items = this.items.filter(r => r.id !== Number(id))
        showAlerta('Rol eliminado correctamente', 'success')
        return true
      } catch (e) {
        this.error = e?.response?.data?.message || e?.message || 'No se pudo eliminar el rol'
        showAlerta(this.error, 'error')
        return false
      }
    },
  },
})
