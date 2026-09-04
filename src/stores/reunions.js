import { defineStore } from 'pinia'
import { getUpcomingReuniones } from '@/services/reunions'
import { createReunion, deleteReunionById, getReunionById, getReunionsList, updateReunion, contarAsistenciasReunion } from '../services/reunions';
import { confirmarEliminacion, showAlerta, showErroresDeValidacion } from '@/funciones'

const FRESH_MS = 30_000

export const useReunionesStore = defineStore('reuniones', {
    state: () => ({
        items: [],
        upcomingItems: [],
        loading: false,
        error: null,
        lastFetch: 0,
        lastFetchUpcoming: 0,
        _inflight: null,
        _inflightUpcoming: null,
    }),
    getters: {
        byId: (state) => (id) => state.items.find(r => r.id === Number(id)),
    },
    actions: {
        async fetchAll({ force = false } = {}) {
            if (this._inflight) return this._inflight;
            if (!force && this.items.length > 0 && Date.now() - this.lastFetch < FRESH_MS) return;

            if (this.items.length === 0) this.loading = true;
            this.error = null;

            this._inflight = getReunionsList()
                .then((data) => {
                    this.items = data;
                    this.lastFetch = Date.now();
                })
                .catch((e) => {
                    this.error = e?.message || 'Error al listar reuniones';
                    showAlerta(this.error, 'error');
                })
                .finally(() => {
                    this.loading = false;
                    this._inflight = null;
                });

            return this._inflight;
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
                throw e
            }
        },
        async remove(id, nombre) {
            const reunionId = Number(id);

            // Una reunión con asistencia registrada no se puede borrar (se perdería
            // ese historial). Se avisa antes de mostrar el diálogo de eliminación.
            let nAsist = 0;
            try { nAsist = await contarAsistenciasReunion(reunionId); } catch { /* el trigger igual protege */ }
            if (nAsist > 0) {
                showAlerta(
                    `Esta reunión tiene ${nAsist} registro(s) de asistencia. No se puede eliminar sin perder ese historial; edítala si necesitas corregir algo.`,
                    'warning',
                );
                return false;
            }

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
        async fetchUpcoming({ force = false } = {}) {
            if (this._inflightUpcoming) return this._inflightUpcoming
            if (!force && this.upcomingItems.length > 0 && Date.now() - this.lastFetchUpcoming < FRESH_MS) return

            if (this.upcomingItems.length === 0) this.loading = true

            this._inflightUpcoming = getUpcomingReuniones()
                .then((data) => {
                    this.upcomingItems = data
                    this.lastFetchUpcoming = Date.now()
                })
                .catch((e) => {
                    this.error = e?.message || 'Error al cargar actividades'
                    console.error(this.error)
                })
                .finally(() => {
                    this.loading = false
                    this._inflightUpcoming = null
                })

            return this._inflightUpcoming
        }
    }
})