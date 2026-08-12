import { defineStore } from 'pinia'
import { useAuthStore } from './auth';
import {
    createConfirmando,
    deleteConfirmandoById,
    getConfirmandoById,
    getConfirmandosList,
    updateConfirmando,
    importarConfirmandosExcel,
    retirarConfirmandoById,
    obtenerPerfilConfirmando,
} from '../services/confirmandos';
import { confirmarEliminacion, showAlerta, showErroresDeValidacion } from '@/funciones'

export const useConfirmandosStore = defineStore('confirmandos', {
    state: () => ({
        items: [],
        pagination: {
            currentPage: 1,
            lastPage: 1,
            total: 0
        },
        loading: false,
        error: null,
        stats: {}
    }),

    getters: {
        confirmandosAlerta(state) {
            const authStore = useAuthStore();
            const esGestor = authStore.can('ver todas las alertas') || authStore.user?.rol === 'coordinador';

            const data = state.items || [];

            return data.map(c => {
                const asistencias = c.asistencias || [];

                // Ordenar asistencias por fecha
                const asistenciasOrdenadas = [...asistencias].sort((a, b) => {
                    return new Date(a.reunion?.fecha || a.created_at) - new Date(b.reunion?.fecha || b.created_at);
                });

                // Contadores dinámicos y consecutivas
                let maxInjustificadasSeguidas = 0;
                let contadorSeguidasActual = 0;

                const conteo = asistenciasOrdenadas.reduce((acc, curr) => {
                    if (curr.estado === 'falta injustificada') {
                        acc.faltas_injustificadas++;
                        contadorSeguidasActual++;
                        if (contadorSeguidasActual > maxInjustificadasSeguidas) {
                            maxInjustificadasSeguidas = contadorSeguidasActual;
                        }
                    } else if (curr.estado === 'asistio' || curr.estado === 'tardanza') {
                        contadorSeguidasActual = 0;
                    }

                    if (curr.estado === 'falta justificada') acc.faltas_justificadas++;
                    if (curr.estado === 'tardanza') acc.tardanzas++;

                    return acc;
                }, { faltas_injustificadas: 0, faltas_justificadas: 0, tardanzas: 0 });

                // Determinar semáforo de riesgo
                let nivelRiesgo = 'NINGUNO';
                let motivoAlerta = '';

                if (maxInjustificadasSeguidas >= 3 || conteo.faltas_injustificadas >= 5) {
                    nivelRiesgo = 'ALTO';
                    motivoAlerta = maxInjustificadasSeguidas >= 3
                        ? `Alerta Crítica: ${maxInjustificadasSeguidas} faltas injustificadas SEGUIDAS.`
                        : `Alerta Crítica: ${conteo.faltas_injustificadas} faltas injustificadas acumuladas.`;
                } else if (conteo.faltas_justificadas >= 4) {
                    nivelRiesgo = 'MEDIO';
                    motivoAlerta = `Alerta de Desconexión: Tiene ${conteo.faltas_justificadas} faltas justificadas.`;
                } else if (conteo.tardanzas >= 4) {
                    nivelRiesgo = 'BAJO';
                    motivoAlerta = `Alerta de Impuntualidad: Acumula ${conteo.tardanzas} tardanzas.`;
                }

                const apoderado = c.apoderados && c.apoderados.length > 0 ? c.apoderados[0] : null;

                return {
                    ...c,
                    nombre_completo: `${c.apellidos}, ${c.nombres}`,
                    total_faltas_injustificadas: conteo.faltas_injustificadas,
                    total_faltas_justificadas: conteo.faltas_justificadas,
                    total_tardanzas: conteo.tardanzas,
                    injustificadas_seguidas: maxInjustificadasSeguidas,
                    nivel_riesgo: nivelRiesgo,
                    motivo_alerta: motivoAlerta,
                    nombre_apoderado: apoderado ? `${apoderado.apellidos}, ${apoderado.nombres}` : 'No asignado',
                    celular_apoderado: apoderado ? apoderado.celular : c.celular
                };
            }).filter(c => {
                const misGrupos = (authStore.user?.grupo_ids || []).map(Number);
                const cumpleRol = esGestor || misGrupos.includes(Number(c.grupo_id));
                const estaActivo = c.estado !== 'retirado';
                const tieneAlerta = c.nivel_riesgo !== 'NINGUNO';
                return cumpleRol && estaActivo && tieneAlerta;
            });
        },

        byId: (state) => (id) => state.items.find(c => c.id === Number(id)),
        count: (state) => state.items.length,
    },

    actions: {
        async fetchAll() {
            this.loading = true;
            this.error = null;
            try {
                // "response" recibe directamente lo que retornó el servicio (el Array completo)
                const response = await getConfirmandosList();

                // ➔ CAMBIO AQUÍ: Asignamos 'response' directamente, sin el '.data'
                this.items = response;

                this.fetchMetricas();

            } catch (e) {
                this.error = e?.message || 'Error al listar Confirmandos';
            } finally {
                this.loading = false;
            }
        },

        // 3. NUEVA ACCIÓN ORDINARIA QUE SE CONECTA AL CONTROLADOR DE LARAVEL
        fetchMetricas() {
            try {
                // 1. Contamos directamente desde el arreglo que ya tenemos en memoria (this.items)
                const activos = this.items.filter(c => c.estado === 'en_preparacion').length;
                const retirados = this.items.filter(c => c.estado === 'retirado').length;
                const confirmados = this.items.filter(c => c.estado === 'confirmado').length;

                const total = this.items.length || 1; // Evita división por 0

                // 2. Almacenamos el cálculo consolidado en el state
                this.stats = {
                    activos,
                    retirados,
                    confirmados,
                    tasaRetencion: Number(((activos / total) * 100).toFixed(1)),
                    tasaDesercion: Number(((retirados / total) * 100).toFixed(1))
                };
            } catch (e) {
                console.error('Error al calcular métricas locales:', e);
            }
        },

        async fetchById(id) {
            const existingConfirmando = this.byId(id);
            if (existingConfirmando) return existingConfirmando;

            this.loading = true;
            this.error = null;
            try {
                const confirmandoId = Number(id);
                const confirmando = await getConfirmandoById(confirmandoId);
                const idx = this.items.findIndex(c => c.id === confirmandoId);

                if (idx === -1) {
                    this.items.unshift(confirmando);
                } else {
                    this.items[idx] = confirmando;
                }
                return confirmando;
            } catch (e) {
                this.error = e?.response?.data?.message || e?.message || `Error al obtener confirmando ${id}`;
                showAlerta(this.error, 'error');
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async fetchPerfilById(id) {
            this.loading = true;
            this.error = null;
            try {
                const confirmandoId = Number(id);

                // Llamamos al servicio (este ya devuelve res.data)
                const perfil = await obtenerPerfilConfirmando(confirmandoId);

                // Retornamos el perfil directamente, SIN reemplazar this.items
                return perfil;

            } catch (e) {
                this.error = e?.response?.data?.message || e?.message || `Error al obtener el perfil del confirmando ${id}`;
                showAlerta(this.error, 'error');
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async add(confirmandoPayload) {
            try {
                const response = await createConfirmando(confirmandoPayload);
                const created = response?.confirmando;
                if (!created) {
                    throw new Error('La API no devolvió un confirmando válido.');
                }

                this.items.unshift(created);
                await this.fetchMetricas(); // Recalcular totales

                showAlerta(`Confirmando ${created.nombres} ${created.apellidos} creado correctamente.`, 'success');
                return created;
            } catch (e) {
                showErroresDeValidacion(e?.response?.data?.errors || e);
                throw e;
            }
        },

        async save(id, confirmando) {
            try {
                const response = await updateConfirmando(id, confirmando);
                const updated = response?.confirmando;

                if (!updated) {
                    throw new Error('La API no devolvió un confirmando actualizado.');
                }

                const idx = this.items.findIndex(c => c.id === id);
                if (idx !== -1) {
                    this.items[idx] = { ...this.items[idx], ...updated };
                }

                await this.fetchMetricas(); // Recalcular por si cambió un estado
                showAlerta('Confirmando actualizado correctamente', 'success');
                return updated;
            } catch (e) {
                showErroresDeValidacion(e?.response?.data?.errors || e);
                if (!e?.response?.data?.errors) {
                    showAlerta(e?.response?.data?.message || 'Error al actualizar confirmando', 'error');
                }
                throw e;
            }
        },

        async remove(id, nombre) {
            const confirmandoId = Number(id);
            const ok = await confirmarEliminacion(nombre || `Confirmando con ID ${confirmandoId}`);
            if (!ok) {
                showAlerta('Operación cancelada', 'info');
                return false;
            }

            try {
                await deleteConfirmandoById(confirmandoId);
                this.items = this.items.filter(c => c.id !== confirmandoId);
                await this.fetchMetricas(); // Recalcular totales

                showAlerta('Confirmando eliminado correctamente', 'success');
                return true;
            } catch (e) {
                this.error = e?.response?.data?.message || 'No se pudo eliminar';
                showAlerta(this.error, 'error');
                return false;
            }
        },

        async importarExcel(formData) {
            try {
                const response = await importarConfirmandosExcel(formData);
                await this.fetchAll(); // Recarga masiva e indirectamente ejecuta métricas
                return response;
            } catch (error) {
                throw error;
            }
        },

        async registrarRetiro(id, nombre) {
            const confirmandoId = Number(id);
            try {
                await retirarConfirmandoById(confirmandoId);
                this.items = this.items.filter(c => c.id !== confirmandoId);

                // 4. ¡VITAL! Al dar de baja a alguien, pedimos los números frescos a Laravel
                await this.fetchMetricas();

                showAlerta('¡Confirmando retirado correctamente!', 'success');
                return true;
            } catch (e) {
                this.error = e?.response?.data?.message || 'No se pudo procesar el retiro';
                showAlerta(this.error, 'error');
                return false;
            }
        }
    },
});