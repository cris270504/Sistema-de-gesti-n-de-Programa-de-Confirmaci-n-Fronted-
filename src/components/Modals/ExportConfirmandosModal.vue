<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Modal } from 'bootstrap';
import { Download, Info, Check, FileSpreadsheet, FileText } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
import { showAlerta } from '@/funciones';
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn';
import { getConfirmandosExport } from '@/services/confirmandos';
import {
    COLUMNAS, GRUPOS_COLUMNAS, ESTADOS_EXPORT,
    columnasPorClave, construirFilas, describirFiltros, nombreArchivoExport, tituloExport,
    calcularOrientacionPdf,
} from '@/lib/exportConfirmandos';

// Columnas marcadas por defecto: lo básico para una lista de contacto.
const COLUMNAS_POR_DEFECTO = ['apellidos', 'nombres', 'celular', 'estado', 'grupo'];

const modalRef = ref(null);
const modalInstance = ref(null);

const estado = ref('todos');
const columnasSel = ref([...COLUMNAS_POR_DEFECTO]);
const formato = ref('xlsx');
const exportando = ref(false);
// Filtros activos de la tabla (búsqueda, grupo, procedencia) al abrir el modal.
const filtrosTabla = ref({ search: '', grupo: 'todos', procedencia: 'todos' });
const gruposTabla = ref([]);

const filtrosActivos = computed(() => describirFiltros(filtrosTabla.value, gruposTabla.value));
const columnasPorGrupo = computed(() =>
    GRUPOS_COLUMNAS.map((g) => ({ ...g, columnas: COLUMNAS.filter((c) => c.group === g.id) })),
);
const sinColumnas = computed(() => columnasSel.value.length === 0);
const todasSeleccionadas = computed(() => columnasSel.value.length === COLUMNAS.length);

// Resumen del footer: qué archivo va a salir con la selección actual.
const resumen = computed(() => {
    const n = columnasSel.value.length;
    if (n === 0) return 'Selecciona al menos una columna';
    const cols = `${n} ${n === 1 ? 'columna' : 'columnas'}`;
    if (formato.value === 'xlsx') return `${cols} en Excel`;
    const orientacion = calcularOrientacionPdf(columnasPorClave(columnasSel.value));
    return `${cols} en PDF ${orientacion === 'portrait' ? 'vertical' : 'horizontal'}`;
});

const FORMATOS = [
    { value: 'xlsx', label: 'Excel', ext: '.xlsx', descripcion: 'Para filtrar, ordenar o editar los datos', icon: FileSpreadsheet },
    { value: 'pdf', label: 'PDF', ext: '.pdf', descripcion: 'Para imprimir o compartir; la hoja se orienta sola', icon: FileText },
];

let detachFocusReturn = () => {};
onMounted(() => {
    modalInstance.value = new Modal(modalRef.value);
    detachFocusReturn = attachModalFocusReturn(modalRef.value);
});
onUnmounted(() => {
    detachFocusReturn();
    modalInstance.value?.dispose();
});

// Recibe los filtros actuales de ListConfirmandos y los grupos (para nombrarlos).
const abrir = ({ filtros = {}, grupos = [] } = {}) => {
    const { search = '', grupo = 'todos', procedencia = 'todos', estado: estadoTabla = 'todos' } = filtros;
    filtrosTabla.value = { search, grupo, procedencia };
    gruposTabla.value = grupos;
    estado.value = estadoTabla;
    modalInstance.value?.show();
};
const cerrar = () => modalInstance.value?.hide();

defineExpose({ abrir, cerrar });

const seleccionarTodas = () => { columnasSel.value = COLUMNAS.map((c) => c.key); };
const seleccionarNinguna = () => { columnasSel.value = []; };

