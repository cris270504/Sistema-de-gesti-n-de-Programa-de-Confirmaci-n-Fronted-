<script setup>
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { useGruposStore } from '../../stores/grupos';
import { useUsersStore } from '../../stores/users';
import { useConfirmandosStore } from '../../stores/confirmandos';
import { storeToRefs } from 'pinia';
import { Modal } from 'bootstrap';
import { showAlerta } from '@/funciones';
import { useAuthStore } from '@/stores/auth';
import {
    FileText, CheckCircle, AlertCircle, ArrowLeft,
    UserPlus, Users, Search, User, Phone, Pencil,
    ShieldCheck, Plus, Eye,
    AlertTriangle, AlertOctagon, Clock
} from 'lucide-vue-next';
import ConfirmandoModal from '../../components/Modals/confirmandoModal.vue';

const props = defineProps({
    id: { type: [Number, String], required: true }
})

const gruposStore = useGruposStore();
const usersStore = useUsersStore();
const confirmandosStore = useConfirmandosStore();
const authStore = useAuthStore();

const { items: allUsers, loading: loadingUsers } = storeToRefs(usersStore);
const { items: allConfirmandos, loading: loadingConfirmandos } = storeToRefs(confirmandosStore);
const { fetchAll: fetchAllConfirmandos } = confirmandosStore;

const grupo = ref(null);
const loadingGrupo = ref(true);

// --- COMPUTED PARA EL COLOR DEL GRUPO ---
const groupColor = computed(() => grupo.value?.color || '#2563eb');

const confirmandosActivos = computed(() => {
    return filteredConfirmandosModal.value.filter(c => c.estado === 'en_preparacion');
});

// Modales refs
const catequistasModalInstance = ref(null);
const confirmandosModalInstance = ref(null);
const docsModalInstance = ref(null);
const apoderadosInfoModalInstance = ref(null);
const modalRef = ref(null);
const abrirEditar = (id) => modalRef.value.open(id);
const recargarTabla = () => fetchAllConfirmandos();

// Estados locales
const selectedCatechistIds = ref([]);
const savingCatequistas = ref(false);
const confirmandoSearchQuery = ref('');
const selectedConfirmandoIds = ref([]);
const savingConfirmandos = ref(false);
const docDraft = ref({ confirmando_id: null, nombre: '', sacramento_faltante: '', requisitos: [] });
const savingDocs = ref(false);

// Estado para el modal de ver apoderados
const currentApoderadosView = ref({ nombreConfirmando: '', apoderados: [] });

// --- CICLO DE VIDA ---
onMounted(async () => {
    const promises = [loadGroupData(), confirmandosStore.fetchAll(true)];
    if (authStore.can('ver usuarios') || authStore.can('asignar catequista')) {
        usersStore.fetchAll(true);
    }
    await Promise.all(promises);
    initModals();
});

onUnmounted(() => {
    catequistasModalInstance.value?.dispose();
    confirmandosModalInstance.value?.dispose();
    docsModalInstance.value?.dispose();
    apoderadosInfoModalInstance.value?.dispose();
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style = '';
});

watch(() => props.id, async () => {
    await loadGroupData();
    initModals();
});

const initModals = () => {
    nextTick(() => {
        const modalElCat = document.getElementById('catequistasModal');
        if (modalElCat) catequistasModalInstance.value = new Modal(modalElCat);

        const modalElConf = document.getElementById('confirmandosModal');
        if (modalElConf) confirmandosModalInstance.value = new Modal(modalElConf);

        const modalElDocs = document.getElementById('docsModal');
        if (modalElDocs) docsModalInstance.value = new Modal(modalElDocs);

        const modalElApo = document.getElementById('apoderadosInfoModal');
        if (modalElApo) apoderadosInfoModalInstance.value = new Modal(modalElApo);
    });
};

