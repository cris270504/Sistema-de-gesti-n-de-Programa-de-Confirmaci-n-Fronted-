<script setup>
import AppSkeleton from '@/components/AppSkeleton.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import AppButton from '@/components/AppButton.vue'
import { useConfirmandosStore } from '../../stores/confirmandos';
import { useGruposStore } from '../../stores/grupos';
import { storeToRefs } from 'pinia';
import { onMounted, onUnmounted, ref, computed, nextTick, watch, defineAsyncComponent } from 'vue';
import {
    Pencil, Trash, Plus, User, Phone, Calendar, Users,
    Wand2, Trash2, Save, Upload, Eye, Search, X, ArrowRight, Info,
    UserX, UserCheck, Download,
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

const ExportConfirmandosModal = defineAsyncComponent(() =>
    import('../../components/Modals/ExportConfirmandosModal.vue')
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

// Exportar: mismo patrón que el perfil (modal async → acción pendiente hasta que monte).
const exportModalRef = ref(null);
const isExportModalLoading = ref(false);
const hasPendingExportAction = ref(false);

const abrirExportar = () => {
    const contexto = { filtros: { ...filtros.value }, grupos: gruposDisponibles.value };
    if (exportModalRef.value) {
        exportModalRef.value.abrir(contexto);
        return;
    }
    isExportModalLoading.value = true;
    hasPendingExportAction.value = true;
};

watch(exportModalRef, (instance) => {
    if (instance && hasPendingExportAction.value) {
        instance.abrir({ filtros: { ...filtros.value }, grupos: gruposDisponibles.value });
        hasPendingExportAction.value = false;
        isExportModalLoading.value = false;
    }
});

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
const hayFiltros = computed(() => Boolean(filtros.search) || filtros.grupo !== 'todos' || filtros.procedencia !== 'todos' || filtros.estado !== 'todos');

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

            <AppButton
              v-if="authStore.can('ver todos los confirmandos')"
              variant="secondary"
              :icon="Download"
              :loading="isExportModalLoading"
              @click="abrirExportar">Exportar</AppButton>

            <AppButton
              v-if="authStore.can('crear confirmandos')"
              variant="secondary"
              :icon="Upload"
              :loading="isImporting"
              @click="abrirImportModal">{{ isImporting ? 'Importando…' : 'Importar' }}</AppButton>

            <AppButton v-if="authStore.can('crear grupos')" variant="secondary" :icon="Wand2" @click="abrirGenerador">Generar grupos</AppButton>

            <AppButton
              v-if="authStore.can('crear confirmandos')"
              :icon="Plus"
              :loading="isConfirmandoModalLoading"
              @click="abrirCrear">Nuevo confirmando</AppButton>
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
                        <AppButton
                          v-if="filtros.search"
                          variant="secondary"
                          icon-only
                          :icon="X"
                          @click="filtros.search = ''"
                          aria-label="Limpiar búsqueda"></AppButton>
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
                            <th class="ps-4 py-2 text-secondary fw-bold">#</th>
                            <th class="ps-4 py-2 text-secondary fw-bold">Confirmando</th>
                            <th class="ps-4 py-2 text-secondary fw-bold">Genero</th>
                            <th class="py-2 text-secondary fw-bold">Contacto</th>
                            <th class="py-2 text-center text-secondary fw-bold">Estado</th>
                            <th class="py-2 text-secondary fw-bold">Grupo</th>
                            <th class="py-2 text-secondary fw-bold">Sacramento</th>
                            <th class="text-end pe-4 py-2 text-secondary fw-bold">Acciones</th>
                        </tr>
                    </thead>
                    <TableSkeleton v-if="loading" :columns="8" />
                    <tbody v-else>
                        <tr v-if="!pagina.items || pagina.items.length === 0">
                            <td colspan="8">
                                <AppEmpty :icon="Users"
                                    :message="hayFiltros ? 'No hay confirmandos que coincidan con tus filtros.' : 'Aún no hay confirmandos registrados.'">
                                    <AppButton v-if="hayFiltros" variant="secondary" size="sm" @click="limpiarFiltros">Limpiar todos los filtros</AppButton>
                                    <AppButton v-else-if="authStore.can('crear confirmandos')" :icon="Plus" @click="abrirCrear">Nuevo confirmando</AppButton>
                                </AppEmpty>
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
                                    :style="{ borderColor: c.grupo.color, color: 'var(--text)', cursor: 'default' }">
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
                                    <AppButton
                                      variant="soft"
                                      tone="suggest"
                                      icon-only
                                      :loading="isPerfilModalLoading"
                                      @click="abrirPerfil(c.id)"
                                      title="Ver Ficha Completa"
                                      aria-label="Ver ficha completa"><Eye :size="16" /></AppButton>
                                    <AppButton
                                      variant="soft"
                                      tone="info"
                                      icon-only
                                      title="Ver Apoderados"
                                      aria-label="Ver apoderados"
                                      @click="openApoderadosModal(c)"><Users :size="18" /></AppButton>
                                    <AppButton
                                      v-if="authStore.can('editar confirmandos')"
                                      variant="soft"
                                      icon-only
                                      :loading="isConfirmandoModalLoading"
                                      title="Editar"
                                      aria-label="Editar confirmando"
                                      @click="abrirEditar(c.id)"><Pencil :size="18" /></AppButton>
                                    <AppButton
                                      v-if="authStore.can('editar confirmandos') && c.estado !== 'retirado'"
                                      variant="soft"
                                      tone="warning"
                                      icon-only
                                      title="Retirar del programa"
                                      aria-label="Retirar del programa"
                                      :disabled="borrandoId === c.id"
                                      @click="accionEstado('retirar', c)"><UserX :size="18" /></AppButton>
                                    <AppButton
                                      v-if="authStore.can('editar confirmandos') && c.estado === 'retirado'"
                                      variant="soft"
                                      tone="success"
                                      icon-only
                                      title="Reingresar al programa"
                                      aria-label="Reingresar al programa"
                                      :disabled="borrandoId === c.id"
                                      @click="accionEstado('reingresar', c)"><UserCheck :size="18" /></AppButton>
                                    <AppButton
                                      v-if="authStore.can('eliminar confirmandos')"
                                      variant="soft"
                                      tone="danger"
                                      icon-only
                                      title="Eliminar"
                                      aria-label="Eliminar confirmando"
                                      :disabled="borrandoId === c.id"
                                      @click="removeConfirmando(c.id, c.apellidos + ' ' + c.nombres)"><Trash :size="18" /></AppButton>
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
                <div class="modal-content">
                    <header class="modal-header">
                      <span class="modal-header__icon" aria-hidden="true"><Users :size="18" /></span>
                      <div class="modal-header__text">
                        <h5 id="apoderadosModalLabel" class="modal-title">Apoderados</h5>
                        <p class="modal-subtitle">Familiares de {{ selectedConfirmandoName }}</p>
                      </div>
                      <button type="button" class="btn-close" aria-label="Cerrar" data-bs-dismiss="modal"></button>
                    </header>
                    <div class="modal-body p-4 bg-light-gray-body">
                        <div v-if="loadingApoderados" role="status" aria-live="polite" aria-label="Cargando apoderados">
                            <AppSkeleton skeleton="lines" />
                        </div>
                        <AppEmpty v-else-if="selectedApoderados.length === 0" compact :icon="Users"
                            message="Este confirmando aún no tiene apoderados registrados." />
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
                    <footer class="modal-footer">
                        <AppButton variant="ghost" type="button" data-bs-dismiss="modal">Cerrar</AppButton>
                    </footer>
                </div>
            </div>
        </div>

        <div class="modal fade" id="generadorGruposModal" tabindex="-1" role="dialog" aria-modal="true"
            aria-labelledby="generadorGruposModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <header class="modal-header">
                      <span class="modal-header__icon" aria-hidden="true"><Wand2 :size="18" /></span>
                      <div class="modal-header__text">
                        <h5 id="generadorGruposModalLabel" class="modal-title">Generador automático de grupos</h5>
                        <p class="modal-subtitle">Reparte los confirmandos sin grupo de forma pareja.</p>
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

                        <label class="form-label fw-bold small text-secondary mb-2">Criterio del
                            reparto</label>
                        <div class="btn-group w-100 mb-3" role="group" aria-label="Criterio del reparto">
                            <template v-for="[val, label] in ESTRATEGIAS" :key="val">
                                <input type="radio" class="btn-check" :id="`estrat-${val}`" name="estrategiaGrupos"
                                    :value="val" v-model="estrategiaGrupos" :disabled="loadingGenerador">
                                <label class="btn btn-outline-primary btn-sm" :for="`estrat-${val}`">{{ label }}</label>
                            </template>
                        </div>

                        <label id="gruposNombresLabel"
                            class="form-label fw-bold small text-secondary mb-2">Nombres de los
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
                                <AppButton
                                  variant="soft-danger"
                                  icon-only
                                  :icon="Trash2"
                                  @click="removeGroupInput(index)"
                                  :disabled="groupNames.length === 1"
                                  title="Eliminar"
                                  :aria-label="`Eliminar grupo ${index + 1}`"></AppButton>
                            </div>
                        </div>

                        <AppButton variant="secondary" size="sm" block :icon="Plus" class="mb-3" @click="addGroupInput">Agregar otro grupo</AppButton>

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

                    <footer class="modal-footer">
                        <AppButton variant="secondary" type="button" data-bs-dismiss="modal">Cancelar</AppButton>
                        <AppButton :icon="Save" :loading="loadingGenerador" @click="generarGruposApi">Generar y Asignar</AppButton>
                    </footer>
                </div>
            </div>
        </div>

        <ConfirmandoModal ref="modalRef" @saved="recargarTabla" />

        <div class="modal fade" id="importFormatModal" tabindex="-1" role="dialog" aria-modal="true"
            aria-labelledby="importFormatModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <header class="modal-header">
                      <span class="modal-header__icon" aria-hidden="true"><Upload :size="18" /></span>
                      <div class="modal-header__text">
                        <h5 id="importFormatModalLabel" class="modal-title">Importar confirmandos</h5>
                        <p class="modal-subtitle">Revisa el formato antes de subir tu Excel</p>
                      </div>
                      <button type="button" class="btn-close" aria-label="Cerrar" data-bs-dismiss="modal"></button>
                    </header>

                    <div class="modal-body px-4 py-4">
                        <div class="alert alert-info border-0 bg-light-info small mb-4">
                            <Info class="h-5 w-5 me-2 text-info d-inline-block align-text-bottom" aria-hidden="true" />
                            <strong>Regla importante:</strong> El sistema asume que las dos primeras palabras son los
                            apellidos.
                        </div>

                        <h6 class="fw-bold text-secondary mb-3" style="font-size: var(--fs-sm);">Estructura Obligatoria (Fila 1 =
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

                    <footer class="modal-footer">
                        <AppButton variant="secondary" type="button" data-bs-dismiss="modal">Cancelar</AppButton>
                        <AppButton :icon="Upload" @click="triggerImport">Seleccionar Archivo y Subir</AppButton>
                    </footer>
                </div>
            </div>
        </div>

        <PerfilConfirmandoModal ref="perfilModalRef" />
        <ExportConfirmandosModal ref="exportModalRef" />
    </AppPage>
</template>

<style scoped>
/* ESTILOS GLOBALES */
.page-title {
    font-size: var(--fs-xl);
    font-weight: 700;
    color: #111827;
    margin-bottom: 0;
    letter-spacing: -0.5px;
}

.page-subtitle {
    font-size: var(--fs-ui);
    color: #6b7280;
}

.icon-box {
    width: 36px;
    height: 36px;
    background-color: var(--surface-sunken);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line);
}

.bg-light-gray {
    background-color: var(--surface-sunken);
    border-bottom: 1px solid var(--line);
}

.bg-light-gray th {
    font-size: var(--fs-xs);
    letter-spacing: 0.5px;
}

.hover-row:hover td {
    background-color: var(--surface-sunken);
}

.hover-row td {
    border-bottom: 1px solid var(--line);
    color: #374151;
    font-size: var(--fs-base);
}

/* BADGES */
.badge-soft-group {
    background-color: var(--surface);
    border: 1px solid;
    padding: 0.25em 0.65em;
    font-size: var(--fs-sm);
    font-weight: 600;
    border-radius: var(--radius-sm);
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
    background-color: var(--accent-soft);
    color: var(--accent);
    border: 1px solid #bfdbfe;
    padding: 0.25em 0.65em;
    font-size: var(--fs-sm);
    font-weight: 600;
    border-radius: var(--radius-sm);
}

/* MODALS — la cabecera usa el estilo global unificado (src/assets/main.css) */
.bg-light-gray-body {
    background-color: var(--surface-sunken);
}

.bg-blue-subtle {
    background-color: var(--accent-soft);
}

.border-blue-200 {
    border-color: var(--accent-ring) !important;
}

.dashed-border {
    border-style: dashed !important;
}

/* ===== MODO OSCURO ===== */
:root[data-bs-theme="dark"] .page-subtitle { color: var(--text-muted); }
:root[data-bs-theme="dark"] .icon-box {
    background-color: var(--line);
    border-color: var(--line-strong);
}
:root[data-bs-theme="dark"] .bg-light-gray {
    background-color: var(--surface-sunken);
    border-bottom-color: var(--line);
}
:root[data-bs-theme="dark"] .hover-row:hover td { background-color: var(--line); }
:root[data-bs-theme="dark"] .hover-row td {
    border-bottom-color: var(--line);
    color: var(--text);
}
:root[data-bs-theme="dark"] .badge-soft-group { background-color: var(--surface); }
</style>