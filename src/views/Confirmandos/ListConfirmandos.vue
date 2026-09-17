<script setup>
import { useConfirmandosStore } from '../../stores/confirmandos';
import { useGruposStore } from '../../stores/grupos';
import { storeToRefs } from 'pinia';
import { onMounted, onUnmounted, ref, nextTick, watch, defineAsyncComponent } from 'vue';
import {
    Pencil, Trash, Plus, User, Phone, Calendar, Users,
    Wand2, Trash2, Save, Upload, Eye, Search, X, ArrowRight, Info,
    UserX, UserCheck,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useParroquiaStore } from '@/stores/parroquia';
import { Modal } from 'bootstrap';
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn';
import { useImportExcel } from '@/composables/useImportExcel';
import { useGeneradorGrupos, ESTRATEGIAS } from '@/composables/useGeneradorGrupos';
import { useConfirmandosFilters } from '@/composables/useConfirmandosFilters';
import TableSkeleton from '@/components/TableSkeleton.vue';
import AppPage from '@/components/AppPage.vue';

// Lazy-loading: estos modales no son visibles en el primer renderizado (Above the fold)
const ConfirmandoModal = defineAsyncComponent(() =>
    import('../../components/Modals/confirmandoModal.vue')
);
const PerfilConfirmandoModal = defineAsyncComponent(() =>
    import('../../components/Modals/PerfilConfirmandoModal.vue')
);

const perfilModalRef = ref(null);
const isPerfilModalLoading = ref(false);
const pendingPerfilId = ref(null);
const hasPendingPerfilAction = ref(false);

// El componente async puede no estar montado aún cuando el usuario hace clic;
// si aún no hay ref, encolamos la acción y la disparamos cuando el watch detecte el montaje.
watch(perfilModalRef, (instance) => {
    if (instance && hasPendingPerfilAction.value) {
        instance.abrir(pendingPerfilId.value);
        hasPendingPerfilAction.value = false;
        pendingPerfilId.value = null;
        isPerfilModalLoading.value = false;
    }
});

const abrirPerfil = (id) => {
    if (perfilModalRef.value) {
        perfilModalRef.value.abrir(id);
        return;
    }
    isPerfilModalLoading.value = true;
    pendingPerfilId.value = id;
    hasPendingPerfilAction.value = true;
};

// --- STORES ---
const confirmandosStore = useConfirmandosStore();
const gruposStore = useGruposStore();
const authStore = useAuthStore();
const parroquiaStore = useParroquiaStore();

// La tabla usa `pagina`/`fetchPaginado` (paginación server-side): confirmandos
// crece sin límite (histórico multi-año) y ya no se trae entero al montar la
// vista. `items`/`fetchAll` (lista completa) los sigue necesitando el
// generador de grupos — se cargan recién ahí, on-demand (ver
// useGeneradorGrupos.js).
const { pagina, pagination, loading, error } = storeToRefs(confirmandosStore);

const borrandoId = ref(null);
async function removeConfirmando(id, nombre) {
    if (borrandoId.value) return;
    borrandoId.value = id;
    try {
        await confirmandosStore.remove(id, nombre);
    } finally {
        borrandoId.value = null;
    }
}

async function accionEstado(accion, c) {
    if (borrandoId.value) return;
    borrandoId.value = c.id;
    const nombre = `${c.apellidos} ${c.nombres}`;
    try {
        if (accion === 'retirar') await confirmandosStore.registrarRetiro(c.id, nombre);
        else await confirmandosStore.reingresar(c.id, nombre);
        // el store refresca la página actual del listado server-side sola.
    } finally {
        borrandoId.value = null;
    }
}

// --- ESTADOS LOCALES ---
const modalRef = ref(null);
const isConfirmandoModalLoading = ref(false);
const pendingConfirmandoId = ref(undefined);
const hasPendingConfirmandoAction = ref(false);

watch(modalRef, (instance) => {
    if (instance && hasPendingConfirmandoAction.value) {
        instance.open(pendingConfirmandoId.value);
        hasPendingConfirmandoAction.value = false;
        pendingConfirmandoId.value = undefined;
        isConfirmandoModalLoading.value = false;
    }
});

// --- FILTROS + PAGINACIÓN, IMPORTACIÓN EXCEL Y GENERADOR DE GRUPOS ---
// Extraídos a composables (src/composables/): este componente ya solo
// coordina lo que le es propio (borrado, fila, modal de apoderados).
const recargarTabla = () => confirmandosStore.fetchPaginado({ force: true });

