import { defineStore } from 'pinia'
import {
    createConfirmando,
    deleteConfirmandoById,
    getConfirmandoById,
    getConfirmandosList,
    getConfirmandosPaginado,
    updateConfirmando,
    importarConfirmandosExcel,
    retirarConfirmandoById,
    reingresarConfirmandoById,
    contarAsistenciasConfirmando,
    obtenerPerfilConfirmando,
} from '../services/confirmandos';
import { confirmarEliminacion, confirmar, pedirTexto, showAlerta, showErroresDeValidacion } from '@/funciones'

// Ventana de frescura: dentro de este lapso no se vuelve a pedir la lista completa
// al re-montar ListConfirmandos (evita el skeleton al navegar de ida y vuelta).
const FRESH_MS = 30_000

export const useConfirmandosStore = defineStore('confirmandos', {
    state: () => ({
        // Lista completa, sin paginar — la usan AsignacionGrupo.vue,
        // AsignarConfirmandosModal.vue y Cumpleanos/listCumpleanos.vue, que
        // necesitan el dataset entero. No confundir con `pagina` de abajo.
        items: [],
        loading: false,
        error: null,
        lastFetch: 0,
        _inflight: null,

        // Vista paginada server-side, usada solo por ListConfirmandos.vue (el
        // único caso con crecimiento real sin límite). Estado separado a
        // propósito: convertir `items` en "solo la página actual" rompería en
        // silencio las otras pantallas de arriba, que necesitan el listado
        // completo.
        pagina: { items: [], total: 0 },
        pagination: { page: 1, pageSize: 25 },
        filters: { search: '', estado: 'todos', grupo: 'todos', procedencia: 'todos' },
        _inflightPaginado: null,
        lastFetchPaginado: 0,
        lastFetchKeyPaginado: null,
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

        /**
         * Paginación server-side para ListConfirmandos.vue. Mismo patrón de
         * dedupe + ventana de frescura que `fetchAll`, pero contra `pagina`/
         * `pagination`/`filters` (no toca `items`). Cambiar de página o de
         * filtros siempre vuelve a pedir al backend.
         */
        async fetchPaginado({ force = false, page, pageSize, filters } = {}) {
            if (this._inflightPaginado) return this._inflightPaginado;

            const filtrosCambiaron = filters !== undefined && JSON.stringify(filters) !== JSON.stringify(this.filters);
            if (filtrosCambiaron) {
                this.filters = filters;
                this.pagination.page = 1;
            } else if (page !== undefined) {
                this.pagination.page = page;
            }
            if (pageSize !== undefined) this.pagination.pageSize = pageSize;

            const key = JSON.stringify({ page: this.pagination.page, pageSize: this.pagination.pageSize, filters: this.filters });
            if (!force && this.lastFetchKeyPaginado === key && Date.now() - this.lastFetchPaginado < FRESH_MS) {
                return;
            }

            if (this.pagina.items.length === 0) this.loading = true;
            this.error = null;

            this._inflightPaginado = getConfirmandosPaginado({
                page: this.pagination.page,
                pageSize: this.pagination.pageSize,
                filters: this.filters,
            })
                .then((response) => {
                    this.pagina.items = response.items;
                    this.pagina.total = response.total;
                    this.lastFetchPaginado = Date.now();
                    this.lastFetchKeyPaginado = key;
                })
                .catch((e) => {
                    this.error = e?.message || 'Error al listar Confirmandos';
                })
                .finally(() => {
                    this.loading = false;
                    this._inflightPaginado = null;
                });

            return this._inflightPaginado;
        },

        // Las acciones de mutación de abajo (add/save/remove/registrarRetiro/
        // reingresar/aplicarAsignaciones) siguen parcheando `items` en memoria
        // igual que antes. Además, si la vista paginada está activa (alguien
        // ya llamó a fetchPaginado), la refrescan: no se puede parchear una
        // página de forma confiable (el total y los límites de página pueden
        // cambiar), así que se vuelve a pedir al backend.
        async _refrescarPaginaSiActiva() {
            if (this.pagina.items.length > 0) {
                await this.fetchPaginado({ force: true });
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
                await this._refrescarPaginaSiActiva();

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
                await this._refrescarPaginaSiActiva();

                showAlerta('Confirmando actualizado correctamente', 'success');
                return updated;
            } catch (e) {
                showErroresDeValidacion(e?.response?.data?.errors || e);
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
                await this._refrescarPaginaSiActiva();

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
                await this.fetchAll({ force: true }); // Recarga masiva
                await this._refrescarPaginaSiActiva();
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
        async aplicarAsignaciones(asignaciones = {}, grupos = []) {
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
            await this._refrescarPaginaSiActiva();
        },

        async registrarRetiro(id, nombre) {
            const confirmandoId = Number(id);
            const motivo = await pedirTexto({
                titulo: `Retirar del programa${nombre ? ` a ${nombre}` : ''}`,
                texto: 'Deja de contar en el padrón activo y en las asistencias. Puede reingresar después.',
                placeholder: 'Motivo (opcional): cambió de parroquia, dejó de asistir…',
                confirmarTexto: 'Retirar',
            });
            if (motivo === undefined) return false; // cancelado

            try {
                await retirarConfirmandoById(confirmandoId, motivo);
                this._parchearEstado(confirmandoId, 'retirado', { motivo_retiro: motivo, fecha_retiro: new Date().toISOString() });
                await this._refrescarPaginaSiActiva();
                showAlerta('Confirmando retirado del programa.', 'success');
                return true;
            } catch (e) {
                this.error = e?.message || 'No se pudo procesar el retiro';
                showAlerta(this.error, 'error');
                return false;
            }
        },

        // Parchea en memoria el estado de un confirmando (retiro/reingreso) sin
        // sacarlo de la lista: sigue visible en las pestañas "Retirados"/"Todos".
        _parchearEstado(id, estado, extra = {}) {
            const c = this.items.find(x => x.id === Number(id));
            if (c) Object.assign(c, { estado, ...extra });
        },

        async reingresar(id, nombre) {
            const confirmandoId = Number(id);
            const ok = await confirmar({
                titulo: `¿Reingresar${nombre ? ` a ${nombre}` : ''} al programa?`,
                texto: 'Vuelve a "En preparación" y al padrón activo.',
                icono: 'question', confirmarTexto: 'Sí, reingresar',
            });
            if (!ok) return false;
            try {
                await reingresarConfirmandoById(confirmandoId);
                this._parchearEstado(confirmandoId, 'en_preparacion', { motivo_retiro: null, fecha_retiro: null });
                await this._refrescarPaginaSiActiva();
                showAlerta('Confirmando reingresado al programa.', 'success');
                return true;
            } catch (e) {
                this.error = e?.message || 'No se pudo reingresar';
                showAlerta(this.error, 'error');
                return false;
            }
        }
    },
});