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
    return allConfirmandos.value.filter(c => c.estado === 'en_preparacion');
});

// Modales refs
const catequistasModalInstance = ref(null);
const confirmandosModalInstance = ref(null);
const docsModalInstance = ref(null);
const apoderadosInfoModalInstance = ref(null); // <--- NUEVO MODAL
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

// Estado para el modal de ver apoderadossacramento_faltante
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
    apoderadosInfoModalInstance.value?.dispose(); // Limpiar nuevo modal
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

        // Inicializar nuevo modal
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
        // 1. Primero filtramos que sea catequista o coordinador
        const hasRole = user.roles?.some(role =>
            role.name === 'catequista' || role.name === 'coordinador'
        );

        if (!hasRole) return false;

        // 2. Lógica de visibilidad en el modal:
        // - Si no tiene grupo (grupo_id es null o undefined) -> APARECE
        // - Si el grupo que tiene es el MISMO que estamos editando -> APARECE (para poder desmarcarlo)
        // - Si tiene otro grupo diferente -> NO APARECE
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
    } catch (e) { console.error(e); showAlerta('Error al guardar', 'error'); } finally { savingCatequistas.value = false; }
};

// --- LÓGICA CONFIRMANDOS ---
const availableConfirmandos = computed(() => {
    if (!allConfirmandos.value) return [];
    const currentGroupId = Number(props.id);
    return allConfirmandos.value.filter(confirmando => !confirmando.grupo_id || confirmando.grupo_id === currentGroupId);
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
    } catch (e) { console.error(e); showAlerta('Error al guardar', 'error'); } finally { savingConfirmandos.value = false; }
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

// --- LÓGICA APODERADOS (NUEVO MODAL) ---
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

    if (estaPendiente('bautismo')) return 'Bautismo, Primera Comunión y Confirmación';

    if (estaPendiente('comunión') || estaPendiente('comunion')) return 'Primera Comunión y Confirmación';

    // 3. Si tiene lo anterior, verificamos Confirmación
    if (estaPendiente('confirmación') || estaPendiente('confirmacion')) return 'Confirmación';

    // 4. Si no tiene nada pendiente registrado (o todo está 'recibido')
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
    } catch (e) { console.error(e); showAlerta('Error al guardar documentos', 'error'); } finally { savingDocs.value = false; }
};
const countEntregados = (requisitos) => { if (!requisitos) return 0; return requisitos.filter(r => r.pivot.estado === 'entregado').length; };

