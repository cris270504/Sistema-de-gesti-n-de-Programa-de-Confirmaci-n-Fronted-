import { defineStore } from 'pinia'
import { getDashboardMetricas } from '../services/dashboard';

export const useDashboardStore = defineStore('dashboard', {
    state: () => ({
        metricas: {},
        alertas: [],
        loading: false,
        error: null,
    }),

    actions: {
        async fetchMetricas() {
            this.loading = true;
            this.error = null;
            
            try {
                const response = await getDashboardMetricas();
                // Asignamos directamente los nodos del JSON que nos devuelve Render
                this.metricas = response.metricas;
                this.alertas = response.alertas;
            } catch (e) {
                this.error = e?.response?.data?.message || e?.message || 'Error al cargar las métricas del dashboard';
                console.error("Error real al obtener métricas:", e);
            } finally {
                this.loading = false;
            }
        }
    },
})