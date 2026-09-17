import { defineStore } from 'pinia'
import { confirmarEliminacion, showAlerta } from '@/funciones'
import { useGruposStore } from './grupos';
import { createSacramento, deleteSacramentoById, getSacramentoById, getSacramentosList, updateSacramento } from '../services/sacramentos';
import { crudState, crudActions } from './crudStoreFactory'

export const useSacramentosStore = defineStore('sacramentos', {
    state: () => ({
        ...crudState(),
    }),

    getters: {
        byId: (state) => (id) => state.items.find(u => u.id === Number(id)),
        count: (state) => state.items.length,
    },

    actions: {
        ...crudActions({
            list: getSacramentosList,
            create: createSacramento,
            update: updateSacramento,
            remove: deleteSacramentoById,
            entityLabel: 'sacramento',
            extract: (r) => r?.sacramento,
        }),

        // remove tiene lógica propia (resuelve el nombre vía byId si no se lo
        // pasan, para el diálogo de confirmación) que el factory no replica.

        async fetchById(id) {
            const existingSacramento = this.byId(id);
            if (existingSacramento) return existingSacramento;

            this.loading = true
            this.error = null
            try {
                const sacramentoId = Number(id);
                const sacramento = await getSacramentoById(sacramentoId)
                const idx = this.items.findIndex(s => s.id === sacramentoId)

                if (idx === -1) {
                    this.items.unshift(sacramento)
                } else {
                    this.items[idx] = sacramento
                }
                return sacramento;
            } catch (e) {
                this.error = e?.message || `Error al obtener sacramento ${id}`
                showAlerta(this.error, 'error');
                throw e;
            } finally {
                this.loading = false
            }
        },

        async remove(id, nombre) {
            const sacramentoId = Number(id);
            let nombreParaConfirmar = nombre;
            if (!nombreParaConfirmar) {
                const sacramentoLocal = this.byId(sacramentoId);
                if (sacramentoLocal) {
                    nombreParaConfirmar = sacramentoLocal.nombre;
                }
            }
            const ok = await confirmarEliminacion(nombreParaConfirmar || `el sacramento`);
            if (!ok) {
                showAlerta('Operación cancelada', 'info')
                return false
            }

            try {
                await deleteSacramentoById(sacramentoId)

                this.items = this.items.filter(u => u.id !== sacramentoId)

                showAlerta('Sacramento eliminado correctamente', 'success')
                return true
            } catch (e) {
                this.error = e?.message || 'No se pudo eliminar el sacramento'
                showAlerta(this.error, 'error')
                return false
            }
        },
    },
})