const { filtros, limpiarFiltros, totalPages, cambiarPagina, gruposDisponibles } = useConfirmandosFilters();

const {
    fileInputRef, isImporting, initImportModal, abrirImportModal, triggerImport,
    handleFileUpload, dispose: disposeImportExcel,
} = useImportExcel(recargarTabla);

const {
    generadorModalInstance, loadingGenerador, groupNames, stats, estrategiaGrupos, prediccion,
    initGeneradorModal, abrirGenerador, addGroupInput, removeGroupInput, generarGruposApi,
    dispose: disposeGenerador,
} = useGeneradorGrupos();

// --- LÓGICA DE APODERADOS ---
const apoderadosModalInstance = ref(null);
const selectedApoderados = ref([]);
const selectedConfirmandoName = ref('');
const loadingApoderados = ref(false);

// --- FUNCIONES AUXILIARES RESTAURADAS ---
const abrirCrear = () => {
    if (modalRef.value) {
        modalRef.value.open();
        return;
    }
    isConfirmandoModalLoading.value = true;
    pendingConfirmandoId.value = undefined;
    hasPendingConfirmandoAction.value = true;
};

const abrirEditar = (id) => {
    if (modalRef.value) {
        modalRef.value.open(id);
        return;
    }
    isConfirmandoModalLoading.value = true;
    pendingConfirmandoId.value = id;
    hasPendingConfirmandoAction.value = true;
};

const formatGenero = (genero) => {
    if (!genero) return '---';
    const g = genero.toLowerCase();
    if (g === 'm') return 'MASCULINO';
    if (g === 'f') return 'FEMENINO';
    return 'SIN GÉNERO ASIGNADO';
};

const getBadgeEstado = (estado) => {
    const badges = {
        'en_preparacion': { text: 'En Preparación', class: 'bg-primary-subtle text-primary border-primary-subtle' },
        'confirmado': { text: 'Confirmado', class: 'bg-success-subtle text-success border-success-subtle' },
        'retirado': { text: 'Retirado', class: 'bg-danger-subtle text-danger border-danger-subtle' }
    };
    return badges[estado] || badges['en_preparacion'];
};

const formatFecha = (fechaString) => {
    if (!fechaString) return '---';
    const [year, month, day] = fechaString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
}

const getSacramentoFaltante = (confirmando) => {
    if (!confirmando.sacramentos?.length) return 'Sin datos';
    const pendiente = confirmando.sacramentos.find(s => s.pivot.estado === 'pendiente');
    return pendiente ? pendiente.nombre : 'Completado';
};

const openApoderadosModal = async (confirmando) => {
    selectedConfirmandoName.value = `${confirmando.nombres} ${confirmando.apellidos}`;
    apoderadosModalInstance.value?.show();

    // El listado ya no trae apoderados: se piden on-demand solo al abrir este modal.
    if (Array.isArray(confirmando.apoderados)) {
        selectedApoderados.value = confirmando.apoderados;
        return;
    }

    loadingApoderados.value = true;
    selectedApoderados.value = [];
    try {
        const full = await confirmandosStore.fetchById(confirmando.id, { silent: true });
        selectedApoderados.value = full?.apoderados || [];
    } catch {
        selectedApoderados.value = [];
    } finally {
        loadingApoderados.value = false;
    }
};

// --- CICLO DE VIDA ---
let detachApoderadosFocusReturn = () => {};

onMounted(() => {
    confirmandosStore.fetchPaginado({ filters: { ...filtros.value } });

    if (authStore.can('ver todos los grupos') && gruposStore.items.length === 0) {
        gruposStore.fetchAll().catch(e => console.error(e));
    }

    // Prefetch de los modales pesados cuando el navegador está ocioso: el primer
    // clic en "Nuevo confirmando" / "Ver ficha" ya no espera la descarga del chunk.
    const prefetchModales = () => {
        import('../../components/Modals/confirmandoModal.vue').catch(() => {});
        import('../../components/Modals/PerfilConfirmandoModal.vue').catch(() => {});
    };
    if ('requestIdleCallback' in window) {
        requestIdleCallback(prefetchModales, { timeout: 3000 });
    } else {
        setTimeout(prefetchModales, 1500);
    }

    nextTick(() => {
        const elApo = document.getElementById('apoderadosModal');
        if (elApo) {
            apoderadosModalInstance.value = new Modal(elApo);
            detachApoderadosFocusReturn = attachModalFocusReturn(elApo);
        }
        initGeneradorModal();
        initImportModal();
    });
});

