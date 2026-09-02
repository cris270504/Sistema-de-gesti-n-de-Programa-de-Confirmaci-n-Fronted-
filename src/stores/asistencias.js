import { defineStore } from 'pinia'
import { showAlerta } from '@/funciones'
import { getAsistenciasList, getAsistenciaMatrix, saveAsistenciasBulk } from '../services/asistencias';

export const useAsistenciasStore = defineStore('asistencias', {
    state: () => ({
        items: [],
        loading: false,
        error: null,
    }),

    actions: {
        async fetchByReunion(reunionId) {
            this.loading = true;
            this.error = null;
            try {
                this.items = await getAsistenciasList(reunionId);
            } catch (e) {
                this.error = e?.message || 'Error al cargar asistencias previas';
                console.error(this.error);
            } finally {
                this.loading = false;
            }
        },
        async fetchMatrix(tipo, fecha) {
            this.loading = true;
            this.error = null;
            try {
                return await getAsistenciaMatrix(tipo, fecha);
            } catch (e) {
                this.error = e?.message || 'Error al cargar la matriz';
                console.error(this.error);
            } finally {
                this.loading = false;
            }
        },

        async saveBulk(reunionId, payload) {
            try {
                await saveAsistenciasBulk(reunionId, payload);
                // Quitamos el fetchByReunion de aquí porque loadMatrix() ya hace el trabajo
                return true;
            } catch (e) {
                console.error("Error real al guardar asistencia:", e);
                throw new Error(e?.message || e?.response?.data?.message || 'Error al guardar asistencia');
            }
        }
    },
})