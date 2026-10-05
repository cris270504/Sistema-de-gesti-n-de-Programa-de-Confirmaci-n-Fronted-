<script setup>
import AppEmpty from '@/components/AppEmpty.vue'
import AppButton from '@/components/AppButton.vue'
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { showAlerta } from '@/funciones';
import { useGruposStore } from '../../stores/grupos';
import { useUsersStore } from '../../stores/users';
import { useConfirmandosStore } from '../../stores/confirmandos';
import { useDashboardStore } from '../../stores/dashboard';
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
import AppPage from '@/components/AppPage.vue';
import AppSkeleton from '@/components/AppSkeleton.vue';
import { useMediaQuery } from '@/composables/useMediaQuery';

const esMovil = useMediaQuery('(max-width: 767px)');

const props = defineProps({ id: { type: [Number, String], required: true } });

// Stores
const gruposStore = useGruposStore();
const usersStore = useUsersStore();
const confirmandosStore = useConfirmandosStore();
const dashboardStore = useDashboardStore();
const authStore = useAuthStore();
const { items: allConfirmandos } = storeToRefs(confirmandosStore);
// Las alertas de riesgo las calcula el backend (GET /dashboard/metricas) y ya vienen
// filtradas por los grupos del catequista. Antes se recalculaban en el front con
// umbrales que divergían del backend; ahora hay una sola fuente de verdad.
const { alertas: dashboardAlertas } = storeToRefs(dashboardStore);

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
            confirmandosStore.fetchAll(),
            dashboardStore.fetchMetricas()
        ];
        
        if (authStore.can('ver usuarios') || canManageCatequistas.value) {
            promises.push(usersStore.fetchAll());
        }
        
        await Promise.all(promises);
    } catch (e) {
        showAlerta(e?.message || 'Error al cargar datos', 'error');
    } finally {
        loadingGrupo.value = false;
    }
};

// Se ejecuta al montar Y cuando cambia el ID
watch(() => props.id, loadData, { immediate: true });

const recargarTabla = async () => {
    // force: es una recarga explícita tras una mutación, saltamos la ventana de frescura.
    await Promise.all([confirmandosStore.fetchAll({ force: true }), dashboardStore.fetchMetricas({ force: true })]);
    grupo.value = await gruposStore.fetchById(Number(props.id));
};

// ==========================================
// 3. OPTIMIZACIÓN DE RENDIMIENTO O(n)
// ==========================================
// Creamos índices para búsqueda instantánea
const confirmandosMap = computed(() => new Map(allConfirmandos.value.map(c => [c.id, c])));
const alertasMap = computed(() => new Map((dashboardAlertas.value || []).map(a => [a.id, a])));

