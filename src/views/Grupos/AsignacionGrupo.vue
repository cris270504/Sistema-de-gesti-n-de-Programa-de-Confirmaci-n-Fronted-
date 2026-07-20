<script setup>
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { showAlerta } from '@/funciones';
import { useGruposStore } from '../../stores/grupos';
import { useUsersStore } from '../../stores/users';
import { useConfirmandosStore } from '../../stores/confirmandos';
import { useAuthStore } from '@/stores/auth';

// Íconos
import { ArrowLeft, User, Phone, Pencil, ShieldCheck, FileText, AlertTriangle, AlertOctagon } from 'lucide-vue-next';

// Componentes
import ConfirmandoModal from '@/components/Modals/confirmandoModal.vue';
import RequisitosModal from '@/components/Modals/RequisitosModal.vue';
import AsignarCatequistasModal from '@/components/Modals/AsignarCatequistasModal.vue';
import AsignarConfirmandosModal from '@/components/Modals/AsignarConfirmandosModal.vue';
import PerfilConfirmandoModal from '../../components/Modals/PerfilConfirmandoModal.vue';
import ApoderadosModal from '@/components/Modals/ApoderadosModal.vue'; // NUEVO MODAL

const props = defineProps({ id: { type: [Number, String], required: true } });

// Stores
const gruposStore = useGruposStore();
const usersStore = useUsersStore();
const confirmandosStore = useConfirmandosStore();
const authStore = useAuthStore();
const { confirmandosAlerta, items: allConfirmandos } = storeToRefs(confirmandosStore);

// Estado Local
const grupo = ref(null);
const loadingGrupo = ref(true);
const groupColor = computed(() => grupo.value?.color || '#2563eb');

// Refs de Modales (Sin document.getElementById)
const modalRef = ref(null);
const asignarCatequistasRef = ref(null);
const asignarConfirmandosRef = ref(null);
const perfilModalRef = ref(null);
const requisitosModalRef = ref(null);
const apoderadosModalRef = ref(null);

// ==========================================
// 1. PERMISOS LIMPIOS (Clean Code)
// ==========================================
const canManageConfirmandos = computed(() => authStore.can('asignar confirmandos'));
const canManageCatequistas = computed(() => authStore.can('asignar catequista'));
const canViewGrupos = computed(() => authStore.can('ver todos los grupos'));

// ==========================================
// 2. INICIALIZACIÓN CENTRALIZADA
// ==========================================
const loadData = async () => {
    loadingGrupo.value = true;
    try {
        const promises = [
            gruposStore.fetchById(Number(props.id)).then(g => { grupo.value = g; }),
            confirmandosStore.fetchAll()
        ];
        
        if (authStore.can('ver usuarios') || canManageCatequistas.value) {
            promises.push(usersStore.fetchAll());
        }
        
        await Promise.all(promises);
    } catch (e) {
        showAlerta('Error al cargar datos', 'error');
    } finally {
        loadingGrupo.value = false;
    }
};

// Se ejecuta al montar Y cuando cambia el ID
watch(() => props.id, loadData, { immediate: true });

const recargarTabla = async () => {
    await confirmandosStore.fetchAll();
    grupo.value = await gruposStore.fetchById(Number(props.id));
};

// ==========================================
// 3. OPTIMIZACIÓN DE RENDIMIENTO O(n)
// ==========================================
// Creamos índices para búsqueda instantánea
const confirmandosMap = computed(() => new Map(allConfirmandos.value.map(c => [c.id, c])));
const alertasMap = computed(() => new Map(confirmandosAlerta.value?.map(a => [a.id, a]) || []));

// Procesamos toda la data en un solo ciclo para el template
const confirmandosProcesados = computed(() => {
    if (!grupo.value?.confirmandos) return [];

    return grupo.value.confirmandos
        .map(c => confirmandosMap.value.get(c.id) ?? c)
        .filter(c => c.estado !== 'retirado')
        .map(c => {
            const alerta = alertasMap.value.get(c.id);
            return {
                ...c,
                // Inyectamos la alerta precalculada para no llamar funciones en el v-for
                alerta: alerta ? {
                    nivel_riesgo: alerta.nivel_riesgo,
                    motivo_alerta: alerta.motivo_alerta,
                    claseFila: alerta.nivel_riesgo === 'ALTO' ? 'row-critica' : 'row-preventiva'
                } : null
            };
        });
});

const countEntregados = (requisitos) => requisitos?.filter(r => r.pivot.estado === 'entregado').length || 0;
</script>