const exportar = async () => {
    if (exportando.value || sinColumnas.value) return;
    exportando.value = true;
    try {
        let confirmandos;
        try {
            confirmandos = await getConfirmandosExport({ filters: { ...filtrosTabla.value, estado: estado.value } });
        } catch (e) {
            // El servicio ya traduce el error a un mensaje legible.
            showAlerta(e?.message || 'No se pudo obtener la lista para exportar.', 'error');
            return;
        }

        if (confirmandos.length === 0) {
            showAlerta('No hay confirmandos que coincidan con el estado y los filtros elegidos.', 'info');
            return;
        }

        const columnas = columnasPorClave(columnasSel.value);
        const filas = construirFilas(confirmandos, columnas);
        const titulo = tituloExport(estado.value);
        const fecha = new Date();

        try {
            // Las librerías de archivos se cargan recién aquí (no pesan en el bundle principal).
            const generadores = await import('@/lib/exportConfirmandosArchivos');
            const blob = formato.value === 'xlsx'
                ? await generadores.generarExcel({ titulo, columnas, filas })
                : await generadores.generarPdf({ titulo, columnas, filas, filtros: filtrosActivos.value, fecha });
            const nombre = nombreArchivoExport({ estado: estado.value, fecha, extension: formato.value });
            const resultado = await generadores.guardarArchivo(blob, nombre, generadores.TIPOS_ARCHIVO[formato.value]);
            if (resultado === 'guardado') {
                cerrar();
                showAlerta(`Archivo exportado (${confirmandos.length} registros).`, 'success');
            }
        } catch {
            showAlerta('No se pudo generar o guardar el archivo. Inténtalo de nuevo.', 'error');
        }
    } finally {
        exportando.value = false;
    }
};
</script>

<template>
    <div class="modal fade" ref="modalRef" id="exportConfirmandosModal" tabindex="-1" role="dialog" aria-modal="true"
        aria-labelledby="exportConfirmandosModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
            <div class="modal-content exp">
                <header class="modal-header">
                    <span class="modal-header__icon" aria-hidden="true"><Download :size="18" /></span>
                    <div class="modal-header__text">
                        <h5 id="exportConfirmandosModalLabel" class="modal-title">Exportar confirmandos</h5>
                        <p class="modal-subtitle">Elige qué confirmandos, qué datos y en qué archivo</p>
                    </div>
                    <button type="button" class="btn-close" aria-label="Cerrar" data-bs-dismiss="modal"
                        :disabled="exportando"></button>
                </header>

                <form class="exp-form" @submit.prevent="exportar">
                    <div class="modal-body exp-body">
                        <p class="exp-note" role="note">
                            <Info :size="15" class="exp-note-icon" aria-hidden="true" />
                            <span v-if="filtrosActivos.length">
                                Se aplicarán los filtros de la tabla: <strong>{{ filtrosActivos.join(', ') }}</strong>.
                            </span>
                            <span v-else>Sin filtros en la tabla: se exporta todo lo que coincida con el estado.</span>
                        </p>

                        <fieldset class="exp-section" :disabled="exportando">
                            <legend class="exp-legend">Estado</legend>
                            <div class="exp-segmented" role="radiogroup" aria-label="Estado de los confirmandos">
                                <template v-for="e in ESTADOS_EXPORT" :key="e.value">
                                    <input type="radio" class="exp-visually-hidden" name="exportEstado"
                                        :id="`exp-estado-${e.value}`" :value="e.value" v-model="estado">
                                    <label class="exp-segment" :for="`exp-estado-${e.value}`">{{ e.label }}</label>
                                </template>
                            </div>
                        </fieldset>

                        <fieldset class="exp-section" :disabled="exportando">
                            <div class="exp-section-head">
                                <legend class="exp-legend">Columnas</legend>
                                <span class="exp-count" aria-live="polite">{{ columnasSel.length }} de {{ COLUMNAS.length }}</span>
                                <button type="button" class="exp-link"
                                    @click="todasSeleccionadas ? seleccionarNinguna() : seleccionarTodas()">
                                    {{ todasSeleccionadas ? 'Quitar todas' : 'Seleccionar todas' }}
                                </button>
                            </div>

                            <div class="exp-groups">
                                <div v-for="g in columnasPorGrupo" :key="g.id" class="exp-group">
                                    <span class="exp-group-name" :id="`exp-grupo-${g.id}`">{{ g.label }}</span>
                                    <div class="exp-chips" role="group" :aria-labelledby="`exp-grupo-${g.id}`">
                                        <label v-for="c in g.columnas" :key="c.key" class="exp-chip"
                                            :class="{ 'is-on': columnasSel.includes(c.key) }">
                                            <input type="checkbox" class="exp-visually-hidden" :value="c.key"
                                                v-model="columnasSel">
                                            <Check :size="13" :stroke-width="3" class="exp-chip-check" aria-hidden="true" />
                                            {{ c.label }}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        <fieldset class="exp-section mb-0" :disabled="exportando">
                            <legend class="exp-legend">Formato</legend>
                            <div class="exp-formats">
                                <label v-for="f in FORMATOS" :key="f.value" class="exp-format"
                                    :class="[`is-${f.value}`, { 'is-on': formato === f.value }]">
                                    <input type="radio" class="exp-visually-hidden" name="exportFormato" :value="f.value"
                                        v-model="formato">
                                    <span class="exp-format-icon" aria-hidden="true"><component :is="f.icon" :size="20" /></span>
                                    <span class="exp-format-text">
                                        <span class="exp-format-name">{{ f.label }} <span class="exp-format-ext">{{ f.ext }}</span></span>
                                        <span class="exp-format-desc">{{ f.descripcion }}</span>
                                    </span>
                                    <span class="exp-radio" aria-hidden="true"></span>
                                </label>
                            </div>
                        </fieldset>
                    </div>

                    <footer class="modal-footer">
                        <p class="modal-footer__note" :class="{ 'is-error': sinColumnas }" aria-live="polite">{{ resumen }}</p>
                        <AppButton variant="secondary" data-bs-dismiss="modal" :disabled="exportando">Cancelar</AppButton>
                        <AppButton type="submit" :icon="Download" :loading="exportando"
                            :disabled="sinColumnas">
                            {{ exportando ? 'Exportando…' : 'Exportar' }}
                        </AppButton>
                    </footer>
                </form>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Cuerpo */
