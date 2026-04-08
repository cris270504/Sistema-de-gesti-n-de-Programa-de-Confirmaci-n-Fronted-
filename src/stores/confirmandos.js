import { defineStore } from 'pinia'
import { createConfirmando, deleteConfirmandoById, getConfirmandoById, getConfirmandosList, updateConfirmando } from '../services/confirmandos';
import { confirmarEliminacion, showAlerta, showErroresDeValidacion } from '@/funciones'

export const useConfirmandosStore = defineStore('confirmandos', {
    state: () => ({
        items: [],
        loading: false,
        error: null,
    }),

    getters: {
        byId: (state) => (id) => state.items.find(c => c.id === Number(id)),
        count: (state) => state.items.length,
    },

    actions: {
        async fetchAll() {
            this.loading = true;
            this.error = null;
            try {
                this.items = await getConfirmandosList();
            } catch (e) {
                this.error = e?.message || 'Error al listar Confirmandos';
            } finally {
                this.loading = false;
            }
        },
        async fetchById(id) {
            const existingConfirmando = this.byId(id);
            if (existingConfirmando) return existingConfirmando;

            this.loading = true
            this.error = null
            try {
                const confirmandoId = Number(id);
                const confirmando = await getConfirmandoById(confirmandoId)
                const idx = this.items.findIndex(c => c.id === confirmandoId)

                if (idx === -1) {
                    this.items.unshift(confirmando)
                } else {
                    this.items[idx] = confirmando
                }
                return confirmando;
            } catch (e) {
                this.error = e?.response?.data?.message || e?.message || `Error al obtener confirmando ${id}`
                showAlerta(this.error, 'error');
                throw e;
            } finally {
                this.loading = false
            }
        },

        async add(confirmandoPayload) {
            try {
                const response = await createConfirmando(confirmandoPayload);
                const created = response?.confirmando;
                if (!created) {
                    throw new Error('La API no devolvió un confirmando válido.');
                }

                this.items.unshift(created)

                const nombres = created?.nombres
                const apellidos = created?.apellidos

                showAlerta(
                    `Confirmando ${nombres} ${apellidos} creado correctamente.`,
                    'success'
                );
                return created
            } catch (e) {
                showErroresDeValidacion(e?.response?.data?.errors || e)
                throw e
            }
        },

        async save(id, confirmando) {
            try {
                const response = await updateConfirmando(id, confirmando)
                const updated = response?.confirmando;

                if (!updated) {
                    throw new Error('La API no devolvió un confirmando actualizado.');
                }

                const idx = this.items.findIndex(c => c.id === id);
                if (idx !== -1) {
                    this.items[idx] = {
                        ...this.items[idx],
                        ...updated
                    };
                }

                showAlerta('Confirmando actualizado correctamente', 'success')
                return updated
            } catch (e) {
                showErroresDeValidacion(e?.response?.data?.errors || e)
                if (!e?.response?.data?.errors) {
                    showAlerta(e?.response?.data?.message || e?.message || 'Error al actualizar confirmando', 'error');
                }
                throw e
            }
        },

        async remove(id, nombre) {
            const confirmandoId = Number(id);

            const ok = await confirmarEliminacion(nombre || `Confirmando con ID ${confirmandoId}`)
            if (!ok) {
                showAlerta('Operación cancelada', 'info')
                return false
            }

            try {
                await deleteConfirmandoById(confirmandoId)

                this.items = this.items.filter(c => c.id !== confirmandoId)

                showAlerta('Confirmando eliminado correctamente', 'success')
                return true
            } catch (e) {
                this.error = e?.response?.data?.message || e?.message || 'No se pudo eliminar el confirmando'
                showAlerta(this.error, 'error')
                return false
            }
        },

    },
})