async function loadGroupData() {
    loadingGrupo.value = true;
    try {
        const g = await gruposStore.fetchById(Number(props.id));
        if (g) {
            grupo.value = g;
            selectedCatechistIds.value = g.catequistas?.map(c => c.id) || [];
            selectedConfirmandoIds.value = g.confirmandos?.map(c => c.id) || [];
        } else {
            showAlerta('Grupo no encontrado', 'error');
        }
    } catch (e) {
        console.error("Error al cargar grupo:", e);
        showAlerta('Error al cargar datos del grupo', 'error');
    } finally {
        loadingGrupo.value = false;
    }
}

// --- LÓGICA CATEQUISTAS ---
const availableCatechists = computed(() => {
    if (!allUsers.value) return [];
    const currentGroupId = Number(props.id);

    return allUsers.value.filter(user => {
        const hasRole = user.roles?.some(role =>
            role.name === 'catequista' || role.name === 'coordinador'
        );
        if (!hasRole) return false;

        const isFree = !user.grupo_id;
        const isAlreadyInThisGroup = Number(user.grupo_id) === currentGroupId;

        return isFree || isAlreadyInThisGroup;
    });
});

const openCatechistaModal = () => {
    if (loadingUsers.value) return showAlerta('Cargando...', 'info');
    if (grupo.value) selectedCatechistIds.value = grupo.value.catequistas?.map(c => c.id) || [];
    catequistasModalInstance.value?.show();
};

const handleSaveCatequistas = async () => {
    if (savingCatequistas.value) return;
    savingCatequistas.value = true;
    try {
        await gruposStore.assignCatequists(props.id, selectedCatechistIds.value);
        await loadGroupData();
        showAlerta('Catequistas actualizados', 'success');
        catequistasModalInstance.value.hide();
    } catch (e) {
        console.error(e);
        showAlerta('Error al guardar', 'error');
    } finally {
        savingCatequistas.value = false;
    }
};

// --- LÓGICA DE ASIGNACIÓN FILTRADA (SOLO HUÉRFANOS Y PROPIOS) ---
const availableConfirmandos = computed(() => {
    if (!allConfirmandos.value) return [];
    const currentGroupId = Number(props.id);

    // Filtro estricto: confirmandos sin grupo asignado (null/0) O confirmandos que ya pertenecen a este grupo
    return allConfirmandos.value.filter(c => !c.grupo_id || Number(c.grupo_id) === currentGroupId);
});

const filteredConfirmandosModal = computed(() => {
    const query = confirmandoSearchQuery.value.trim().toLowerCase();
    if (!query) return availableConfirmandos.value;
    return availableConfirmandos.value.filter(c => `${c.nombres} ${c.apellidos}`.toLowerCase().includes(query));
});

const openConfirmandosModal = () => {
    if (loadingConfirmandos.value) return showAlerta('Cargando...', 'info');
    if (grupo.value) selectedConfirmandoIds.value = grupo.value.confirmandos?.map(c => c.id) || [];
    confirmandosModalInstance.value?.show();
};

const handleSaveConfirmandos = async () => {
    if (savingConfirmandos.value) return;
    savingConfirmandos.value = true;
    try {
        await gruposStore.assignConfirmandos(props.id, selectedConfirmandoIds.value);
        await loadGroupData();
        showAlerta('Confirmandos actualizados', 'success');
        confirmandosModalInstance.value.hide();
    } catch (e) {
        console.error(e);
        showAlerta('Error al guardar', 'error');
    } finally {
        savingConfirmandos.value = false;
    }
};

const toggleSelectAllFiltered = (event) => {
    const isChecked = event.target.checked;
    const filteredIds = filteredConfirmandosModal.value.map(c => c.id);
    if (isChecked) {
        const newIds = new Set([...selectedConfirmandoIds.value, ...filteredIds]);
        selectedConfirmandoIds.value = Array.from(newIds);
    } else {
        selectedConfirmandoIds.value = selectedConfirmandoIds.value.filter(id => !filteredIds.includes(id));
    }
};

