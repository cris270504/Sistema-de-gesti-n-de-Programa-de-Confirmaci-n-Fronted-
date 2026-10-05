<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Modal } from 'bootstrap';
import { Download, Info } from 'lucide-vue-next';
import { showAlerta } from '@/funciones';
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn';
import { getConfirmandosExport } from '@/services/confirmandos';
import {
    COLUMNAS, GRUPOS_COLUMNAS, ESTADOS_EXPORT,
    columnasPorClave, construirFilas, describirFiltros, nombreArchivoExport, tituloExport,
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
            <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                <header class="modal-header p-4">
                    <div>
                        <h5 id="exportConfirmandosModalLabel" class="modal-title fw-bold mb-0">
                            <Download class="h-5 w-5 me-2 d-inline-block align-text-bottom" aria-hidden="true" />
                            Exportar confirmandos
                        </h5>
                        <p class="text-white-50 small mb-0 mt-1">Elige el estado, las columnas y el formato del archivo</p>
                    </div>
                    <button type="button" class="btn-close" aria-label="Cerrar" data-bs-dismiss="modal"
                        :disabled="exportando"></button>
                </header>

                <form class="d-flex flex-column overflow-hidden" style="min-height: 0;" @submit.prevent="exportar">
                    <div class="modal-body p-4">
                        <div v-if="filtrosActivos.length" class="alert alert-info border-0 small d-flex gap-2" role="note">
                            <Info :size="18" class="flex-shrink-0 mt-1" aria-hidden="true" />
                            <div>
                                Se aplicarán los filtros activos de la tabla:
                                <strong>{{ filtrosActivos.join(' · ') }}</strong>.
                            </div>
                        </div>
                        <p v-else class="small text-body-secondary mb-3">
                            No hay filtros activos en la tabla (búsqueda, grupo o procedencia): se exportará todo lo que
                            coincida con el estado elegido.
                        </p>

                        <fieldset class="mb-4" :disabled="exportando">
                            <legend class="form-label fw-bold small text-uppercase text-body-secondary mb-2 fs-6">
                                1. Estado
                            </legend>
                            <div class="btn-group flex-wrap w-100" role="group" aria-label="Estado de los confirmandos">
                                <template v-for="e in ESTADOS_EXPORT" :key="e.value">
                                    <input type="radio" class="btn-check" name="exportEstado" :id="`exp-estado-${e.value}`"
                                        :value="e.value" v-model="estado">
                                    <label class="btn btn-outline-primary btn-sm" :for="`exp-estado-${e.value}`">{{ e.label }}</label>
                                </template>
                            </div>
                        </fieldset>

                        <fieldset class="mb-4" :disabled="exportando">
                            <legend class="form-label fw-bold small text-uppercase text-body-secondary mb-2 fs-6">
                                2. Columnas
                            </legend>
                            <div class="d-flex gap-2 mb-3">
                                <button type="button" class="btn btn-sm btn-outline-secondary" @click="seleccionarTodas">
                                    Seleccionar todas
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-secondary" @click="seleccionarNinguna">
                                    Quitar todas
                                </button>
                                <span class="ms-auto small text-body-secondary align-self-center" aria-live="polite">
                                    {{ columnasSel.length }} de {{ COLUMNAS.length }}
                                </span>
                            </div>
                            <div class="row g-3">
                                <div v-for="g in columnasPorGrupo" :key="g.id" class="col-12 col-sm-6">
                                    <div class="border rounded-3 p-3 h-100">
                                        <div class="fw-semibold small mb-2">{{ g.label }}</div>
                                        <div v-for="c in g.columnas" :key="c.key" class="form-check">
                                            <input class="form-check-input" type="checkbox" :id="`exp-col-${c.key}`"
                                                :value="c.key" v-model="columnasSel">
                                            <label class="form-check-label small" :for="`exp-col-${c.key}`">{{ c.label }}</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <p v-if="sinColumnas" class="text-danger small mt-2 mb-0" role="alert">
                                Selecciona al menos una columna.
                            </p>
                        </fieldset>

                        <fieldset :disabled="exportando">
                            <legend class="form-label fw-bold small text-uppercase text-body-secondary mb-2 fs-6">
                                3. Formato
                            </legend>
                            <div class="btn-group w-100" role="group" aria-label="Formato del archivo">
                                <input type="radio" class="btn-check" name="exportFormato" id="exp-formato-xlsx"
                                    value="xlsx" v-model="formato">
                                <label class="btn btn-outline-success btn-sm" for="exp-formato-xlsx">Excel (.xlsx)</label>
                                <input type="radio" class="btn-check" name="exportFormato" id="exp-formato-pdf"
                                    value="pdf" v-model="formato">
                                <label class="btn btn-outline-danger btn-sm" for="exp-formato-pdf">PDF</label>
                            </div>
                            <p v-if="formato === 'pdf'" class="small text-body-secondary mt-2 mb-0">
                                La hoja será vertical si las columnas caben; si no, horizontal.
                            </p>
                        </fieldset>
                    </div>

                    <footer class="modal-footer border-top-0 px-4 pb-4">
                        <button type="button" class="btn btn-light text-secondary fw-medium" data-bs-dismiss="modal"
                            :disabled="exportando">Cancelar</button>
                        <button type="submit" class="btn btn-primary px-4 d-flex align-items-center"
                            :disabled="exportando || sinColumnas">
                            <span v-if="exportando" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                            <Download v-else :size="18" class="me-2" aria-hidden="true" />
                            {{ exportando ? 'Exportando…' : 'Exportar' }}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    </div>
</template>