onUnmounted(() => {
    detachApoderadosFocusReturn();
    apoderadosModalInstance.value?.dispose();
    disposeGenerador();
    disposeImportExcel();
});
</script>

<template>
    <AppPage :title="parroquiaStore.personaLabelPlural" subtitle="Inscritos y ruta sacramental">
        <template #actions>
            <input type="file" ref="fileInputRef" class="d-none" accept=".xlsx, .xls, .csv"
                aria-label="Seleccionar archivo Excel o CSV para importar" @change="handleFileUpload">

            <button v-if="authStore.can('crear confirmandos')" @click="abrirImportModal" :disabled="isImporting"
                class="btn-outline">
                <span v-if="isImporting" class="spinner-border spinner-border-sm me-2"></span>
                <Upload v-else :size="16" class="mr-1.5" />
                <span class="text-sm">{{ isImporting ? 'Importando…' : 'Importar' }}</span>
            </button>

            <button v-if="authStore.can('crear grupos')" @click="abrirGenerador" class="btn-outline">
                <Wand2 :size="16" class="mr-1.5" /> <span class="text-sm">Generar grupos</span>
            </button>

            <button v-if="authStore.can('crear confirmandos')" @click="abrirCrear" :disabled="isConfirmandoModalLoading"
                class="btn-primary">
                <span v-if="isConfirmandoModalLoading" class="spinner-border spinner-border-sm me-2"></span>
                <Plus v-else :size="18" class="mr-1.5" />
                <span class="text-sm">Nuevo confirmando</span>
            </button>
        </template>

        <!-- El contenedor principal (Los filtros NUNCA desaparecen) -->
        <section class="card border-0 shadow-sm rounded-3 overflow-hidden" aria-label="Listado de confirmandos">

            <div role="search" aria-label="Filtrar confirmandos"
                class="p-3 bg-light-gray border-bottom d-flex flex-column flex-xl-row justify-content-between align-items-center gap-3">
                <!-- Sección Izquierda: Buscador + Selector de Grupos -->
                <div class="d-flex flex-column flex-sm-row gap-2 w-100" style="max-width: 650px;">
                    <!-- Buscador -->
                    <div class="input-group shadow-sm">
                        <span class="input-group-text bg-white border-end-0 text-muted">
                            <Search class="h-4 w-4" aria-hidden="true" />
                        </span>
                        <input type="text" class="form-control border-start-0 ps-0" v-model="filtros.search"
                            placeholder="Buscar por apellido o nombre..." aria-label="Buscar confirmando por nombre o apellido"
                            :disabled="loading">
                        <button v-if="filtros.search" @click="filtros.search = ''"
                            aria-label="Limpiar búsqueda"
                            class="btn btn-white border border-start-0 text-muted">
                            <X class="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>

                    <!-- Selector de Procedencia (Reducido) -->
                    <select v-if="parroquiaStore.usaProcedencia" v-model="filtros.procedencia" class="form-select shadow-sm"
                        style="width: 130px; flex-shrink: 0;" aria-label="Filtrar por procedencia" :disabled="loading">
                        <option value="todos">Todos</option>
                        <option value="sede">Sede</option>
                        <option value="caserio">Caserío</option>
                    </select>

                    <!-- Selector de Grupos -->
                    <select class="form-select shadow-sm" style="min-width: 180px;" v-model="filtros.grupo"
                        aria-label="Filtrar por grupo" :disabled="loading">
                        <option value="todos">Todos los grupos</option>
                        <option value="sin_grupo" class="text-danger fw-bold">Sin grupo asignado</option>
                        <hr class="dropdown-divider">
                        <option v-for="g in gruposDisponibles" :key="g.id" :value="g.id">
                            {{ g.nombre }}
                        </option>
                    </select>
                </div>

                <!-- Sección Derecha: Filtros de Estado (Botones compactos) -->
                <div class="btn-group shadow-sm w-100 w-xl-auto" role="group" aria-label="Filtrar por estado"
                    style="overflow-x: auto; white-space: nowrap;">
                    <input type="radio" class="btn-check" name="btnradio" id="btnradio1" value="en_preparacion"
                        v-model="filtros.estado" :disabled="loading">
                    <label class="btn btn-outline-primary btn-sm fw-medium px-2 py-1" for="btnradio1">En
                        Preparación</label>

                    <input type="radio" class="btn-check" name="btnradio" id="btnradio2" value="confirmado"
                        v-model="filtros.estado" :disabled="loading">
                    <label class="btn btn-outline-success btn-sm fw-medium px-2 py-1"
                        for="btnradio2">Confirmados</label>

                    <input type="radio" class="btn-check" name="btnradio" id="btnradio3" value="retirado"
                        v-model="filtros.estado" :disabled="loading">
                    <label class="btn btn-outline-danger btn-sm fw-medium px-2 py-1" for="btnradio3">Retirados</label>

                    <input type="radio" class="btn-check" name="btnradio" id="btnradio4" value="todos"
                        v-model="filtros.estado" :disabled="loading">
                    <label class="btn btn-outline-secondary btn-sm fw-medium px-2 py-1" for="btnradio4">Todos</label>
                </div>
            </div>

            <!-- Gestión de Errores Visuales -->
            <div v-if="error" class="alert alert-danger m-3" role="alert">{{ error }}</div>

            <!-- Contenedor de la Tabla (tarjetas en celular) -->
            <div class="table-responsive cards-sm cards-sm--hide-first">

                <!-- El <thead> queda visible durante la carga (skeleton en el <tbody>) para que
                     el usuario ubique la estructura de la tabla de inmediato, en vez de un
                     spinner centrado que hace desaparecer toda la tabla. -->
                <table class="table align-middle mb-0">
                    <thead class="bg-light-gray">
                        <tr>
                            <th class="ps-4 py-2 text-secondary text-uppercase fw-bold">#</th>
                            <th class="ps-4 py-2 text-secondary text-uppercase fw-bold">Confirmando</th>
                            <th class="ps-4 py-2 text-secondary text-uppercase fw-bold">Genero</th>
                            <th class="py-2 text-secondary text-uppercase fw-bold">Contacto</th>
                            <th class="py-2 text-center text-secondary text-uppercase fw-bold">Estado</th>
                            <th class="py-2 text-secondary text-uppercase fw-bold">Grupo</th>
                            <th class="py-2 text-secondary text-uppercase fw-bold">Sacramento</th>
                            <th class="text-end pe-4 py-2 text-secondary text-uppercase fw-bold">Acciones</th>
                        </tr>
                    </thead>
                    <TableSkeleton v-if="loading" :columns="8" />
                    <tbody v-else>
                        <tr v-if="!pagina.items || pagina.items.length === 0">
                            <td colspan="8" class="text-center py-5">
                                <div class="d-flex flex-column align-items-center justify-content-center">
                                    <Users :size="48" class="text-muted opacity-25 mb-3" />
                                    <h5 class="text-secondary fw-bold">No se encontraron confirmandos</h5>
                                    <p class="text-muted small">
                                        {{
                                            filtros.search || filtros.grupo !== 'todos' || filtros.procedencia !== 'todos'
                                                || filtros.estado !== 'todos'
                                                ? 'No hay resultados que coincidan con tus filtros actuales.'
                                                : 'Aún no hay confirmandos registrados en el sistema.'
                                        }}
                                    </p>
                                    <button
                                        v-if="filtros.search || filtros.grupo !== 'todos' || filtros.procedencia !== 'todos' || filtros.estado !== 'todos'"
                                        @click="limpiarFiltros" class="btn btn-sm btn-outline-secondary mt-2 shadow-sm">
                                        Limpiar todos los filtros
                                    </button>
                                </div>
                            </td>
                        </tr>

                        <tr v-for="(c, index) in pagina.items" :key="c.id" class="hover-row">
                            <td class="py-2 text-center text-muted fw-medium">
                                {{ (pagination.page - 1) * pagination.pageSize + index + 1 }}
                            </td>
                            <td class="py-2">
                                <div class="d-flex align-items-center">
                                    <div>
                                        <div class="fw-bold text-dark fs-6 lh-sm">{{ c.apellidos }}, {{ c.nombres }}
                                        </div>
                                        <div class="text-muted mt-1 small d-flex align-items-center">
                                            <Calendar :size="12" class="me-1" /> {{ formatFecha(c.fecha_nacimiento) }}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td class="py-2">
                                <div class="d-flex align-items-center text-secondary small-text">
                                    <span>{{ formatGenero(c.genero) }}</span>
                                </div>
                            </td>
                            <td class="py-2">
                                <div class="d-flex align-items-center text-secondary small-text">
                                    <Phone :size="14" class="me-2 opacity-75" />
                                    <span>{{ c.celular || '---' }}</span>
                                </div>
                            </td>
                            <td class="py-2 text-center">
                                <span class="badge border" :class="getBadgeEstado(c.estado).class">
                                    {{ getBadgeEstado(c.estado).text }}
                                </span>
                                <div v-if="c.estado === 'retirado' && c.fecha_retiro" class="small text-muted mt-1">
                                    {{ formatFecha(c.fecha_retiro) }}
                                    <span v-if="c.motivo_retiro" :title="c.motivo_retiro">· {{ c.motivo_retiro.length > 24 ? c.motivo_retiro.slice(0, 24) + '…' : c.motivo_retiro }}</span>
                                </div>
                            </td>
                            <td class="py-2">
                                <router-link v-if="c.grupo && authStore.can('ver todos los grupos')"
                                    :to="{ name: 'miGrupo', params: { id: c.grupo.id } }"
                                    class="badge-soft-group btn-badge-interactive text-decoration-none"
                                    :style="{ borderColor: c.grupo.color }">
                                    <span class="dot-indicator"
                                        :style="{ backgroundColor: c.grupo.color || '#cbd5e1' }"></span>
                                    <span class="text-dark-subtle me-1">{{ c.grupo.nombre }} - {{ c.grupo.procedencia
                                        }}</span>
                                    <ArrowRight class="text-muted" :size="16" aria-hidden="true" />
                                </router-link>

                                <span v-else-if="c.grupo" class="badge-soft-group"
                                    :style="{ borderColor: c.grupo.color, color: '#334155', cursor: 'default' }">
                                    <span class="dot-indicator"
                                        :style="{ backgroundColor: c.grupo.color || '#cbd5e1' }"></span>
                                    {{ c.grupo.nombre }}
                                </span>
                                <span v-else class="text-muted fst-italic small px-2">Sin grupo</span>
                            </td>
                            <td class="py-2">
                                <span class="badge-soft-blue">{{ getSacramentoFaltante(c) }}</span>
                            </td>
                            <td class="text-end pe-4 py-2">
                                <div class="d-inline-flex gap-2">
                                    <button @click="abrirPerfil(c.id)" :disabled="isPerfilModalLoading"
                                        class="btn-action btn-soft-suggest" title="Ver Ficha Completa"
                                        aria-label="Ver ficha completa">
                                        <span v-if="isPerfilModalLoading" class="spinner-border spinner-border-sm"></span>
                                        <Eye v-else :size="16" />
                                    </button>
                                    <button class="btn-action btn-soft-info" title="Ver Apoderados"
                                        aria-label="Ver apoderados" @click="openApoderadosModal(c)">
                                        <Users :size="18" />
                                    </button>
                                    <button v-if="authStore.can('editar confirmandos')"
                                        class="btn-action btn-soft-primary" title="Editar"
                                        aria-label="Editar confirmando" :disabled="isConfirmandoModalLoading"
                                        @click="abrirEditar(c.id)">
                                        <span v-if="isConfirmandoModalLoading" class="spinner-border spinner-border-sm"></span>
                                        <Pencil v-else :size="18" />
                                    </button>
                                    <button v-if="authStore.can('editar confirmandos') && c.estado !== 'retirado'"
                                        class="btn-action btn-soft-warning" title="Retirar del programa"
                                        aria-label="Retirar del programa" :disabled="borrandoId === c.id"
                                        @click="accionEstado('retirar', c)">
                                        <UserX :size="18" />
                                    </button>
                                    <button v-if="authStore.can('editar confirmandos') && c.estado === 'retirado'"
                                        class="btn-action btn-soft-success" title="Reingresar al programa"
                                        aria-label="Reingresar al programa" :disabled="borrandoId === c.id"
                                        @click="accionEstado('reingresar', c)">
                                        <UserCheck :size="18" />
                                    </button>
                                    <button v-if="authStore.can('eliminar confirmandos')"
                                        class="btn-action btn-soft-danger" title="Eliminar"
                                        aria-label="Eliminar confirmando" :disabled="borrandoId === c.id"
                                        @click="removeConfirmando(c.id, c.apellidos + ' ' + c.nombres)">
                                        <Trash :size="18" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <nav v-if="totalPages > 1 && !loading" aria-label="Paginación de confirmandos"
                    class="d-flex justify-content-between align-items-center p-3 bg-white border-top">
                    <div class="text-muted small">
                        Mostrando página <span class="fw-bold">{{ pagination.page }}</span> de <span class="fw-bold">{{
                            totalPages }}</span> (Total: {{ pagina.total }}
                        resultados)
                    </div>
                    <ul class="pagination pagination-sm mb-0">
                        <li class="page-item" :class="{ disabled: pagination.page === 1 }">
                            <button class="page-link" aria-label="Página anterior"
                                :disabled="pagination.page === 1" @click="cambiarPagina(pagination.page - 1)">Anterior</button>
                        </li>

                        <li v-for="page in totalPages" :key="page" class="page-item"
                            :class="{ active: page === pagination.page }">
                            <button class="page-link" :aria-current="page === pagination.page ? 'page' : undefined"
                                :aria-label="`Ir a la página ${page}`" @click="cambiarPagina(page)">{{ page }}</button>
                        </li>

                        <li class="page-item" :class="{ disabled: pagination.page === totalPages }">
                            <button class="page-link" aria-label="Página siguiente"
                                :disabled="pagination.page === totalPages" @click="cambiarPagina(pagination.page + 1)">Siguiente</button>
                        </li>
                    </ul>
                </nav>
            </div>
        </section>

        <div class="modal fade" id="apoderadosModal" tabindex="-1" role="dialog" aria-modal="true"
            aria-labelledby="apoderadosModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                    <header class="modal-header p-4">
                        <div>
                            <h5 id="apoderadosModalLabel" class="modal-title fw-bold mb-0">
                                <Users class="h-5 w-5 me-2 d-inline-block align-text-bottom" aria-hidden="true" /> Apoderados
                            </h5>
                            <p class="text-white-50 small mb-0 mt-1">Familiares de {{ selectedConfirmandoName }}</p>
                        </div>
                        <button type="button" class="btn-close" aria-label="Cerrar" data-bs-dismiss="modal"></button>
                    </header>
                    <div class="modal-body p-4 bg-light-gray-body">
                        <div v-if="loadingApoderados" class="text-center text-muted py-4" role="status" aria-live="polite">
                            <span class="spinner-border spinner-border-sm me-2"></span>
                            <span class="small">Cargando apoderados…</span>
                        </div>
                        <div v-else-if="selectedApoderados.length === 0" class="text-center text-muted py-4">
                            <div class="mb-2">
                                <Users :size="48" class="opacity-25" />
                            </div>
                            <p class="mb-0 small">No hay apoderados registrados.</p>
                        </div>
                        <div v-else class="d-flex flex-column gap-3">
                            <div v-for="ap in selectedApoderados" :key="ap.id" class="card border-0 shadow-sm">
                                <div class="card-body p-3 d-flex justify-content-between align-items-center">
                                    <div>
                                        <div class="fw-bold text-dark">{{ ap.apellidos }} {{ ap.nombres }}</div>
                                        <div class="small text-muted d-flex align-items-center mt-1">
                                            <Phone :size="12" class="me-1" /> {{ ap.celular || 'Sin celular' }}
                                        </div>
                                    </div>
                                    <span class="badge bg-blue-subtle text-primary border border-blue-200">
                                        {{ ap.pivot?.tipo_apoderado_id === 1 ? 'Padre' : (ap.pivot?.tipo_apoderado_id
                                        === 2 ? 'Madre' : 'Tutor') }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <footer class="modal-footer bg-white border-top-0 p-3">
                        <button type="button" class="btn btn-light w-100 fw-medium text-secondary"
                            data-bs-dismiss="modal">Cerrar</button>
                    </footer>
                </div>
            </div>
        </div>

        <div class="modal fade" id="generadorGruposModal" tabindex="-1" role="dialog" aria-modal="true"
            aria-labelledby="generadorGruposModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg rounded-4">
                    <header class="modal-header bg-white border-bottom-0 pt-4 px-4">
                        <div>
                            <h5 id="generadorGruposModalLabel" class="fw-bold text-dark mb-1">Generador Automático de
                                Grupos</h5>
                            <p class="text-muted small mb-0">Reparte los confirmandos sin grupo de forma pareja.</p>
                        </div>
                        <button type="button" class="btn-close" aria-label="Cerrar" data-bs-dismiss="modal"></button>
                    </header>

                    <div class="modal-body px-4 py-2">
                        <div class="alert alert-light border d-flex justify-content-around mb-4 bg-light-gray-body">
                            <div class="text-center">
                                <h4 class="fw-bold text-primary mb-0">{{ stats.total }}</h4>
                                <small class="text-muted" style="font-size: 0.75rem;">Sin Grupo</small>
                            </div>
                            <div class="vr opacity-25"></div>
                            <div class="text-center">
                                <h5 class="fw-bold text-dark mb-0">{{ stats.hombres }}</h5>
                                <small class="text-muted" style="font-size: 0.75rem;">Hombres</small>
                            </div>
                            <div class="text-center">
                                <h5 class="fw-bold text-dark mb-0">{{ stats.mujeres }}</h5>
                                <small class="text-muted" style="font-size: 0.75rem;">Mujeres</small>
                            </div>
                        </div>

                        <label class="form-label fw-bold small text-uppercase text-secondary mb-2">Criterio del
                            reparto</label>
                        <div class="btn-group w-100 mb-3" role="group" aria-label="Criterio del reparto">
                            <template v-for="[val, label] in ESTRATEGIAS" :key="val">
                                <input type="radio" class="btn-check" :id="`estrat-${val}`" name="estrategiaGrupos"
                                    :value="val" v-model="estrategiaGrupos" :disabled="loadingGenerador">
                                <label class="btn btn-outline-primary btn-sm" :for="`estrat-${val}`">{{ label }}</label>
                            </template>
                        </div>

                        <label id="gruposNombresLabel"
                            class="form-label fw-bold small text-uppercase text-secondary mb-2">Nombres de los
                            Grupos</label>
                        <div class="d-flex flex-column gap-2 mb-3" role="group" aria-labelledby="gruposNombresLabel"
                            style="max-height: 200px; overflow-y: auto;">
                            <div v-for="(name, index) in groupNames" :key="index" class="d-flex gap-2">
                                <div class="input-group">
                                    <span class="input-group-text bg-white text-muted border-end-0">{{ index + 1
                                        }}</span>
                                    <input type="text" class="form-control border-start-0" v-model="groupNames[index]"
                                        :aria-label="`Nombre del grupo ${index + 1}`" placeholder="Nombre del grupo">
                                </div>
                                <button @click="removeGroupInput(index)" class="btn btn-outline-danger border-0"
                                    :disabled="groupNames.length === 1" title="Eliminar"
                                    :aria-label="`Eliminar grupo ${index + 1}`">
                                    <Trash2 :size="18" />
                                </button>
                            </div>
                        </div>

                        <button @click="addGroupInput"
                            class="btn btn-sm btn-light text-primary border w-100 mb-3 dashed-border">
                            <Plus :size="16" class="me-1" /> Agregar otro grupo
                        </button>

                        <div v-if="prediccion" class="bg-blue-subtle p-3 rounded-3 mb-2">
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <Users :size="16" class="text-primary" />
                                <span class="fw-bold text-primary small">Predicción por Grupo:</span>
                            </div>
                            <p class="mb-0 small text-dark lh-sm">
                                ~{{ prediccion.total }} confirmandos por grupo
                                <span v-if="estrategiaGrupos === 'genero'" class="text-muted">({{ prediccion.hombres }}H /
                                    {{ prediccion.mujeres }}M)</span>.
                            </p>
                        </div>
                    </div>

                    <footer class="modal-footer border-top-0 px-4 pb-4">
                        <button type="button" class="btn btn-light text-secondary fw-medium"
                            data-bs-dismiss="modal">Cancelar</button>
                        <button @click="generarGruposApi" :disabled="loadingGenerador" class="btn btn-primary px-4">
                            <span v-if="loadingGenerador" class="spinner-border spinner-border-sm me-2"></span>
                            <Save v-else :size="18" class="me-2" />
                            Generar y Asignar
                        </button>
                    </footer>
                </div>
            </div>
        </div>

        <ConfirmandoModal ref="modalRef" @saved="recargarTabla" />

        <div class="modal fade" id="importFormatModal" tabindex="-1" role="dialog" aria-modal="true"
            aria-labelledby="importFormatModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg rounded-4">
                    <header class="modal-header bg-success-subtle border-bottom-0 pt-4 px-4">
                        <div class="d-flex align-items-center">
                            <div
                                class="bg-success text-white rounded-circle p-2 me-3 d-flex align-items-center justify-content-center">
                                <Upload :size="24" aria-hidden="true" />
                            </div>
                            <div>
                                <h5 id="importFormatModalLabel" class="fw-bold text-dark mb-1">Importar Confirmandos
                                </h5>
                                <p class="text-muted small mb-0">Revisa el formato antes de subir tu Excel</p>
                            </div>
                        </div>
                        <button type="button" class="btn-close" aria-label="Cerrar" data-bs-dismiss="modal"></button>
                    </header>

                    <div class="modal-body px-4 py-4">
                        <div class="alert alert-info border-0 bg-light-info small mb-4">
                            <Info class="h-5 w-5 me-2 text-info d-inline-block align-text-bottom" aria-hidden="true" />
                            <strong>Regla importante:</strong> El sistema asume que las dos primeras palabras son los
                            apellidos.
                        </div>

                        <h6 class="fw-bold text-secondary text-uppercase fs-7 mb-3">Estructura Obligatoria (Fila 1 =
                            Títulos)</h6>
                        <div class="table-responsive border rounded-3 mb-3">
                            <table class="table table-sm table-bordered mb-0 text-center align-middle">
                                <caption class="visually-hidden">Ejemplo de formato esperado del archivo a importar
                                </caption>
                                <thead class="table-light">
                                    <tr>
                                        <th class="text-success" scope="col">Columna A</th>
                                        <th class="text-success" scope="col">Columna B</th>
                                    </tr>
                                    <tr>
                                        <th scope="col">NOMBRES</th>
                                        <th scope="col">CELULAR <span class="text-muted fw-normal">(Opcional)</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td class="text-start px-3">Quispe Ramos Luis Alberto</td>
                                        <td>987654321</td>
                                    </tr>
                                    <tr>
                                        <td class="text-start px-3">Gonzales Maria Jose</td>
                                        <td class="text-muted fst-italic">En blanco</td>
                                    </tr>
                                    <tr>
                                        <td class="text-start px-3">Perez Juan</td>
                                        <td class="text-danger"><del>123</del> (Dará error)</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <ul class="text-muted small ps-3 mb-0">
                            <li class="mb-1">Si el celular no tiene <strong>9 dígitos numéricos</strong>, se ignorará y
                                se guardará sin celular.</li>
                            <li>No dejes nombres en blanco. Esas filas serán omitidas.</li>
                        </ul>
                    </div>

                    <footer class="modal-footer border-top-0 px-4 pb-4 d-flex justify-content-between">
                        <button type="button" class="btn btn-light text-secondary fw-medium"
                            data-bs-dismiss="modal">Cancelar</button>
                        <button @click="triggerImport" class="btn btn-success px-4 d-flex align-items-center">
                            <Upload :size="18" class="me-2" aria-hidden="true" />
                            Seleccionar Archivo y Subir
                        </button>
                    </footer>
                </div>
            </div>
        </div>

        <PerfilConfirmandoModal ref="perfilModalRef" />
    </AppPage>
</template>

<style scoped>
/* ESTILOS GLOBALES */
.page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 0;
    letter-spacing: -0.5px;
}