// --- LÓGICA APODERADOS ---
const openApoderadosInfoModal = (confirmando) => {
    currentApoderadosView.value = {
        nombreConfirmando: `${confirmando.nombres} ${confirmando.apellidos}`,
        apoderados: confirmando.apoderados || []
    };
    apoderadosInfoModalInstance.value?.show();
};

// --- LÓGICA DOCUMENTOS ---
const getSacramentoFaltante = (confirmando) => {
    const lista = confirmando.sacramentos || [];
    const estaPendiente = (nombreClave) => {
        return lista.some(s =>
            s.nombre.toLowerCase().includes(nombreClave) &&
            s.pivot.estado === 'pendiente'
        );
    };

    if (estaPendiente('bautismo')) return 'Bautismo, Comunión y Confirmación';
    if (estaPendiente('comunión') || estaPendiente('comunion')) return 'Comunión y Confirmación';
    if (estaPendiente('confirmación') || estaPendiente('confirmacion')) return 'Confirmación';
    return 'Completado';
};

const openDocsModal = (confirmando) => {
    docDraft.value = {
        confirmando_id: confirmando.id,
        nombre: `${confirmando.nombres} ${confirmando.apellidos}`,
        sacramento_faltante: getSacramentoFaltante(confirmando),
        requisitos: confirmando.requisitos ? JSON.parse(JSON.stringify(confirmando.requisitos)) : []
    };
    docsModalInstance.value?.show();
};

const toggleDocState = (req) => { req.pivot.estado = req.pivot.estado === 'entregado' ? 'pendiente' : 'entregado'; };

const handleSaveDocs = async () => {
    savingDocs.value = true;
    try {
        const payload = { requisitos_actualizar: docDraft.value.requisitos.map(r => ({ id: r.id, estado: r.pivot.estado })) };
        await confirmandosStore.save(docDraft.value.confirmando_id, payload);
        await loadGroupData();
        docsModalInstance.value.hide();
    } catch (e) {
        console.error(e);
        showAlerta('Error al guardar documentos', 'error');
    } finally {
        savingDocs.value = false;
    }
};

const countEntregados = (requisitos) => {
    if (!requisitos) return 0;
    return requisitos.filter(r => r.pivot.estado === 'entregado').length;
};

const getAlertaFaltas = (confirmando) => {
    const asistencias = confirmando.asistencias || [];
    const ESTADO_BUSCADO = 'falta injustificada';

    let consecutivas = 0;
    for (let i = asistencias.length - 1; i >= 0; i--) {
        if (asistencias[i].estado === ESTADO_BUSCADO) consecutivas++;
        else break;
    }

    const totales = asistencias.filter(a => a.estado === ESTADO_BUSCADO).length;

    if (consecutivas === 2 || totales === 4) {
        return {
            nivel: 'critico',
            icono: 'AlertOctagon',
            mensaje: consecutivas === 2 ? 'A una falta consecutiva del retiro' : 'A una falta acumulada del retiro',
            claseFila: 'row-critica'
        };
    }

    if (totales === 3) {
        return {
            nivel: 'preventivo',
            icono: 'AlertTriangle',
            mensaje: 'Ya tiene 3 faltas acumuladas',
            claseFila: 'row-preventiva'
        };
    }

    return null;
};
</script>

