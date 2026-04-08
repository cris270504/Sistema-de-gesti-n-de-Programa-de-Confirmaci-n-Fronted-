import { defineStore } from 'pinia'
import { confirmarEliminacion, showAlerta, showErroresDeValidacion } from '@/funciones'
import { useGruposStore } from './grupos';
import { createSacramento, deleteSacramentoById, getSacramentoById, getSacramentosList, updateSacramento } from '../services/sacramentos';

export const useSacramentosStore = defineStore('sacramentos', {
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
                this.items = await getSacramentosList();
            } catch (e) {
                this.error = e?.message || 'Error al listar sacramentos';
            } finally {
                this.loading = false;
            }
        },

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
                this.error = e?.response?.data?.message || e?.message || `Error al obtener sacramento ${id}`
                showAlerta(this.error, 'error');
                throw e;
            } finally {
                this.loading = false
            }
        },

        async add(SacramentoPayload) {
            try {
                const response = await createSacramento(SacramentoPayload);
                const created = response?.sacramento;
                if (!created) {
                    throw new Error('La API no devolvió un sacramento válido.');
                }

                this.items.unshift(created)

                showAlerta(
                    `Sacramento creado correctamente.`,
                    'success'
                );
                return created
            } catch (e) {
                showErroresDeValidacion(e?.response?.data?.errors || e)
                throw e
            }
        },

        async save(id, sacramento) {
            try {
                const response = await updateSacramento(id, sacramento);
                const updated = response?.sacramento;

                if (!updated) {
                    throw new Error('La API no devolvió un sacramento actualizado.');
                }

                const idx = this.items.findIndex(u => u.id === id)
                if (idx !== -1) this.items[idx] = updated

                showAlerta('Sacramento actualizado correctamente', 'success')
                return updated
            } catch (e) {
                showErroresDeValidacion(e?.response?.data?.errors || e)
                if (!e?.response?.data?.errors) {
                    showAlerta(e?.response?.data?.message || e?.message || 'Error al actualizar sacramento', 'error');
                }
                throw e
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
                this.error = e?.response?.data?.message || e?.message || 'No se pudo eliminar el sacramento'
                showAlerta(this.error, 'error')
                return false
            }
        },
    },
})