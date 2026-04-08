import { defineStore } from 'pinia'
import { getUpcomingReuniones } from '@/services/reunions'
import { createReunion, deleteReunionById, getReunionById, getReunionsList, updateReunion } from '../services/reunions';
import { confirmarEliminacion, showAlerta, showErroresDeValidacion } from '@/funciones'

export const useReunionesStore = defineStore('reuniones', {
    state: () => ({
        items: [],
        upcomingItems: [],
        loading: false,
        error: null,
    }),
    getters: {
        byId: (state) => (id) => state.items.find(r => r.id === Number(id)),
    },
    actions: {
        async fetchAll() {
            this.loading = true;
            this.error = null;
            try {
                this.items = await getReunionsList();
            } catch (e) {
                this.error = e?.message || 'Error al listar reuniones';
                showAlerta(this.error, 'error');
            } finally {
                this.loading = false;
            }
        },
        async fetchById(id) {
            const existingReunion = this.byId(id);
            if (existingReunion) return existingReunion;

            this.loading = true
            this.error = null
            try {
                const reunionId = Number(id);
                const reunion = await getReunionById(reunionId)
                const idx = this.items.findIndex(r => r.id === reunionId)

                if (idx === -1) {
                    this.items.unshift(reunion)
                } else {
                    this.items[idx] = reunion
                }
                return reunion;
            } catch (e) {
                this.error = e?.response?.data?.message || e?.message || `Error al obtener reunion ${id}`
                showAlerta(this.error, 'error');
                throw e;
            } finally {
                this.loading = false
            }
        },
        async add(reunionPayload) {
            try {
                const response = await createReunion(reunionPayload);
                const created = response?.reunion;
                if (!created) {
                    throw new Error('La API no devolvió una reunión válida.');
                }

                this.items.unshift(created)

                showAlerta(
                    'Reunión creada correctamente',
                    'success'
                );
                return created
            } catch (e) {
                showErroresDeValidacion(e?.response?.data?.errors || e)
                throw e
            }
        },
        async save(id, reunion) {
            try {
                const response = await updateReunion(id, reunion);
                const updated = response?.reunion || response;

                if (!updated || !updated.id) {
                    throw new Error('La API no devolvió una reunión actualizada.');
                }

                const idx = this.items.findIndex(r => r.id === id)
                if (idx !== -1) this.items[idx] = updated

                showAlerta('Reunión actualizada correctamente', 'success')
                return updated
            } catch (e) {
                showErroresDeValidacion(e?.response?.data?.errors || e)
                if (!e?.response?.data?.errors) {
                    showAlerta(e?.response?.data?.message || e?.message || 'Error al actualizar reunión', 'error');
                }
                throw e
            }
        },
        async remove(id, nombre) {
            const reunionId = Number(id);

            const ok = await confirmarEliminacion(nombre || `reunión con ID ${nombre}`)
            if (!ok) {
                showAlerta('Operación cancelada', 'info')
                return false
            }

            try {
                await deleteReunionById(reunionId)

                this.items = this.items.filter(u => u.id !== reunionId)

                showAlerta('Reunión eliminada correctamente', 'success')
                return true
            } catch (e) {
                this.error = e?.response?.data?.message || e?.message || 'No se pudo eliminar la reunión'
                showAlerta(this.error, 'error')
                return false
            }
        },
        async fetchUpcoming() {
            this.loading = true
            try {
                this.upcomingItems = await getUpcomingReuniones()
            } catch (e) {
                this.error = e?.message || 'Error al cargar actividades'
                console.error(this.error)
            } finally {
                this.loading = false
            }
        }
    }
})