.exp-form { display: flex; flex-direction: column; min-height: 0; }
.exp-body { padding: 1.25rem 1.5rem 1.5rem !important; }
.exp-note {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    font-size: var(--fs-sm);
    line-height: 1.5;
    color: var(--text-muted);
    margin: 0 0 1.5rem;
}
.exp-note strong { color: var(--text); font-weight: 600; }
.exp-note-icon { flex-shrink: 0; margin-top: 0.15rem; }

.exp-section { margin: 0 0 1.75rem; padding: 0; border: 0; min-width: 0; }
.exp-section-head { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.625rem; }
.exp-section-head .exp-legend { margin-bottom: 0; }
.exp-legend {
    float: none;
    width: auto;
    font-size: var(--fs-ui);
    font-weight: 600;
    color: var(--text);
    margin-bottom: 0.625rem;
    padding: 0;
}
.exp-count { font-size: var(--fs-sm); color: var(--text-muted); font-variant-numeric: tabular-nums; }
.exp-link {
    margin-left: auto;
    border: 0;
    background: none;
    padding: 0.125rem 0.25rem;
    border-radius: var(--radius-sm);
    font-size: var(--fs-sm);
    font-weight: 500;
    color: var(--accent);
    transition: opacity 0.2s var(--ease);
}
.exp-link:hover { opacity: 0.75; }

/* Estado: control segmentado */
.exp-segmented {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-lg);
    background: var(--surface-sunken);
}
.exp-segment {
    padding: 0.45rem 0.5rem;
    border-radius: var(--radius-md);
    text-align: center;
    font-size: var(--fs-sm);
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    user-select: none;
    transition: background-color 0.25s var(--ease), color 0.25s var(--ease), box-shadow 0.25s var(--ease);
}
.exp-segment:hover { color: var(--text); }
input:checked + .exp-segment {
    background: var(--surface);
    color: var(--text);
    font-weight: 600;
    box-shadow: var(--shadow-sm);
}
:root[data-bs-theme="dark"] input:checked + .exp-segment { background: var(--line); }

