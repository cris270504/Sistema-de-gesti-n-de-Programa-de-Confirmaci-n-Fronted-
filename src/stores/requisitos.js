import { defineStore } from 'pinia'
import { showAlerta } from '@/funciones'
import { createRequisito, deleteRequisitoById, getRequisitoById, getRequisitoList, updateRequisito } from '../services/requisitos';
import { crudState, crudActions } from './crudStoreFactory'

export const useRequisitosStore = defineStore('requisitos', {
  state: () => ({
    ...crudState(),
  }),

  getters: {
    byId: (state) => (id) => state.items.find(u => u.id === Number(id)),
    count: (state) => state.items.length,
  },

  actions: {
    ...crudActions({
      list: getRequisitoList,
      create: createRequisito,
      update: updateRequisito,
      remove: deleteRequisitoById,
      entityLabel: 'requisito',
      extract: (r) => r?.requisito,
    }),

    async fetchById(id) {
      const existing = this.byId(id);
      if (existing) return existing;

      this.loading = true
      this.error = null
      try {
        const Id = Number(id);
        const requisito = await getRequisitoById(Id)
        const idx = this.items.findIndex(s => s.id === Id)

        if (idx === -1) {
          this.items.unshift(requisito)
        } else {
          this.items[idx] = requisito
        }
        return requisito;
      } catch (e) {
        this.error = e?.message || `Error al obtener requisito ${id}`
        showAlerta(this.error, 'error');
        throw e;
      } finally {
        this.loading = false
      }
    },
  },
})