<template>
    <div class="main-container py-3 py-lg-4 px-2 px-md-4">
        <div v-if="loadingGrupo" class="text-center py-5">
            <div class="spinner-border text-theme" role="status"></div>
        </div>

        <div v-else-if="!grupo" class="alert alert-danger m-4">Grupo no encontrado.</div>

        <div v-else>
            <!-- Encabezado del Grupo -->
            <div class="d-flex align-items-center gap-2 mb-4">
                <div v-if="canViewGrupos">
                    <router-link to="/grupos" class="btn btn-sm btn-light rounded-circle p-2 me-1">
                        <ArrowLeft :size="16" />
                    </router-link>
                </div>
                <h1 class="page-title mb-0">{{ grupo.nombre }}</h1>
                <span class="badge text-white px-3 py-1 rounded-pill small" :style="{ backgroundColor: groupColor }">
                    {{ grupo.periodo }}
                </span>
            </div>

            <div class="row g-4">
                <!-- Tabla Principal -->
                <div class="col-xl-8">
                    <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                        <div class="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center">
                            <button v-if="canManageConfirmandos" class="btn btn-sm btn-theme rounded-pill px-3"
                                @click="asignarConfirmandosRef.open(grupo)">
                                Gestionar Inscripción
                            </button>
                        </div>
                        <div class="table-responsive">
                            <table class="table align-middle mb-0">
                                <thead class="bg-light text-muted small text-uppercase">
                                    <tr>
                                        <th class="ps-4 py-2" style="width: 50px;">N°</th>
                                        <th class="py-2">Confirmando</th>
                                        <th class="py-2">Situacion</th>
                                        <th class="py-2 text-center">Progreso</th>
                                        <th class="py-2 text-center">Apoderados</th>
                                        <th class="pe-4 py-2 text-end">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- ESTADO VACÍO (UX Mejorada) -->
                                    <tr v-if="!confirmandosProcesados.length">
                                        <td colspan="6" class="text-center py-5 text-muted">
                                            <User :size="32" class="mb-2 opacity-50" />
                                            <p class="mb-0">No hay confirmandos registrados en este grupo.</p>
                                        </td>
                                    </tr>
                                    
                                    <!-- FILAS OPTIMIZADAS -->
                                    <tr v-for="(conf, i) in confirmandosProcesados" :key="conf.id" :class="conf.alerta?.claseFila">
                                        <td class="ps-4 fw-bold text-muted">{{ i + 1 }}</td>
                                        <td>
                                            <div class="fw-bold text-dark">{{ conf.apellidos }}, {{ conf.nombres }}</div>
                                            <div class="small text-secondary d-flex align-items-center gap-1">
                                                <Phone :size="12" /> {{ conf.celular || 'Sin celular' }}
                                            </div>
                                            <div v-if="conf.alerta" class="mt-1">
                                                <span :class="['badge-alert-glow', conf.alerta.nivel_riesgo]">
                                                    <AlertOctagon v-if="conf.alerta.nivel_riesgo === 'ALTO'" :size="12" />
                                                    <AlertTriangle v-else :size="12" /> RIESGO
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span class="badge bg-warning-subtle text-warning me-1">{{ conf.total_faltas_justificadas || 0 }} Justif.</span>
                                            <span class="badge bg-info-subtle text-info mt-1">{{ conf.total_tardanzas || 0 }} Tardanzas</span>
                                        </td>
                                        <td class="text-center">
                                            <span class="small fw-bold text-muted">
                                                {{ countEntregados(conf.requisitos) }}/{{ conf.requisitos?.length || 0 }}
                                            </span>
                                        </td>
                                        <td class="text-center">
                                            <button class="btn btn-sm rounded-pill px-3 py-1 d-inline-flex align-items-center gap-1 border"
                                                :class="conf.apoderados?.length ? 'btn-light text-primary border-primary-subtle' : 'btn-light text-secondary'"
                                                @click="apoderadosModalRef.open(conf)">
                                                <ShieldCheck :size="15" />
                                                <span class="fw-bold">{{ conf.apoderados?.length || 0 }}</span>
                                            </button>
                                        </td>
                                        <td class="pe-4 text-end align-middle text-nowrap">
                                            <div class="d-flex justify-content-end align-items-center gap-2">
                                                <button class="btn btn-sm btn-theme rounded-circle d-flex align-items-center justify-content-center"
                                                    style="width: 32px; height: 32px;" title="Editar Confirmando"
                                                    @click="modalRef.open(conf.id)">
                                                    <Pencil :size="15" />
                                                </button>
                                                <button class="btn btn-sm btn-theme rounded-circle d-flex align-items-center justify-content-center"
                                                    style="width: 32px; height: 32px;" title="Ver Requisitos"
                                                    @click="requisitosModalRef.open(conf)">
                                                    <FileText :size="15" />
                                                </button>
                                                <button class="btn btn-sm btn-theme rounded-circle d-flex align-items-center justify-content-center"
                                                    style="width: 32px; height: 32px;" title="Ver Ficha del Confirmando"
                                                    @click="perfilModalRef.abrir(conf.id)">
                                                    <User :size="15" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Panel Lateral (Catequistas) -->
                <div class="col-xl-4">
                    <div class="card border-0 shadow-sm rounded-4 p-4 mb-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold text-secondary text-uppercase small mb-0 d-flex align-items-center gap-1">
                                <User :size="16" /> Catequistas
                            </h6>
                            <button v-if="canManageCatequistas" class="btn btn-sm btn-theme rounded-pill px-3"
                                @click="asignarCatequistasRef.open(grupo)">Editar</button>
                        </div>
                        <div v-if="grupo.catequistas?.length" class="d-flex flex-column gap-3">
                            <div v-for="cat in grupo.catequistas" :key="cat.id" class="d-flex align-items-center p-2 rounded-3 bg-light-subtle border border-light">
                                <div class="bg-theme-soft text-theme rounded-circle p-2 me-3 d-flex">
                                    <User :size="16" />
                                </div>
                                <div>
                                    <div class="fw-bold small">{{ cat.name }}</div>
                                    <small class="text-muted">{{ cat.email }}</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modales Externos (Totalmente Desacoplados) -->
        <ConfirmandoModal ref="modalRef" @saved="recargarTabla" />
        <AsignarCatequistasModal ref="asignarCatequistasRef" @updated="recargarTabla" />
        <AsignarConfirmandosModal ref="asignarConfirmandosRef" @updated="recargarTabla" />
        <PerfilConfirmandoModal ref="perfilModalRef" />
        <RequisitosModal ref="requisitosModalRef" @saved="recargarTabla" />
        <ApoderadosModal ref="apoderadosModalRef" />
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