<template>
    <div class="main-container py-3 py-lg-4 px-2 px-md-4">

        <div v-if="loadingGrupo || !grupo" class="text-center py-5">
            <div class="spinner-border text-theme" role="status"></div>
            <p class="mt-2 text-muted">Cargando gestión del grupo...</p>
        </div>

        <div v-else-if="!grupo" class="alert alert-danger m-4">
            No se pudo cargar la información del grupo.
        </div>

        <div v-else>
            <div
                class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-2">
                <div>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <div v-if="authStore.can('ver todos los grupos')">
                            <router-link to="/grupos" class="btn btn-sm btn-light rounded-circle p-2 me-1">
                                <ArrowLeft :size="16" />
                            </router-link>
                        </div>

                        <h1 class="page-title">{{ grupo.nombre }}</h1>
                        <span class="badge text-white px-3 py-1 rounded-pill small"
                            :style="{ backgroundColor: groupColor }">
                            {{ grupo.periodo }}
                        </span>
                    </div>
                    <p class="page-subtitle mb-0 mt-1 ms-md-5">Gestión y control del grupo</p>
                </div>
            </div>

            <div class="row g-4">

                <div class="col-xl-8">
                    <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                        <div
                            class="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center">
                            <h6
                                class="fw-bold text-secondary mb-0 text-uppercase small d-flex align-items-center gap-2">
                                <Users :size="16" />
                                <span>Integrantes Inscritos ({{ grupo.confirmandos?.length || 0 }})</span>
                            </h6>
                            <button v-if="authStore.can('asignar confirmandos')"
                                class="btn btn-sm btn-theme rounded-pill px-3 shadow-none"
                                @click="openConfirmandosModal" :disabled="loadingConfirmandos">
                                <span v-if="loadingConfirmandos" class="spinner-border spinner-border-sm me-1"></span>
                                <span v-else class="d-flex align-items-center gap-1">
                                    <Plus :size="16" /> Gestionar Inscripción
                                </span>
                            </button>
                        </div>

                        <div class="table-responsive">
                            <table class="table align-middle mb-0">
                                <thead class="bg-light text-muted small text-uppercase">
                                    <tr>
                                        <th class="ps-4 py-2" style="width: 50px;">N°</th>
                                        <th class="py-2">Confirmando</th>
                                        <th class="py-2">Contacto</th>
                                        <th class="py-2 text-center">Progreso</th>
                                        <th class="py-2 text-center">Apoderados</th>
                                        <th class="pe-4 py-2 text-end">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="!grupo.confirmandos || grupo.confirmandos.length === 0">
                                        <td colspan="6" class="text-center py-5 text-muted small">
                                            No hay confirmandos registrados en este grupo pastoral.
                                        </td>
                                    </tr>
                                    <tr v-for="(conf, i) in grupo.confirmandos" :key="conf.id" class="hover-row"
                                        :class="getAlertaFaltas(conf)?.claseFila">
                                        <td class="ps-4">
                                            <span class="text-muted fw-bold">{{ i + 1 }}</span>
                                        </td>
                                        <td>
                                            <div>
                                                <div class="fw-bold text-dark">{{ conf.apellidos }}, {{ conf.nombres }}
                                                </div>
                                                <div v-if="getAlertaFaltas(conf)" class="mt-1">
                                                    <span :title="getAlertaFaltas(conf).mensaje"
                                                        :class="['badge-alert-glow', getAlertaFaltas(conf).nivel]">
                                                        <component
                                                            :is="getAlertaFaltas(conf).icono === 'AlertOctagon' ? AlertOctagon : AlertTriangle"
                                                            :size="10" class="me-1" />
                                                        <span>RIESGO CRÍTICO</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div v-if="conf.celular"
                                                class="small text-secondary d-flex align-items-center gap-1">
                                                <Phone :size="12" /> {{ conf.celular }}
                                            </div>
                                            <span v-else class="text-muted small italic">No hay celular registrado</span>
                                        </td>
                                        <td style="width: 20%;">
                                            <div class="d-flex align-items-center justify-content-center gap-2 px-3">
                                                <div class="progress flex-grow-1" style="height: 6px;">
                                                    <div class="progress-bar rounded-pill" :style="{
                                                        width: (countEntregados(conf.requisitos) / (conf.requisitos?.length || 1)) * 100 + '%',
                                                        backgroundColor: groupColor
                                                    }"></div>
                                                </div>
                                                <span class="small fw-bold text-muted">{{
                                                    countEntregados(conf.requisitos) }}/{{ conf.requisitos?.length || 0
                                                    }}</span>
                                            </div>
                                        </td>
                                        <td class="text-center">
                                            <button
                                                class="btn btn-sm btn-outline-secondary rounded-pill border-0 px-3 py-1 position-relative"
                                                @click="openApoderadosInfoModal(conf)"
                                                :class="{ 'text-primary bg-primary-subtle': conf.apoderados && conf.apoderados.length > 0 }">
                                                <ShieldCheck :size="16" class="me-1 mb-1" />
                                                <span class="fw-bold">{{ conf.apoderados ? conf.apoderados.length : 0
                                                    }}</span>
                                            </button>
                                        </td>
                                        <td class="pe-4 text-end">
                                            <div class="d-inline-flex gap-2">
                                                <button class="btn btn-action rounded-circle btn-soft-warning"
                                                    title="Editar" @click="abrirEditar(conf.id)">
                                                    <Pencil :size="14" />
                                                </button>
                                                <button class="btn btn-action rounded-circle btn-soft-theme"
                                                    @click.stop="openDocsModal(conf)" title="Ver Documentos">
                                                    <FileText :size="14" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="col-xl-4">

                    <div class="card border-0 shadow-sm rounded-4 p-4 mb-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6
                                class="fw-bold text-secondary text-uppercase small mb-0 d-flex align-items-center gap-2">
                                <User :size="16" />
                                <span>Catequistas Asignados</span>
                            </h6>
                            <button v-if="authStore.can('asignar catequista')"
                                class="btn btn-sm btn-link p-0 text-decoration-none fw-bold"
                                @click="openCatechistaModal" :disabled="loadingUsers">
                                Editar
                            </button>
                        </div>

                        <div v-if="grupo.catequistas && grupo.catequistas.length > 0" class="d-flex flex-column gap-3">
                            <div v-for="cat in grupo.catequistas" :key="cat.id"
                                class="d-flex align-items-center p-2 rounded-3 bg-light-subtle border border-light">
                                <div class="bg-theme-soft text-theme rounded-circle p-2 me-3 d-flex align-items-center justify-content-center"
                                    style="width: 36px; height: 36px;">
                                    <User :size="16" />
                                </div>
                                <div class="overflow-hidden">
                                    <div class="fw-bold text-dark text-truncate small">{{ cat.name }}</div>
                                    <small class="text-muted d-block text-truncate" style="font-size: 0.75rem;">{{
                                        cat.email }}</small>
                                </div>
                            </div>
                        </div>
                        <div v-else class="text-center py-4 border border-dashed rounded-3 bg-light">
                            <span class="text-muted small italic">Sin catequistas vinculados</span>
                        </div>
                    </div>

                    <div class="card border-0 shadow-sm rounded-4 p-4">
                        <h6 class="fw-bold text-secondary text-uppercase small mb-3">Resumen de Grupo</h6>
                        <div class="d-flex justify-content-between mb-2 pb-2 border-bottom border-light">
                            <span class="text-muted small">Total Confirmandos:</span>
                            <span class="fw-bold text-dark">{{ grupo.confirmandos?.length || 0 }}</span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span class="text-muted small">Catequistas:</span>
                            <span class="fw-bold text-dark">{{ grupo.catequistas?.length || 0 }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal fade" id="catequistasModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content border-0">
                    <div class="modal-header-theme">
                        <div>
                            <h5 class="modal-title fw-bold text-white"><i class="bi bi-person-badge me-2"></i>Asignar
                                Catequistas</h5>
                            <p class="text-white-50 small mb-0">{{ grupo?.nombre }}</p>
                        </div>
                        <button type="button"
                            class="btn-close btn-close-white position-absolute top-0 end-0 m-3 shadow-none"
                            data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div v-if="loadingUsers" class="p-4 text-center">
                            <div class="spinner-border text-theme"></div>
                        </div>
                        <div v-else class="list-group list-group-flush">
                            <label v-for="cat in availableCatechists" :key="cat.id"
                                class="list-group-item list-group-item-action py-3 px-4 d-flex align-items-center cursor-pointer border-0">
                                <input class="form-check-input me-3 fs-5" type="checkbox" :value="cat.id"
                                    v-model="selectedCatechistIds" :disabled="savingCatequistas">
                                <div>
                                    <div class="fw-medium text-dark">{{ cat.name }}</div>
                                    <div class="small text-muted">{{ cat.email }}</div>
                                </div>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer bg-light-subtle border-top">
                        <button class="btn btn-outline-secondary border-0" data-bs-dismiss="modal">Cancelar</button>
                        <button class="btn btn-theme rounded-pill px-4" @click="handleSaveCatequistas"
                            :disabled="savingCatequistas">
                            {{ savingCatequistas ? 'Guardando...' : 'Guardar' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal fade" id="confirmandosModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
                <div class="modal-content border-0">
                    <div class="modal-header-theme">
                        <div>
                            <h5 class="modal-title fw-bold text-white"><i class="bi bi-people-fill me-2"></i>Asignar
                                Confirmandos</h5>
                            <p class="text-white-50 small mb-0">{{ grupo?.nombre }}</p>
                        </div>
                        <button type="button"
                            class="btn-close btn-close-white position-absolute top-0 end-0 m-3 shadow-none"
                            data-bs-dismiss="modal"></button>
                    </div>

                    <div class="bg-light border-bottom p-3">
                        <div class="input-group">
                            <span class="input-group-text bg-white border-end-0">
                                <Search :size="16" class="text-muted" />
                            </span>
                            <input type="text" class="form-control border-start-0 shadow-none"
                                v-model="confirmandoSearchQuery" placeholder="Buscar por nombre...">
                        </div>
                    </div>

                    <div class="modal-body p-0">
                        <table class="table align-middle mb-0">
                            <thead class="bg-light sticky-top text-muted small text-uppercase" style="z-index: 1;">
                                <tr>
                                    <th class="ps-4 py-2" style="width: 50px;">
                                        <input class="form-check-input" type="checkbox"
                                            @change="toggleSelectAllFiltered">
                                    </th>
                                    <th class="py-2">Nombre</th>
                                    <th class="py-2">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="conf in confirmandosActivos" :key="conf.id"
                                    class="hover-bg-light cursor-pointer"
                                    @click="!savingConfirmandos && (selectedConfirmandoIds.includes(conf.id) ? selectedConfirmandoIds = selectedConfirmandoIds.filter(id => id !== conf.id) : selectedConfirmandoIds.push(conf.id))">
                                    <td class="ps-4">
                                        <input class="form-check-input" type="checkbox" :value="conf.id"
                                            v-model="selectedConfirmandoIds" :disabled="savingConfirmandos" @click.stop>
                                    </td>
                                    <td>
                                        <div class="fw-bold text-dark">{{ conf.apellidos }}, {{ conf.nombres }}</div>
                                    </td>
                                    <td class="small">
                                        <span v-if="conf.grupo_id"
                                            class="badge bg-success-subtle text-success border-0 px-3 py-1">Inscrito en
                                            este grupo</span>
                                        <span v-else class="badge bg-secondary-subtle text-muted border-0 px-3 py-1">Sin
                                            asignar</span>
                                    </td>
                                </tr>
                                <tr v-if="confirmandosActivos.length === 0">
                                    <td colspan="3" class="text-center py-4 text-muted small">No hay confirmandos
                                        disponibles para agregar.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer bg-light-subtle border-top">
                        <button class="btn btn-outline-secondary border-0" data-bs-dismiss="modal">Cancelar</button>
                        <button class="btn btn-theme rounded-pill px-4" @click="handleSaveConfirmandos"
                            :disabled="savingConfirmandos">
                            {{ savingConfirmandos ? 'Guardando...' : 'Confirmar Asignación' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal fade" id="apoderadosInfoModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0">
                    <div class="modal-header-theme position-relative">
                        <div class="pe-5">
                            <h5 class="modal-title fw-bold text-white d-flex align-items-center gap-2">
                                <ShieldCheck :size="20" /><span>Contactos de Apoderados</span>
                            </h5>
                            <p class="text-white-50 small mb-0">Confirmando: {{ currentApoderadosView.nombreConfirmando
                                }}</p>
                        </div>
                        <button type="button"
                            class="btn-close btn-close-white position-absolute top-0 end-0 m-3 shadow-none"
                            data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div v-if="currentApoderadosView.apoderados.length === 0" class="p-5 text-center text-muted">
                            <ShieldCheck :size="32" class="mb-2 opacity-25 mx-auto" />
                            <p class="mb-0 small">No se han registrado apoderados para este confirmando.</p>
                        </div>
                        <div v-else class="list-group list-group-flush">
                            <div v-for="apo in currentApoderadosView.apoderados" :key="apo.id"
                                class="list-group-item p-3 d-flex justify-content-between align-items-center border-0 border-bottom">
                                <div class="d-flex align-items-center gap-3">
                                    <div class="rounded-circle bg-light border d-flex align-items-center justify-content-center text-secondary"
                                        style="width: 36px; height: 36px;">
                                        <User :size="16" />
                                    </div>
                                    <div>
                                        <div class="fw-bold text-dark small">{{ apo.apellidos }}, {{ apo.nombres }}
                                        </div>
                                        <span class="badge bg-secondary-subtle text-muted fw-normal border-0 mt-1"
                                            style="font-size: 0.7rem;">
                                            {{ apo.pivot?.tipo || 'Apoderado' }}
                                        </span>
                                    </div>
                                </div>
                                <div class="text-end">
                                    <a v-if="apo.celular" :href="`tel:${apo.celular}`"
                                        class="btn btn-sm btn-light border rounded-pill text-muted small d-flex align-items-center gap-1">
                                        <Phone :size="12" /> {{ apo.celular }}
                                    </a>
                                    <span v-else class="text-muted small fst-italic">Sin contacto</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer bg-light-subtle border-top">
                        <button class="btn btn-outline-secondary border-0" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal fade" id="docsModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0">
                    <div class="modal-header-theme">
                        <div>
                            <h5 class="modal-title fw-bold text-white d-flex align-items-center gap-2">
                                <FileText :size="20" /><span>Requisitos de Sacramentos</span>
                            </h5>
                            <div class="text-white-50 small mb-0 mt-1">
                                <span class="fw-bold">{{ docDraft.nombre }}</span>
                                <span class="mx-2 opacity-50">|</span>
                                <span class="fw-bold text-uppercase bg-white bg-opacity-25 px-2 py-0.5 rounded"
                                    style="font-size: 0.8em;">
                                    Falta: {{ docDraft.sacramento_faltante || 'Ninguno' }}
                                </span>
                            </div>
                        </div>
                        <button type="button"
                            class="btn-close btn-close-white position-absolute top-0 end-0 m-3 shadow-none"
                            data-bs-dismiss="modal"></button>
                    </div>

                    <div class="modal-body p-0">
                        <div v-if="docDraft.requisitos.length === 0" class="p-5 text-center text-muted">
                            <AlertCircle :size="32" class="mb-2 opacity-50 mx-auto" />
                            <p class="mb-0 small">Sin requisitos asignados para este sacramento.</p>
                        </div>
                        <div v-else class="list-group list-group-flush">
                            <div v-for="req in docDraft.requisitos" :key="req.id"
                                class="list-group-item p-3 d-flex justify-content-between align-items-center transition-all border-0 border-bottom"
                                :class="{ 'bg-theme-soft': req.pivot.estado === 'entregado' }">
                                <div class="d-flex align-items-center gap-3">
                                    <div class="rounded-circle border d-flex align-items-center justify-content-center transition-all"
                                        :class="req.pivot.estado === 'entregado' ? 'bg-success border-success text-white' : 'bg-white border-secondary'"
                                        style="width: 24px; height: 24px;">
                                        <CheckCircle v-if="req.pivot.estado === 'entregado'" :size="14" />
                                    </div>
                                    <span
                                        :class="req.pivot.estado === 'entregado' ? 'text-dark fw-bold small' : 'text-secondary small'">
                                        {{ req.nombre }}
                                    </span>
                                </div>
                                <div v-if="authStore.can('validar requisitos')" class="form-check form-switch">
                                    <input class="form-check-input cursor-pointer shadow-none" type="checkbox"
                                        :checked="req.pivot.estado === 'entregado'" @change="toggleDocState(req)"
                                        :disabled="savingDocs">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer bg-light-subtle border-top">
                        <button class="btn btn-outline-secondary border-0" data-bs-dismiss="modal">Cerrar</button>
                        <button v-if="authStore.can('validar requisitos')" class="btn btn-theme rounded-pill px-4"
                            @click="handleSaveDocs" :disabled="savingDocs">
                            {{ savingDocs ? 'Guardando...' : 'Guardar Progreso' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <ConfirmandoModal ref="modalRef" @saved="recargarTabla" />
    </div>
</template>

<style scoped>
.main-container {
    --theme-color: v-bind(groupColor);
    --theme-soft: color-mix(in srgb, var(--theme-color), white 93%);
    --theme-hover: color-mix(in srgb, var(--theme-color), black 12%);
}

.text-theme {
    color: var(--theme-color) !important;
}

.page-title {
    font-size: 1.4rem;
    font-weight: 800;
    color: #1e293b;
    margin: 0;
}

.page-subtitle {
    font-size: 0.825rem;
    color: #64748b;
}

.btn-theme {
    background-color: var(--theme-color);
    border-color: var(--theme-color);
    color: white;
}

.btn-theme:hover {
    background-color: var(--theme-hover);
    border-color: var(--theme-hover);
    color: white;
}

.bg-theme-soft {
    background-color: var(--theme-soft) !important;
}

.modal-header-theme {
    background: linear-gradient(135deg, var(--theme-color) 0%, #1e293b 150%);
    color: white;
    padding: 1.5rem 2rem;
    border-bottom: none;
    position: relative;
}

.modal-content {
    border-radius: 1.2rem !important;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.rounded-4 {
    border-radius: 1rem !important;
}

.hover-row {
    transition: background-color 0.2s ease;
}

.hover-row:hover td {
    background-color: #f8fafc;
}

.hover-bg-light:hover {
    background-color: #f1f5f9;
}

.cursor-pointer {
    cursor: pointer;
}

.btn-action {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    transition: all 0.2s ease;
}

.btn-soft-warning {
    background-color: #fef3c7;
    color: #d97706;
}

.btn-soft-warning:hover {
    background-color: #d97706;
    color: white;
}

.btn-soft-theme {
    background-color: var(--theme-soft);
    color: var(--theme-color);
}

.btn-soft-theme:hover {
    background-color: var(--theme-color);
    color: white;
}

.row-critica {
    background-color: rgba(239, 68, 68, 0.04) !important;
}

.row-preventiva {
    background-color: rgba(245, 158, 11, 0.04) !important;
}

.badge-alert-glow {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 50px;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.5px;
}

.badge-alert-glow.critico {
    background-color: #fecaca;
    color: #ef4444;
}

.badge-alert-glow.preventivo {
    background-color: #fef3c7;
    color: #d97706;
}
</style>