.page-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
}

.icon-box {
    width: 36px;
    height: 36px;
    background-color: #f3f4f6;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e7eb;
}

.bg-light-gray {
    background-color: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
}

.bg-light-gray th {
    font-size: 0.75rem;
    letter-spacing: 0.5px;
}

.hover-row:hover td {
    background-color: #f9fafb;
}

.hover-row td {
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    font-size: 0.95rem;
}

/* BADGES */
.badge-soft-group {
    background-color: #ffffff;
    border: 1px solid;
    padding: 0.25em 0.65em;
    font-size: 0.8rem;
    font-weight: 600;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.dot-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
}

.badge-soft-blue {
    background-color: #eff6ff;
    color: #2563eb;
    border: 1px solid #bfdbfe;
    padding: 0.25em 0.65em;
    font-size: 0.8rem;
    font-weight: 600;
    border-radius: 6px;
}

/* BOTONES — .btn-action y .btn-soft-* ahora son globales (src/assets/main.css) */
.btn-primary {
    background-color: #2563eb;
    border-color: #2563eb;
    font-size: 0.9rem;
}

.btn-primary:hover {
    background-color: #1d4ed8;
}

/* MODALS — la cabecera usa el estilo global unificado (src/assets/main.css) */
.bg-light-gray-body {
    background-color: #f8fafc;
}

.bg-blue-subtle {
    background-color: #e0e7ff;
}

.border-blue-200 {
    border-color: #c7d2fe !important;
}

.dashed-border {
    border-style: dashed !important;
}

/* ===== MODO OSCURO ===== */
:root[data-bs-theme="dark"] .page-subtitle { color: #94a3b8; }
:root[data-bs-theme="dark"] .icon-box {
    background-color: #334155;
    border-color: #475569;
}
:root[data-bs-theme="dark"] .bg-light-gray {
    background-color: #0f172a;
    border-bottom-color: #334155;
}
:root[data-bs-theme="dark"] .hover-row:hover td { background-color: #334155; }
:root[data-bs-theme="dark"] .hover-row td {
    border-bottom-color: #334155;
    color: #e2e8f0;
}
:root[data-bs-theme="dark"] .badge-soft-group { background-color: #1e293b; }
</style>