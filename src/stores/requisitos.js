import { defineStore } from 'pinia'
import { confirmarEliminacion, showAlerta, showErroresDeValidacion } from '@/funciones'
import { createRequisito, deleteRequisitoById, getRequisitoById, getRequisitoList, updateRequisito } from '../services/requisitos';

export const useRequisitosStore = defineStore('requisitos', {
  state: () => ({
    items: [],
    loading: false,
    error: null,
  }),

  getters: {
    byId: (state) => (id) => state.items.find(u => u.id === Number(id)),
    count: (state) => state.items.length,
  },

  actions: {
    async fetchAll() {
      this.loading = true;
      this.error = null;
      try {
        this.items = await getRequisitoList();
      } catch (e) {
        this.error = e?.message || 'Error al listar requisitos';
      } finally {
        this.loading = false;
      }
    },

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
        this.error = e?.response?.data?.message || e?.message || `Error al obtener requisito ${id}`
        showAlerta(this.error, 'error');
        throw e;
      } finally {
        this.loading = false
      }
    },

    async add(Payload) {
      try {
        const response = await createRequisito(Payload);
        const created = response?.requisito;
        if (!created) {
          throw new Error('La API no devolvió un requisito válido.');
        }

        this.items.unshift(created)

        showAlerta(
          `Requisito creado correctamente.`,
          'success'
        );
        return created
      } catch (e) {
        showErroresDeValidacion(e?.response?.data?.errors || e)
        throw e
      }
    },

    async save(id, requisito) {
      try {
        const response = await updateRequisito(id, requisito);
        const updated = response?.requisito;

        if (!updated) {
          throw new Error('La API no devolvió un requisito actualizado.');
        }

        const idx = this.items.findIndex(u => u.id === id)
        if (idx !== -1) this.items[idx] = updated

        showAlerta('Requisito actualizado correctamente', 'success')
        return updated
      } catch (e) {
        showErroresDeValidacion(e?.response?.data?.errors || e)
        if (!e?.response?.data?.errors) {
          showAlerta(e?.response?.data?.message || e?.message || 'Error al actualizar requisito', 'error');
        }
        throw e
      }
    },

    async remove(id, nombre) {
      const Id = Number(id);

      const ok = await confirmarEliminacion(nombre || `requisito con ID ${Id}`)
      if (!ok) {
        showAlerta('Operación cancelada', 'info')
        return false
      }

      try {
        await deleteRequisitoById(Id)

        this.items = this.items.filter(u => u.id !== Id)

        showAlerta('Requisito eliminado correctamente', 'success')
        return true
      } catch (e) {
        this.error = e?.response?.data?.message || e?.message || 'No se pudo eliminar el requisito'
        showAlerta(this.error, 'error')
        return false
      }
    },
  },
})