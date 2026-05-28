import { defineStore } from 'pinia';
import { showAlerta } from '@/funciones';
import {
    getJustificacionesPendientes,
    saveJustificacionAcuerdo,
    completeJustificacion,
    rejectJustificacion
} from '../services/justificaciones';
import api from '@/lib/api';

export const useJustificacionesStore = defineStore('justificaciones', {
    state: () => ({
        items: [],
        loading: false,
        error: null,
    }),

    actions: {
        // Cargar lista desde el servidor
        async fetchPendientes() {
            this.loading = true;
            this.items = []; // <-- CRUCIAL: Limpiamos los datos residuales de la memoria de Vue
            try {
                const { data } = await api.get('/justificaciones');
                this.items = data; // Guardamos la lista fresca traída de TiDB
            } catch (error) {
                console.error("Error al traer justificaciones:", error);
                throw error;
            } finally {
                this.loading = false;
            }
        },

        // Registrar el compromiso inicial (Paso 1)
        async registrarAcuerdo(payload) {
            try {
                await saveJustificacionAcuerdo(payload);
                showAlerta('Acuerdo registrado. Estado cambiado a Pendiente.', 'success');

                // Recarga automática y sincronizada de la lista local
                await this.fetchPendientes();
                return true;
            } catch (e) {
                const msg = e?.response?.data?.message || 'Error al registrar el acuerdo';
                showAlerta(msg, 'error');
                return false;
            }
        },

        // Validar cumplimiento manualmente (Paso 2)
        async marcarComoCumplido(asistenciaId) {
            try {
                await completeJustificacion(asistenciaId);
                showAlerta('Falta justificada formalmente. Matriz actualizada.', 'success');

                // Recarga automática y sincronizada de la lista local
                await this.fetchPendientes();
                return true;
            } catch (e) {
                const msg = e?.response?.data?.message || 'Error al validar la justificación';
                showAlerta(msg, 'error');
                return false;
            }
        },

        async rechazarAcuerdo(asistenciaId) {
            try {
                const data = await rejectJustificacion(asistenciaId);
                return data;
            } catch (error) {
                throw error;
            }
        }
    },
});