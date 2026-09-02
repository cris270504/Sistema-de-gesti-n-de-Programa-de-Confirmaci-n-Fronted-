import { defineStore } from 'pinia'
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
import { confirmarEliminacion, confirmar, showAlerta, showErroresDeValidacion } from '@/funciones'
import { contarAsistenciasConfirmando } from '../services/confirmandos'

// Ventana de frescura: dentro de este lapso no se vuelve a pedir la lista completa
// al re-montar ListConfirmandos (evita el skeleton al navegar de ida y vuelta).
const FRESH_MS = 30_000

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
        stats: {},
        lastFetch: 0,
        _inflight: null,
    }),

    getters: {
        // NOTA: el cálculo de alertas de riesgo vive en el backend (GET /dashboard/metricas,
        // stores/dashboard.js). Antes había aquí un getter `confirmandosAlerta` que lo
        // recalculaba en el cliente con umbrales distintos; se eliminó para tener una sola
        // fuente de verdad (los umbrales serán configurables por parroquia en el backend).

        byId: (state) => (id) => state.items.find(c => c.id === Number(id)),
        count: (state) => state.items.length,
    },

    actions: {
        async fetchAll({ force = false } = {}) {
            // Dedupe: si dos componentes montan a la vez, una sola petición.
            if (this._inflight) return this._inflight;

            // Stale-while-revalidate: si la lista es reciente, no repetimos la llamada
            // (la vista ya la está mostrando).
            if (!force && this.items.length > 0 && Date.now() - this.lastFetch < FRESH_MS) {
                return;
            }

            // Skeleton solo si todavía no hay nada que mostrar; si ya hay datos,
            // refrescamos en silencio.
            if (this.items.length === 0) this.loading = true;
            this.error = null;

            this._inflight = getConfirmandosList()
                .then((response) => {
                    this.items = response;
                    this.lastFetch = Date.now();
                    this.fetchMetricas();
                })
                .catch((e) => {
                    this.error = e?.message || 'Error al listar Confirmandos';
                })
                .finally(() => {
                    this.loading = false;
                    this._inflight = null;
                });

            return this._inflight;
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

        /**
         * Trae un confirmando con TODAS sus relaciones (grupo, sacramentos, requisitos,
         * apoderados). El listado ya no incluye apoderados, así que un item "de lista"
         * se considera incompleto hasta que tenga el array `apoderados`.
         * @param {object} [opts]
         * @param {boolean} [opts.silent] no toca `loading` (para no meter la tabla en
         *   skeleton cuando esto se llama desde un modal que ya tiene su propio spinner).
         */
        async fetchById(id, { silent = false } = {}) {
            const existente = this.byId(id);
            if (existente && Array.isArray(existente.apoderados)) return existente;

            if (!silent) this.loading = true;
            this.error = null;
            try {
                const confirmandoId = Number(id);
                const confirmando = await getConfirmandoById(confirmandoId);
                const idx = this.items.findIndex(c => c.id === confirmandoId);

                if (idx === -1) {
                    this.items.unshift(confirmando);
                } else {
                    // Merge: conservamos lo que ya tenía la fila y le sumamos el detalle.
                    this.items[idx] = { ...this.items[idx], ...confirmando };
                }
                return this.items[idx === -1 ? 0 : idx];
            } catch (e) {
                this.error = e?.response?.data?.message || e?.message || `Error al obtener confirmando ${id}`;
                showAlerta(this.error, 'error');
                throw e;
            } finally {
                if (!silent) this.loading = false;
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
            const etiqueta = nombre || `Confirmando con ID ${confirmandoId}`;

            // ¿Tiene historial de asistencia? Entonces no se elimina (se perdería y
            // dejaría filas huérfanas): se ofrece retirarlo del programa.
            let nAsist = 0;
            try { nAsist = await contarAsistenciasConfirmando(confirmandoId); } catch { /* ignora, el trigger igual protege */ }
            if (nAsist > 0) {
                const retirar = await confirmar({
                    titulo: `${etiqueta} tiene ${nAsist} registro(s) de asistencia`,
                    texto: 'No se puede eliminar sin perder ese historial. ¿Retirarlo del programa en su lugar?',
                    icono: 'warning',
                    confirmarTexto: 'Sí, retirar del programa',
                    cancelarTexto: 'No hacer nada',
                });
                if (retirar) return this.registrarRetiro(confirmandoId, nombre);
                return false;
            }

            const ok = await confirmarEliminacion(etiqueta);
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
                await this.fetchAll({ force: true }); // Recarga masiva e indirectamente ejecuta métricas
                return response;
            } catch (error) {
                throw error;
            }
        },

        /**
         * Aplica en memoria el resultado del generador de grupos (mapa
         * confirmando_id -> grupo_id + lista de grupos), sin re-descargar toda la
         * lista de confirmandos.
         */
        aplicarAsignaciones(asignaciones = {}, grupos = []) {
            const gruposPorId = new Map(grupos.map(g => [Number(g.id), g]));
            for (const [confId, grupoId] of Object.entries(asignaciones)) {
                const c = this.items.find(x => x.id === Number(confId));
                if (!c) continue;
                c.grupo_id = Number(grupoId);
                const g = gruposPorId.get(Number(grupoId));
                if (g) {
                    c.grupo = {
                        id: g.id,
                        nombre: g.nombre,
                        color: g.color,
                        procedencia: g.procedencia,
                    };
                }
            }
            this.lastFetch = Date.now(); // el estado local quedó al día
            this.fetchMetricas();
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