/* Columnas: lista agrupada con chips */
.exp-groups {
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    overflow: hidden;
}
.exp-group {
    display: grid;
    grid-template-columns: 9.5rem 1fr;
    gap: 0.75rem;
    align-items: start;
    padding: 0.75rem 1rem;
}
.exp-group + .exp-group { border-top: 1px solid var(--line); }
.exp-group-name { font-size: var(--fs-sm); color: var(--text-muted); padding-top: 0.35rem; }
.exp-chips { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.exp-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--surface);
    font-size: var(--fs-sm);
    color: var(--text);
    cursor: pointer;
    user-select: none;
    transition: border-color 0.2s var(--ease), background-color 0.2s var(--ease),
        box-shadow 0.2s var(--ease), color 0.2s var(--ease);
}
.exp-chip:hover { border-color: var(--line-strong); box-shadow: var(--shadow-sm); }
.exp-chip-check {
    width: 0;
    opacity: 0;
    margin-left: -0.3rem;
    transition: width 0.2s var(--ease), opacity 0.2s var(--ease), margin 0.2s var(--ease);
}
.exp-chip.is-on {
    border-color: var(--accent-ring);
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 500;
}
.exp-chip.is-on .exp-chip-check { width: 13px; opacity: 1; margin-left: 0; }
:root[data-bs-theme="dark"] .exp-chip.is-on { color: color-mix(in srgb, var(--accent) 55%, #ffffff); }

/* Formato: dos opciones con descripción */
.exp-formats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.exp-format {
    --fmt: var(--success);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    cursor: pointer;
    transition: border-color 0.2s var(--ease), box-shadow 0.25s var(--ease), transform 0.25s var(--ease);
}
.exp-format.is-pdf { --fmt: var(--danger); }
.exp-format:hover { border-color: var(--line-strong); box-shadow: var(--shadow-md); transform: translateY(-1px); }
.exp-format.is-on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.exp-format-icon {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--radius-lg);
    flex-shrink: 0;
    color: var(--fmt);
    background: color-mix(in srgb, var(--fmt) 10%, transparent);
}
.exp-format-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.exp-format-name { font-size: var(--fs-ui); font-weight: 600; color: var(--text); }
.exp-format-ext { font-weight: 400; color: var(--text-muted); }
.exp-format-desc { font-size: var(--fs-xs); line-height: 1.4; color: var(--text-muted); }
.exp-radio {
    width: 1.125rem;
    height: 1.125rem;
    border-radius: 50%;
    border: 1.5px solid var(--line-strong);
    flex-shrink: 0;
    transition: border 0.2s var(--ease);
}
.exp-format.is-on .exp-radio { border: 5px solid var(--accent); }

.modal-footer__note.is-error { color: var(--danger); font-variant-numeric: tabular-nums; }

/* Foco visible y accesibilidad */
.exp-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    border: 0;
}
input:focus-visible + .exp-segment,
.exp-chip:has(input:focus-visible),
.exp-format:has(input:focus-visible),
.exp-link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}
fieldset:disabled .exp-segment,
fieldset:disabled .exp-chip,
fieldset:disabled .exp-format { cursor: not-allowed; opacity: 0.6; }

@media (max-width: 575.98px) {
    .exp-body { padding: 1rem !important; }
    .exp-segmented { grid-template-columns: repeat(2, 1fr); }
    .exp-group { grid-template-columns: 1fr; gap: 0.4rem; }
    .exp-group-name { padding-top: 0; }
    .exp-formats { grid-template-columns: 1fr; }
    .modal-footer__note { flex-basis: 100%; }
}

@media (prefers-reduced-motion: reduce) {
    .exp *, .exp *::before, .exp *::after { transition: none !important; }
    .exp-format:hover { transform: none; }
}
</style>
