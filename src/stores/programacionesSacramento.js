import { defineStore } from 'pinia'
import {
  cancelarProgramacion,
  getProgramaciones,
  programarSacramento,
  registrarSacramentos,
} from '@/services/programacionesSacramento'
import { confirmar, showAlerta, showErroresDeValidacion } from '@/funciones'
import { crudState } from './crudStoreFactory'

const FRESH_MS = 30_000

// Solo crudState(): "celebración" es femenino y las acciones son de negocio
// (programar / cancelar / registrar), no un CRUD genérico. Ver reunions.js.
export const useProgramacionesSacramentoStore = defineStore('programacionesSacramento', {
  state: () => ({
    ...crudState(),
  }),
  getters: {
    byId: (state) => (id) => state.items.find((p) => p.id === Number(id)),
    activas: (state) => state.items.filter((p) => p.estado !== 'cancelada'),
  },
  actions: {
    async fetchAll({ force = false } = {}) {
      if (this._inflight) return this._inflight
      if (!force && this.items.length > 0 && Date.now() - this.lastFetch < FRESH_MS) return

      if (this.items.length === 0) this.loading = true
      this.error = null

      this._inflight = getProgramaciones()
        .then((data) => {
          this.items = data
          this.lastFetch = Date.now()
        })
        .catch((e) => {
          this.error = e?.message || 'Error al listar los sacramentos programados'
          showAlerta(this.error, 'error')
        })
        .finally(() => {
          this.loading = false
          this._inflight = null
        })

      return this._inflight
    },
    async programar(payload) {
      try {
        const id = await programarSacramento(payload)
        await this.fetchAll({ force: true })
        showAlerta(payload.id ? 'Celebración actualizada' : 'Sacramento programado', 'success')
        return id
      } catch (e) {
        showErroresDeValidacion(e)
        throw e
      }
    },
    async cancelar(id) {
      const ok = await confirmar({
        titulo: '¿Cancelar la celebración?',
        texto: 'Los jóvenes vuelven a quedar pendientes de este sacramento y se podrán programar en otra fecha.',
        confirmarTexto: 'Cancelar celebración',
        cancelarTexto: 'Volver',
      })
      if (!ok) return false
      try {
        await cancelarProgramacion(id)
        await this.fetchAll({ force: true })
        showAlerta('Celebración cancelada', 'success')
        return true
      } catch (e) {
        showAlerta(e?.message || 'No se pudo cancelar la celebración', 'error')
        return false
      }
    },
    async registrar(id, items) {
      try {
        await registrarSacramentos(id, items)
        await this.fetchAll({ force: true })
        showAlerta('Registro guardado', 'success')
        return true
      } catch (e) {
        showErroresDeValidacion(e)
        throw e
      }
    },
  },
})