// Procesamos toda la data en un solo ciclo para el template
const confirmandosProcesados = computed(() => {
    if (!grupo.value?.confirmandos) return [];

    return grupo.value.confirmandos
        // Base: el confirmando embebido en el grupo (trae apoderados, requisitos,
        // sacramentos). Encima, los campos frescos del store (estado, grupo_id…).
        // El listado ya no incluye apoderados/requisitos, por eso mergeamos en vez
        // de reemplazar.
        .map(c => ({ ...c, ...(confirmandosMap.value.get(c.id) ?? {}) }))
        .filter(c => c.estado !== 'retirado')
        .map(c => {
            const alerta = alertasMap.value.get(c.id);
            return {
                ...c,
                // Totales de asistencia calculados por el backend (0 si el joven no tiene alerta)
                total_faltas_justificadas: alerta?.total_faltas_justificadas ?? 0,
                total_tardanzas: alerta?.total_tardanzas ?? 0,
                total_faltas_injustificadas: alerta?.total_faltas_injustificadas ?? 0,
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
    <AppPage :title="grupo?.nombre ?? ''" :subtitle="grupo ? `Periodo ${grupo.periodo}` : ''" class="main-container">
        <template v-if="grupo && canViewGrupos" #actions>
            <AppButton variant="secondary" :icon="ArrowLeft" to="/grupos">Volver a grupos</AppButton>
        </template>

        <!-- El esqueleto se maneja acá (no con :loading de AppPage) para que los modales de abajo
             sigan montados al recargar el grupo y no pierdan su estado ni sus refs. -->
        <AppSkeleton v-if="loadingGrupo" skeleton="cards" />

        <div v-else-if="!grupo" class="alert-error">Grupo no encontrado.</div>

        <div v-else>
            <div class="row g-4">
                <!-- Tabla Principal -->
                <div class="col-xl-8">
                    <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                        <div class="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center">
                            <AppButton v-if="canManageConfirmandos" size="sm" class="theme-accent" @click="asignarConfirmandosRef.open(grupo)">Gestionar Inscripción</AppButton>
                        </div>
                        <div v-if="!esMovil" class="table-responsive cards-sm">
                            <table class="table align-middle mb-0">
                                <thead class="bg-light text-muted small">
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
                                        <td colspan="6">
                                            <AppEmpty :icon="User" message="Este grupo aún no tiene confirmandos.">
                                                <AppButton v-if="canManageConfirmandos" size="sm" class="theme-accent"
                                                    @click="asignarConfirmandosRef.open(grupo)">Gestionar inscripción</AppButton>
                                            </AppEmpty>
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
                                            <AppButton size="sm" :variant="conf.apoderados?.length ? 'secondary' : 'ghost'" :icon="ShieldCheck" @click="apoderadosModalRef.open(conf)">{{ conf.apoderados?.length || 0 }}</AppButton>
                                        </td>
                                        <td class="pe-4 text-end align-middle text-nowrap">
                                            <div class="d-flex justify-content-end align-items-center gap-2">
                                                <AppButton size="sm" icon-only class="theme-accent" title="Editar Confirmando" aria-label="Editar Confirmando" @click="modalRef.open(conf.id)"><Pencil :size="15" /></AppButton>
                                                <AppButton size="sm" icon-only class="theme-accent" title="Ver Requisitos" aria-label="Ver Requisitos" @click="requisitosModalRef.open(conf)"><FileText :size="15" /></AppButton>
                                                <AppButton size="sm" icon-only class="theme-accent" title="Ver Ficha del Confirmando" aria-label="Ver Ficha del Confirmando" @click="perfilModalRef.abrir(conf.id)"><User :size="15" /></AppButton>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Tarjetas en móvil -->
                        <div v-else class="mg-cards">
                            <AppEmpty v-if="!confirmandosProcesados.length" :icon="User" message="Este grupo aún no tiene confirmandos.">
                                <AppButton v-if="canManageConfirmandos" size="sm" class="theme-accent"
                                    @click="asignarConfirmandosRef.open(grupo)">Gestionar inscripción</AppButton>
                            </AppEmpty>
                            <article v-for="(conf, i) in confirmandosProcesados" :key="conf.id" class="mg-card"
                                :class="conf.alerta?.claseFila">
                                <div class="mg-card__top">
                                    <div>
                                        <div class="fw-bold text-dark">{{ i + 1 }}. {{ conf.apellidos }}, {{ conf.nombres }}</div>
                                        <div class="small text-secondary d-flex align-items-center gap-1">
                                            <Phone :size="12" /> {{ conf.celular || 'Sin celular' }}
                                        </div>
                                    </div>
                                    <span v-if="conf.alerta" :class="['badge-alert-glow', conf.alerta.nivel_riesgo]">
                                        <AlertOctagon v-if="conf.alerta.nivel_riesgo === 'ALTO'" :size="12" />
                                        <AlertTriangle v-else :size="12" /> RIESGO
                                    </span>
                                </div>

                                <div class="mg-card__chips">
                                    <span class="badge bg-warning-subtle text-warning">{{ conf.total_faltas_justificadas || 0 }} Justif.</span>
                                    <span class="badge bg-info-subtle text-info">{{ conf.total_tardanzas || 0 }} Tardanzas</span>
                                    <span class="badge bg-light text-dark border">Progreso {{ countEntregados(conf.requisitos) }}/{{ conf.requisitos?.length || 0 }}</span>
                                </div>

                                <div class="mg-card__acciones">
                                    <AppButton variant="secondary" size="sm" :icon="ShieldCheck" @click="apoderadosModalRef.open(conf)">{{ conf.apoderados?.length || 0 }} apod.</AppButton>
                                    <span class="mg-card__spacer"></span>
                                    <AppButton size="sm" icon-only class="theme-accent" title="Editar" aria-label="Editar" @click="modalRef.open(conf.id)"><Pencil :size="15" /></AppButton>
                                    <AppButton size="sm" icon-only class="theme-accent" title="Requisitos" aria-label="Requisitos" @click="requisitosModalRef.open(conf)"><FileText :size="15" /></AppButton>
                                    <AppButton size="sm" icon-only class="theme-accent" title="Ficha" aria-label="Ficha" @click="perfilModalRef.abrir(conf.id)"><User :size="15" /></AppButton>
                                </div>
                            </article>
                        </div>
                    </div>
                </div>

                <!-- Panel Lateral (Catequistas) -->
                <div class="col-xl-4">
                    <div class="card border-0 shadow-sm rounded-4 p-4 mb-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold text-secondary small mb-0 d-flex align-items-center gap-1">
                                <User :size="16" /> Catequistas
                            </h6>
                            <AppButton v-if="canManageCatequistas" size="sm" class="theme-accent" @click="asignarCatequistasRef.open(grupo)">Editar</AppButton>
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
    </AppPage>
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

/* Los botones de acción de este grupo toman el color del grupo en vez del de la parroquia. */
.theme-accent {
    --accent: var(--theme-color);
    --accent-ring: color-mix(in srgb, var(--theme-color) 28%, transparent);
}

/* ===== Tarjetas (móvil) ===== */
.mg-cards { display: flex; flex-direction: column; }
.mg-card {
    padding: 0.85rem;
    border-top: 1px solid var(--line);
}
.mg-card:first-child { border-top: 0; }
.mg-card__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
}
.mg-card__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.55rem;
}
.mg-card__acciones {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.7rem;
}
.mg-card__spacer { flex: 1; }

.page-subtitle {
    font-size: var(--fs-sm);
    color: var(--text-muted);
}

.bg-theme-soft {
    background-color: var(--theme-soft) !important;
}

.rounded-4 {
    border-radius: var(--radius-xl) !important;
}

.hover-row {
    transition: background-color 0.2s ease;
}

.hover-row:hover td {
    background-color: var(--surface-sunken);
}

.hover-bg-light:hover {
    background-color: var(--surface-sunken);
}

.cursor-pointer {
    cursor: pointer;
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