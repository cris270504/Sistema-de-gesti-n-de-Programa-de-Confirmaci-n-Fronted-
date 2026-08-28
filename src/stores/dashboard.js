import { defineStore } from 'pinia'
import { getDashboardMetricas } from '../services/dashboard';

// Ventana de frescura: dentro de este lapso no se vuelve a pedir al backend al
// re-montar el dashboard (evita el skeleton al navegar de ida y vuelta).
const FRESH_MS = 30_000

export const useDashboardStore = defineStore('dashboard', {
    state: () => ({
        metricas: {},
        alertas: [],
        loading: false,
        error: null,
        lastFetch: 0,
        _inflight: null,
    }),

    actions: {
        /**
         * Siembra los conteos básicos (vienen en la respuesta del login). No marca
         * los datos como "frescos": fetchMetricas igual corre para traer las alertas.
         */
        seedMetricas(metricas) {
            if (metricas) this.metricas = { ...this.metricas, ...metricas }
        },

        async fetchMetricas({ force = false } = {}) {
            // Dedupe: si ya hay una petición en curso, la reusamos.
            if (this._inflight) return this._inflight

            // Stale-while-revalidate: datos recientes => no repetimos la llamada.
            if (!force && this.lastFetch && Date.now() - this.lastFetch < FRESH_MS) return

            // Skeleton solo la primera vez (si ya hay datos, refrescamos en silencio).
            if (!this.lastFetch) this.loading = true
            this.error = null

            this._inflight = getDashboardMetricas()
                .then((response) => {
                    this.metricas = response.metricas
                    this.alertas = response.alertas
                    this.lastFetch = Date.now()
                })
                .catch((e) => {
                    this.error = e?.response?.data?.message || e?.message || 'Error al cargar las métricas del dashboard'
                    console.error('Error real al obtener métricas:', e)
                })
                .finally(() => {
                    this.loading = false
                    this._inflight = null
                })

            return this._inflight
        },
    },
})