const getAlertaFaltas = (confirmando) => {
    const asistencias = confirmando.asistencias || [];
    const ESTADO_BUSCADO = 'falta injustificada';

    let consecutivas = 0;
    for (let i = asistencias.length - 1; i >= 0; i--) {
        if (asistencias[i].estado === ESTADO_BUSCADO) consecutivas++;
        else break;
    }

    const totales = asistencias.filter(a => a.estado === ESTADO_BUSCADO).length;

    // RIESGO CRÍTICO (Rojo Intenso)
    if (consecutivas === 2 || totales === 4) {
        return {
            nivel: 'critico',
            icono: 'AlertOctagon',
            mensaje: consecutivas === 2 ? 'A una falta consecutiva del retiro' : 'A una falta acumulada del retiro',
            claseFila: 'row-critica'
        };
    }

    // ALERTA PREVENTIVA (Ámbar)
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
    <div class="main-container">

        <div v-if="loadingGrupo || !grupo" class="text-center py-5">
            <div class="spinner-border text-theme" role="status"></div>
            <p class="mt-2 text-muted">Cargando gestión del grupo...</p>
        </div>

        <div v-else-if="!grupo" class="alert alert-danger m-4">
            No se pudo cargar la información del grupo.
        </div>

        <div v-else>
            <div class="d-flex justify-content-between align-items-end mb-3">
                <div>
                    <h2 class="page-title d-flex align-items-center gap-2">
                        <span class="text-theme">{{ grupo.nombre }}</span>
                        <span class="badge text-white fw-normal fs-6 border-0"
                            :style="{ backgroundColor: groupColor }">{{ grupo.periodo }}</span>
                    </h2>
                    <h2 class="page-subtitle">Panel de gestión de grupo</h2>
                </div>

                <RouterLink :to="{ name: 'grupos' }"
                    class="btn btn-outline-secondary px-3 d-inline-flex align-items-center gap-2">
                    <ArrowLeft :size="18" />
                    <span>Volver</span>
                </RouterLink>
            </div>

            <div class="card border-0 shadow-sm rounded-3 mb-3">
                <div
                    class="card-header bg-white border-bottom-0 pt-3 px-3 d-flex justify-content-between align-items-center">
                    <h6 class="fw-bold text-secondary mb-0 text-uppercase small d-flex align-items-center gap-2">
                        <User :size="16" />
                        <span>Catequistas Asignados</span>
                    </h6>

                    <button v-if="authStore.can('asignar catequista')"
                        class="btn btn-sm btn-soft-theme shadow-sm d-inline-flex align-items-center gap-2"
                        @click="openCatechistaModal" :disabled="loadingUsers">
                        <UserPlus :size="16" />
                        <span>Asignar / Editar</span>
                    </button>
                </div>
                <div class="card-body p-3">
                    <div v-if="grupo.catequistas && grupo.catequistas.length > 0" class="row g-3">
                        <div v-for="cat in grupo.catequistas" :key="cat.id" class="col-md-4 col-sm-6">
                            <div class="d-flex align-items-center p-2 border rounded bg-light-subtle h-100">
                                <div class="icon-box-sm me-3 bg-theme-soft text-theme flex-shrink-0">
                                    <User :size="16" />
                                </div>
                                <div class="overflow-hidden">
                                    <div class="fw-medium text-dark text-truncate">{{ cat.name }}</div>
                                    <small v-if="authStore.can('ver usuarios')"
                                        class="text-muted text-truncate d-block">{{ cat.email }}</small>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else class="text-center py-3 text-muted border rounded-3 border-dashed bg-light-subtle">
                        <small>Sin catequistas asignados</small>
                    </div>
                </div>
            </div>

            <div class="card border-0 shadow-sm rounded-3 overflow-hidden">
                <div
                    class="card-header bg-white border-bottom pt-3 px-3 pb-2 d-flex justify-content-between align-items-center">
                    <h6 class="fw-bold text-secondary mb-0 text-uppercase small">
                        <Users :size="16" class="me-1 mb-1" /> Lista de Confirmandos
                    </h6>
                    <button v-if="authStore.can('asignar confirmandos')" class="btn btn-sm btn-theme shadow-sm"
                        @click="openConfirmandosModal" :disabled="loadingConfirmandos">
                        <span v-if="loadingConfirmandos" class="spinner-border spinner-border-sm me-1"></span>
                        <span v-else class="d-flex align-items-center">
                            <Plus :size="16" class="me-1" /> Gestionar Lista
                        </span>
                    </button>
                </div>

                <div class="table-responsive">
                    <table class="table align-middle mb-0">
                        <thead class="bg-light-gray">
                            <tr>
                                <th class="ps-3 py-2 text-secondary text-uppercase fw-bold">N°</th>
                                <th class="ps-3 py-2 text-secondary text-uppercase fw-bold">Confirmando</th>
                                <th class="py-2 text-secondary text-uppercase fw-bold">Contacto</th>
                                <th class="py-2 text-secondary text-uppercase fw-bold">Editar</th>
                                <th class="text-center py-2 text-secondary text-uppercase fw-bold">Progreso</th>
                                <th class="text-center py-2 text-secondary text-uppercase fw-bold">Apoderados</th>
                                <th class="py-2 text-secondary text-uppercase fw-bold">Docs</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="!grupo.confirmandos || grupo.confirmandos.length === 0">
                                <td colspan="6" class="text-center py-5 text-muted">Este grupo no tiene confirmandos
                                    inscritos.</td>
                            </tr>
                            <tr v-for="(conf, i) in grupo.confirmandos" :key="conf.id" class="hover-row">
                                <td class="ps-3 py-2">
                                    <div class="fw-medium text-dark lh-1">{{ i + 1 }}</div>
                                </td>
                                <td class="ps-3 py-2">
                                    <div class="d-flex align-items-center gap-2">
                                        <div class="fw-bold text-dark">{{ conf.apellidos }}, {{ conf.nombres }}</div>

                                        <!-- Badge Ultra Notorio -->
                                        <template v-if="getAlertaFaltas(conf)">
                                            <span :title="getAlertaFaltas(conf).mensaje"
                                                :class="['badge-alert-glow', getAlertaFaltas(conf).nivel]">
                                                <component :is="getAlertaFaltas(conf).icono" :size="12" class="me-1" />
                                                <span>RIESGO DE RETIRO</span>
                                            </span>
                                        </template>
                                    </div>
                                </td>
                                <td class="py-2 text-muted small">
                                    <div v-if="conf.celular" class="d-flex align-items-center">
                                        <Phone :size="12" class="me-1" /> {{ conf.celular }}
                                    </div>
                                    <span v-else class="fst-italic opacity-50">-</span>
                                </td>
                                <td>
                                    <button class="btn btn-action btn-soft-warning" title="Editar"
                                        @click="abrirEditar(conf.id)">
                                        <Pencil :size="18" />
                                    </button>
                                </td>
                                <td class="py-2" style="width: 20%;">
                                    <div class="d-flex align-items-center gap-2">
                                        <div class="progress flex-grow-1" style="height: 6px;">
                                            <div class="progress-bar" :style="{
                                                width: (countEntregados(conf.requisitos) / (conf.requisitos?.length || 1)) * 100 + '%',
                                                backgroundColor: groupColor
                                            }">
                                            </div>
                                        </div>
                                        <span class="small fw-bold text-muted">{{ countEntregados(conf.requisitos) }}/{{
                                            conf.requisitos?.length || 0 }}</span>
                                    </div>
                                </td>
                                <td class="text-center py-2">
                                    <button
                                        class="btn btn-sm btn-outline-secondary border-0 d-inline-flex align-items-center gap-1"
                                        @click="openApoderadosInfoModal(conf)"
                                        :class="{ 'text-primary': conf.apoderados && conf.apoderados.length > 0, 'opacity-50': !conf.apoderados || conf.apoderados.length === 0 }">
                                        <ShieldCheck :size="18" />
                                        <span class="small fw-bold">
                                            {{ conf.apoderados ? conf.apoderados.length : 0 }}
                                        </span>
                                    </button>
                                </td>
                                <td class="text-end pe-3 py-2">
                                    <button class="btn btn-action-sm btn-soft-theme" @click.stop="openDocsModal(conf)"
                                        title="Ver Documentos">
                                        <FileText :size="16" />
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="modal fade" id="catequistasModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header-theme">
                        <div>
                            <h5 class="modal-title fw-bold text-white"><i class="bi bi-person-badge"></i>Asignar
                                Catequistas</h5>
                            <p class="text-white-50 small mb-0">{{ grupo?.nombre }}</p>
                        </div>
                        <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-3"
                            data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div v-if="loadingUsers" class="p-4 text-center">
                            <div class="spinner-border text-theme"></div>
                        </div>
                        <div v-else class="list-group list-group-flush">
                            <label v-for="cat in availableCatechists" :key="cat.id"
                                class="list-group-item list-group-item-action py-3 px-4 d-flex align-items-center cursor-pointer">
                                <input class="form-check-input me-3 fs-5" type="checkbox" :value="cat.id"
                                    v-model="selectedCatechistIds" :disabled="savingCatequistas">
                                <div>
                                    <div class="fw-medium text-dark">{{ cat.name }}</div>
                                    <div class="small text-muted">{{ cat.email }}</div>
                                </div>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer bg-light-subtle">
                        <button class="btn btn-outline-secondary border-0" data-bs-dismiss="modal">Cancelar</button>
                        <button class="btn btn-theme" @click="handleSaveCatequistas" :disabled="savingCatequistas">
                            {{ savingCatequistas ? 'Guardando...' : 'Guardar Cambios' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal fade" id="confirmandosModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
                <div class="modal-content">
                    <div class="modal-header-theme">
                        <div>
                            <h5 class="modal-title fw-bold text-white"><i class="bi bi-people-fill me-2"></i>Asignar
                                Confirmandos</h5>
                            <p class="text-white-50 small mb-0">{{ grupo?.nombre }}</p>
                        </div>
                        <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-3"
                            data-bs-dismiss="modal"></button>
                    </div>

                    <div class="bg-light border-bottom p-3">
                        <div class="input-group">
                            <span class="input-group-text bg-white border-end-0">
                                <Search :size="16" />
                            </span>
                            <input type="text" class="form-control border-start-0" v-model="confirmandoSearchQuery"
                                placeholder="Buscar por nombre...">
                        </div>
                    </div>

                    <div class="modal-body p-0">
                        <table class="table align-middle mb-0">
                            <thead class="bg-light sticky-top" style="z-index: 1;">
                                <tr>
                                    <th class="ps-4 py-2" style="width: 50px;">
                                        <input class="form-check-input" type="checkbox"
                                            @change="toggleSelectAllFiltered">
                                    </th>
                                    <th class="py-2 text-secondary small fw-bold text-uppercase">Nombre</th>
                                    <th class="py-2 text-secondary small fw-bold text-uppercase">Info</th>
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
                                        <div class="fw-medium text-dark">{{ conf.apellidos }} {{ conf.nombres }}</div>
                                    </td>
                                    <td class="text-muted small">
                                        <span v-if="conf.grupo_id && conf.grupo_id !== grupo?.id"
                                            class="badge bg-warning text-dark border">Otro Grupo</span>
                                        <span v-else>{{ conf.celular || 'Sin celular' }}</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer bg-light-subtle">
                        <button class="btn btn-outline-secondary border-0" data-bs-dismiss="modal">Cancelar</button>
                        <button class="btn btn-theme" @click="handleSaveConfirmandos" :disabled="savingConfirmandos">
                            {{ savingConfirmandos ? 'Guardando...' : 'Guardar Asignación' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal fade" id="apoderadosInfoModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header-theme position-relative">
                        <div class="pe-5">
                            <h5 class="modal-title fw-bold text-white">
                                <ShieldCheck class="me-2" :size="20" />Apoderados
                            </h5>
                            <p class="text-white-50 small mb-0">
                                Confirmando: {{ currentApoderadosView.nombreConfirmando }}
                            </p>
                        </div>
                        <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-3"
                            data-bs-dismiss="modal">
                        </button>
                    </div>
                    <div class="modal-body p-0">
                        <div v-if="currentApoderadosView.apoderados.length === 0" class="p-5 text-center text-muted">
                            <ShieldCheck :size="32" class="mb-2 opacity-25 mx-auto" />
                            <p class="mb-0">No se han registrado apoderados para este confirmando.</p>
                        </div>
                        <div v-else class="list-group list-group-flush">
                            <div v-for="apo in currentApoderadosView.apoderados" :key="apo.id"
                                class="list-group-item p-3 d-flex justify-content-between align-items-center">
                                <div class="d-flex align-items-center gap-3">
                                    <div class="rounded-circle bg-light border d-flex align-items-center justify-content-center text-secondary"
                                        style="width: 40px; height: 40px;">
                                        <User :size="20" />
                                    </div>
                                    <div>
                                        <div class="fw-bold text-dark">{{ apo.apellidos }}, {{ apo.nombres }}</div>
                                        <span class="badge bg-theme-soft text-theme fw-normal border border-0">
                                            {{ apo.pivot?.tipo || 'Apoderado' }}
                                        </span>
                                    </div>
                                </div>
                                <div class="text-end">
                                    <a v-if="apo.celular" :href="`tel:${apo.celular}`"
                                        class="btn btn-sm btn-light border text-muted d-flex align-items-center gap-2">
                                        <Phone :size="14" /> {{ apo.celular }}
                                    </a>
                                    <span v-else class="text-muted small fst-italic">Sin contacto</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer bg-light-subtle">
                        <button class="btn btn-outline-secondary border-0" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal fade" id="docsModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header-theme">
                        <div>
                            <h5 class="modal-title fw-bold text-white">
                                <i class="bi bi-file-earmark-check"></i>Documentación
                            </h5>
                            <div class="text-white-50 small mb-0">
                                <span class="fw-medium">{{ docDraft.nombre }}</span>

                                <span class="mx-2 text-white opacity-50">|</span>

                                <span class="fw-bold text-uppercase" style="letter-spacing: 0.5px; font-size: 0.9em;">
                                    {{ docDraft.sacramento_faltante || 'Cargando...' }}
                                </span>
                            </div>
                        </div>
                        <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-3"
                            data-bs-dismiss="modal"></button>
                    </div>

                    <div class="modal-body p-0">
                        <div v-if="docDraft.requisitos.length === 0" class="p-5 text-center text-muted">
                            <AlertCircle :size="32" class="mb-2 opacity-50 mx-auto" />
                            <p class="mb-0">Sin requisitos asignados.</p>
                        </div>
                        <div v-else class="list-group list-group-flush">
                            <div v-for="req in docDraft.requisitos" :key="req.id"
                                class="list-group-item p-3 d-flex justify-content-between align-items-center transition-all"
                                :class="{ 'bg-theme-soft': req.pivot.estado === 'entregado' }">
                                <div class="d-flex align-items-center gap-3">
                                    <div class="rounded-circle border d-flex align-items-center justify-content-center"
                                        :class="req.pivot.estado === 'entregado' ? 'bg-success border-success text-white' : 'bg-white border-secondary'"
                                        style="width: 24px; height: 24px;">
                                        <CheckCircle v-if="req.pivot.estado === 'entregado'" :size="14" />
                                    </div>
                                    <span
                                        :class="req.pivot.estado === 'entregado' ? 'text-dark fw-medium' : 'text-secondary'">{{
                                            req.nombre }}</span>
                                </div>
                                <div v-if="authStore.can('validar requisitos')" class="form-check form-switch">
                                    <input class="form-check-input cursor-pointer" type="checkbox"
                                        :checked="req.pivot.estado === 'entregado'" @change="toggleDocState(req)"
                                        :disabled="savingDocs">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer bg-light-subtle">
                        <button class="btn btn-outline-secondary border-0" data-bs-dismiss="modal">Cerrar</button>
                        <button v-if="authStore.can('validar requisitos')" class="btn btn-theme" @click="handleSaveDocs"
                            :disabled="savingDocs">
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
/* ==================================================== */
/* TEMA DINÁMICO: Inyectamos el color del grupo         */
/* ==================================================== */
.main-container {
    /* Define variables CSS con el color seleccionado */
    --theme-color: v-bind(groupColor);
    --theme-soft: color-mix(in srgb, var(--theme-color), white 90%);
    --theme-hover: color-mix(in srgb, var(--theme-color), black 10%);
}

/* Títulos y Textos */
.text-theme {
    color: var(--theme-color) !important;
}

.page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
}

.page-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
}

/* Botones Principales (Usan el color del tema) */
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

.btn-soft-theme:hover {
    background-color: var(--theme-color);
    color: white;
}

/* Fondos Suaves */
.bg-theme-soft {
    background-color: var(--theme-soft) !important;
}

/* Spinners */
.spinner-border.text-theme {
    color: var(--theme-color) !important;
}

/* Modales con Header Gradiente */
.modal-header-theme {
    /* Gradiente dinámico usando la variable del tema */
    background: linear-gradient(135deg, var(--theme-color) 0%, black 150%);
    color: white;
    padding: 1.5rem 2rem;
    border-bottom: none;
}

/* --- ESTILOS GENERALES (Vibrant Compact) --- */
.icon-box-sm {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.border-dashed {
    border-style: dashed !important;
}

.modal-content {
    border: none;
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
}

.modal-footer {
    padding: 1rem 2rem 1.5rem;
    border-top: 1px solid #e2e8f0;
}

.text-white-50 {
    color: rgba(255, 255, 255, 0.75) !important;
}

.bg-light-gray {
    background-color: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
}

.hover-row:hover td {
    background-color: #f9fafb;
}

.hover-bg-light:hover {
    background-color: #f8fafc;
}

.cursor-pointer {
    cursor: pointer;
}

.btn-action-sm {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
}

/* Botones Soft (Fondo claro del color del tema) */
.btn-soft-theme {
    background-color: var(--theme-soft);
    color: var(--theme-color);
    /* CAMBIO: Borde ligero (mezcla del color del tema con 60% de blanco) */
    border: 1px solid color-mix(in srgb, var(--theme-color), white 60%);
}

.btn-soft-theme:hover {
    background-color: var(--theme-color);
    border-color: var(--theme-color);
    /* Al pasar el mouse, el borde se vuelve sólido */
    color: white;
}
/* Color de fondo sutil para la fila en riesgo */
.row-critica {
    background-color: rgba(255, 59, 48, 0.05) !important;
}

.row-preventiva {
    background-color: rgba(255, 204, 0, 0.05) !important;
}

/* Badge con brillo y animación */
.badge-alert-glow {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 50px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    border: 1px solid transparent;
    box-shadow: 0 0 10px rgba(0,0,0,0.05);
}

/* Estado Crítico: Rojo Neón */
.badge-alert-glow.critico {
    background-color: #ff3b30;
    color: white;
    box-shadow: 0 0 12px rgba(255, 59, 48, 0.4);
    animation: pulse-red 2s infinite;
}

/* Estado Preventivo: Ámbar */
.badge-alert-glow.preventivo {
    background-color: #ffcc00;
    color: #000;
    box-shadow: 0 0 12px rgba(255, 204, 0, 0.3);
}

/* Animación de pulso para riesgo crítico */
@keyframes pulse-red {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.7); }
    70% { transform: scale(1.03); box-shadow: 0 0 0 10px rgba(255, 59, 48, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); }
}
</style>