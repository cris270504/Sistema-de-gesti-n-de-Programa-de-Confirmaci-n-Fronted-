<script setup>
import AppEmpty from '@/components/AppEmpty.vue'
import AppButton from '@/components/AppButton.vue'
import { storeToRefs } from 'pinia';
import { onMounted, computed, ref, watch } from 'vue';

import { useAuthStore } from '@/stores/auth';
import { useParroquiaStore } from '@/stores/parroquia';
import { useDashboardStore } from '../stores/dashboard';
import { useReunionesStore } from '../stores/reunions';
import { useConfirmandosStore } from '../stores/confirmandos';

import { Calendar, MessagesSquare, TriangleAlert, Clock, MapPin, CircleAlert, User, Instagram, Facebook, MessageCircle, CircleCheck } from 'lucide-vue-next';
import PerfilConfirmandoModal from '@/components/Modals/PerfilConfirmandoModal.vue';
import AppPage from '@/components/AppPage.vue';
import AppSkeleton from '@/components/AppSkeleton.vue';
import { useMediaQuery } from '@/composables/useMediaQuery';

const esMovil = useMediaQuery('(max-width: 767px)');

// 1. Instancias
const authStore = useAuthStore();
const parroquiaStore = useParroquiaStore();
const esGestor = authStore.can('ver usuarios');

// Subtítulo del panel: programa de la parroquia + año en curso (sin año fijo en el código).
const subtituloPanel = computed(() => `Programa de ${parroquiaStore.programaNombre} · ${new Date().getFullYear()}`);

// Un KPI se muestra si el usuario tiene el permiso Y la parroquia lo dejó activo
// en Configuración (parroquiaStore.dashboardKpis). La config puede ocultar, nunca revelar.
const verKpi = (clave, permiso) => authStore.can(permiso) && parroquiaStore.dashboardKpis.includes(clave);

// Ídem para los bloques del panel (combinar con el gate de rol donde exista).
const verPanel = (clave) => parroquiaStore.dashboardPaneles.includes(clave);

// Retirar del programa (baja formal) es exclusivo de coordinador / super-admin.
// El backend ya exige `eliminar confirmandos`; acá ocultamos la UF correspondiente.
const puedeRetirar = computed(() => authStore.can('eliminar confirmandos'));

const dashboardStore = useDashboardStore();
const { metricas, alertas, loading: loadingDashboard } = storeToRefs(dashboardStore);

const reunionesStore = useReunionesStore();
const { fetchUpcoming } = reunionesStore;
const { upcomingItems, loading: loadingReuniones } = storeToRefs(reunionesStore);

const confirmandosStore = useConfirmandosStore();
const perfilModalRef = ref(null);

// 2. Carga Inicial ULTRA RÁPIDA (Solo lo estrictamente necesario)
onMounted(() => {
  dashboardStore.fetchMetricas(); // Trae números y alertas masticadas en 1 sola petición

  if (authStore.can('ver cronograma') && upcomingItems.value.length === 0) {
      fetchUpcoming(); // Trae solo las reuniones futuras
  }
});

// 3. Propiedades Computadas
// El backend ahora manda grupo_id en cada alerta, así que comparamos por id numérico
// (más robusto que comparar strings de nombre: no se rompe por tildes/mayúsculas/espacios).
const confirmandosAlerta = computed(() => {
  const dataAlertas = alertas.value || [];
  const misGrupos = (authStore.user?.grupo_ids || []).map(Number);

  return dataAlertas.filter(alerta => {
    // El gestor ve todas las alertas. El catequista solo ve las de sus propios grupos.
    return esGestor || misGrupos.includes(Number(alerta.grupo_id));
  });
});

// --- FILTRO POR GRUPO DENTRO DE "SEGUIMIENTO CRÍTICO" ---
const grupoFiltro = ref('todos');

// Solo listamos grupos que YA tienen alguna alerta visible para este usuario
// (evita ofrecer opciones que siempre van a mostrar "sin resultados").
const gruposConAlerta = computed(() => {
  const conteo = new Map();
  confirmandosAlerta.value.forEach(c => {
    const nombre = c.grupo || 'Sin grupo';
    conteo.set(nombre, (conteo.get(nombre) || 0) + 1);
  });
  return [...conteo.entries()]
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
});

// Si el grupo seleccionado deja de tener alertas (se resolvieron, o recargó la data),
// volvemos a "todos" en vez de dejar el select apuntando a una opción que ya no existe.
watch(gruposConAlerta, (grupos) => {
  if (grupoFiltro.value !== 'todos' && !grupos.some(g => g.nombre === grupoFiltro.value)) {
    grupoFiltro.value = 'todos';
  }
});

const alertasFiltradas = computed(() => {
  if (grupoFiltro.value === 'todos') return confirmandosAlerta.value;
  return confirmandosAlerta.value.filter(c => (c.grupo || 'Sin grupo') === grupoFiltro.value);
});

// 4. Métodos
const confirmarRetiroJoven = async (joven) => {
  // registrarRetiro ya pide el motivo (y sirve de confirmación).
  const exito = await confirmandosStore.registrarRetiro(joven.id, joven.nombre_completo);
  if (exito) {
    await dashboardStore.fetchMetricas({ force: true });
  }
};
</script>

<template>
  <AppPage title="Panel de control" :subtitle="subtituloPanel" :wide="true">
    <template #actions>
      <a href="https://www.instagram.com/confirmacion_scj/" target="_blank" rel="noopener noreferrer"
        class="dash-social" aria-label="Instagram de la parroquia">
        <Instagram :size="16" aria-hidden="true" />Instagram</a>
      <a href="https://www.facebook.com/profile.php?id=61588086533946" target="_blank" rel="noopener noreferrer"
        class="dash-social" aria-label="Facebook de la parroquia">
        <Facebook :size="16" aria-hidden="true" />Facebook</a>
    </template>

    <div class="row g-4">
      <!-- COLUMNA PRINCIPAL (IZQUIERDA) -->
      <div class="col-xl-8">

        <!-- RESUMEN NUMÉRICO (CARDS MINI) -->
        <div class="row g-3 mb-4">
          <div v-if="verKpi('confirmandos', 'ver todos los confirmandos')" class="col-sm-4">
            <div class="card border-0 shadow-sm rounded-4 text-center p-3">
              <h2 class="fw-bold mb-0 text-info">{{ metricas.activos }}</h2>
              <p class="text-muted small mb-0">{{ parroquiaStore.personaLabelPlural }}</p>
              <RouterLink :to="{ name: 'confirmandos' }" class="stretched-link"></RouterLink>
            </div>
          </div>
          <div v-if="verKpi('usuarios', 'ver usuarios')" class="col-sm-4">
            <div class="card border-0 shadow-sm rounded-4 text-center p-3">
              <h2 class="fw-bold mb-0 text-success">{{ metricas.cant_users }}</h2>
              <p class="text-muted small mb-0">Usuarios</p>
              <RouterLink :to="{ name: 'users' }" class="stretched-link"></RouterLink>
            </div>
          </div>
          <div v-if="verKpi('grupos', 'ver todos los grupos')" class="col-sm-4">
            <div class="card border-0 shadow-sm rounded-4 text-center p-3">
              <h2 class="fw-bold mb-0 text-warning">{{ metricas.cant_grupos }}</h2>
              <p class="text-muted small mb-0">Grupos</p>
              <RouterLink :to="{ name: 'grupos' }" class="stretched-link"></RouterLink>
            </div>
          </div>
        </div>

        <!-- TABLA DE ALERTAS -->
        <div v-if="verPanel('seguimiento_critico')" class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
          <div class="card-header bg-white py-3 border-0 d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div class="d-flex align-items-center">
              <TriangleAlert class="h-5 w-5 text-danger me-2" aria-hidden="true" />
              <h6 class="mb-0 fw-bold">Seguimiento Crítico</h6>
              <span v-if="confirmandosAlerta.length > 0"
                class="badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle ms-2">
                {{ alertasFiltradas.length }}
              </span>
            </div>

            <select v-if="gruposConAlerta.length > 1" v-model="grupoFiltro"
              class="form-select form-select-sm w-auto" aria-label="Filtrar seguimiento crítico por grupo">
              <option value="todos">Todos los grupos ({{ confirmandosAlerta.length }})</option>
              <option v-for="g in gruposConAlerta" :key="g.nombre" :value="g.nombre">
                {{ g.nombre }} ({{ g.total }})
              </option>
            </select>
          </div>
          <div v-if="loadingDashboard" class="p-3">
            <AppSkeleton skeleton="table" />
          </div>
          <div v-else-if="!esMovil" class="table-responsive cards-sm">
            <table class="table table-hover align-middle mb-0">
              <thead class="bg-light text-muted small">
                <tr>
                  <th class="ps-4">Nombre</th>
                  <th>Situación</th>
                  <th>Apoderado / WhatsApp</th>
                  <th
                    v-if="puedeRetirar && alertasFiltradas.some(c => c.injustificadas_seguidas >= 3 || c.total_faltas_injustificadas >= 5)">
                    RETIRO</th>
                </tr>
              </thead>
              <tbody class="small">
                <tr v-for="c in alertasFiltradas" :key="c.id">
                  <td class="ps-4">
                    <!-- ➔ NUEVO: Contenedor flexible para alinear el botón y el nombre -->
                    <div class="d-flex align-items-start gap-2">
                      <AppButton
                        variant="secondary"
                        size="sm"
                        icon-only
                        class="flex-shrink-0 mt-1"
                        @click="perfilModalRef.abrir(c.id)"
                        title="Ver Ficha Completa"
                        aria-label="Ver Ficha Completa"><User :size="14" /></AppButton>

                      <div>
                        <div class="fw-bold fs-6">
                          {{ c.nombre_completo }}
                        </div>
                        <span v-if="esGestor">{{ c.grupo || 'Sin grupo' }}</span>
                        <div class="small mt-0.5" :class="{ 'text-danger fw-semibold': c.nivel_riesgo === 'ALTO', 'text-warning-custom': c.nivel_riesgo === 'MEDIO', 'text-muted': c.nivel_riesgo === 'BAJO' }">
                          {{ c.motivo_alerta }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <span class="badge bg-warning-subtle text-warning border border-warning-subtle me-1">
                        {{ c.total_faltas_justificadas }} Falta(s) justificada(s)
                      </span>
                    </div>
                    <div class="mt-1">
                      <span class="badge bg-info-subtle text-info border border-info-subtle">
                        {{ c.total_tardanzas }} Tardanza(s)
                      </span>
                    </div>
                  </td>
                  <td>
                    <div class="fw-bold">{{ c.nombre_apoderado }}</div>
                    <a :href="'https://wa.me/51' + c.celular_apoderado" target="_blank"
                      class="text-success text-decoration-none">
                      <!-- lucide-vue-next no incluye el logo de WhatsApp (no es una librería de
                           íconos de marca) — se usa un ícono de chat genérico en su lugar. -->
                      <MessageCircle class="h-4 w-4 me-1 d-inline-block align-text-bottom" aria-hidden="true" />{{ c.celular_apoderado }}
                    </a>
                  </td>
                  <td v-if="puedeRetirar && (c.injustificadas_seguidas >= 3 || c.total_faltas_injustificadas >= 5)" class="text-center">
                    <AppButton
                      variant="soft"
                      tone="danger"
                      size="sm"
                      icon-only
                      type="button"
                      @click="confirmarRetiroJoven(c)"
                      title="Dar de baja y retirar del programa"
                      aria-label="Dar de baja y retirar del programa"><CircleAlert class="h-5 w-5 text-danger" /></AppButton>
                  </td>
                </tr>
                <!-- Mensaje si no hay alertas -->
                <tr v-if="alertasFiltradas.length === 0">
                  <td colspan="4">
                    <AppEmpty compact :icon="CircleCheck"
                      :message="grupoFiltro !== 'todos' ? `No hay alertas críticas en ${grupoFiltro} en este momento.` : 'Todo en orden: no hay alertas críticas en este momento.'" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tarjetas en móvil -->
          <div v-else class="dash-cards">
            <AppEmpty v-if="alertasFiltradas.length === 0" compact :icon="CircleCheck"
              message="Todo en orden: no hay alertas críticas." />
            <article v-for="c in alertasFiltradas" :key="c.id" class="dash-card">
              <div class="dash-card__top">
                <AppButton
                  variant="secondary"
                  size="sm"
                  icon-only
                  class="flex-shrink-0"
                  @click="perfilModalRef.abrir(c.id)"
                  title="Ver ficha"
                  aria-label="Ver ficha"><User :size="14" /></AppButton>
                <div class="flex-grow-1">
                  <div class="fw-bold">{{ c.nombre_completo }}</div>
                  <div v-if="esGestor" class="small text-muted">{{ c.grupo || 'Sin grupo' }}</div>
                  <div class="small mt-1" :class="{ 'text-danger fw-semibold': c.nivel_riesgo === 'ALTO', 'text-warning-custom': c.nivel_riesgo === 'MEDIO', 'text-muted': c.nivel_riesgo === 'BAJO' }">{{ c.motivo_alerta }}</div>
                </div>
                <AppButton
                  v-if="puedeRetirar && (c.injustificadas_seguidas >= 3 || c.total_faltas_injustificadas >= 5)"
                  variant="soft"
                  tone="danger"
                  size="sm"
                  icon-only
                  class="flex-shrink-0"
                  type="button"
                  @click="confirmarRetiroJoven(c)"
                  title="Retirar del programa"
                  aria-label="Retirar del programa"><CircleAlert class="h-5 w-5 text-danger" /></AppButton>
              </div>

              <div class="dash-card__chips">
                <span class="badge bg-warning-subtle text-warning border border-warning-subtle">{{ c.total_faltas_justificadas }} justif.</span>
                <span class="badge bg-info-subtle text-info border border-info-subtle">{{ c.total_tardanzas }} tardanzas</span>
              </div>

              <a :href="'https://wa.me/51' + c.celular_apoderado" target="_blank"
                class="dash-card__wa text-success text-decoration-none">
                <MessageCircle class="h-4 w-4 me-1 d-inline-block align-text-bottom" aria-hidden="true" />
                {{ c.nombre_apoderado }} · {{ c.celular_apoderado }}
              </a>
            </article>
          </div>
        </div>

        <div v-if="verPanel('proximos_encuentros')" class="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden">
          <div class="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center">
            <h6 class="mb-0 fw-bold d-flex align-items-center">
              <Calendar class="h-5 w-5 text-primary me-2" aria-hidden="true" />Próximos Encuentros
            </h6>
            <AppButton variant="soft" size="sm" to="/cronograma">Calendario completo</AppButton>
          </div>
          <div class="card-body p-0">
            <div v-if="loadingReuniones" class="p-3">
              <AppSkeleton skeleton="cards" />
            </div>
            <div v-else class="list-group list-group-flush">
              <div v-for="actividad in upcomingItems" :key="actividad.id"
                class="list-group-item p-4 border-light-subtle bg-transparent">
                <div class="row align-items-center">
                  <div class="col-auto">
                    <div class="bg-primary text-white rounded-4 p-2 text-center shadow-sm" style="min-width: 65px;">
                      <span class="d-block fw-bold fs-4">{{ new Date(actividad.fecha).getDate() }}</span>
                      <span class="small">{{ new Date(actividad.fecha).toLocaleString('es', {
                        month: 'short'
                      }) }}</span>
                    </div>
                  </div>
                  <div class="col">
                    <h6 class="fw-bold mb-1">{{ actividad.nombre_tema }}</h6>
                    <div class="d-flex gap-3 text-muted small">
                      <span>
                        <Clock class="h-4 w-4 d-inline mb-1" aria-hidden="true" /> {{ new
                          Date(actividad.fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) }}
                      </span>
                      <span>
                        <MapPin class="h-4 w-4 d-inline mb-1" aria-hidden="true" /> {{ actividad.tipo || 'Salón Parroquial' }}
                      </span>
                    </div>
                  </div>
                  <div class="col-auto text-end d-none d-md-block">
                    <span class="badge rounded-pill bg-primary-subtle text-primary px-3">Actividad Confirmada</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- COLUMNA LATERAL (DERECHA) -->
      <div class="col-xl-4">
        <!-- MÉTRICAS DE PROGRESO (solo coordinador / super-admin) -->
        <div class="card border-0 shadow-sm rounded-4 p-4 mb-4" v-if="esGestor && verPanel('retencion')">
          <h6 class="fw-bold text-muted small mb-3">Estado de Retención</h6>
          <div class="mb-4">
            <div class="d-flex justify-content-between mb-1">
              <span class="small fw-bold">Índice de Retención</span>
              <span class="small fw-bold text-success">{{ metricas.tasaRetencion }}%</span>
            </div>
            <div class="progress rounded-pill" style="height: 8px;">
              <div class="progress-bar bg-success" :style="{ width: metricas.tasaRetencion + '%' }"></div>
            </div>
          </div>
          <div class="mb-1">
            <div class="d-flex justify-content-between mb-1">
              <span class="small fw-bold">Tasa de Deserción</span>
              <span class="small fw-bold text-danger">{{ metricas.tasaDesercion }}%</span>
            </div>
            <div class="progress rounded-pill" style="height: 8px;">
              <div class="progress-bar bg-danger" :style="{ width: metricas.tasaDesercion + '%' }"></div>
            </div>
          </div>
          <hr class="text-muted opacity-25">
          <div class="d-flex justify-content-between text-muted" style="font-size: 0.75rem;">
            <span><strong>{{ metricas.activos }}</strong> Activos</span>
            <span><strong>{{ metricas.retirados }}</strong> Retirados</span>
          </div>
        </div>

        <!-- AVISOS RÁPIDOS -->
        <div class="p-4 rounded-4 bg-primary text-white shadow-sm mb-4">
          <div class="d-flex align-items-center mb-2">
            <MessagesSquare class="h-5 w-5 me-2" aria-hidden="true" />
            <span class="fw-bold small">Recordatorio</span>
          </div>
          <p class="small mb-0 opacity-75">Registra la asistencia al terminar la reunión para mantener las métricas
            actualizadas.</p>
        </div>
      </div>
    </div>

    <PerfilConfirmandoModal ref="perfilModalRef" />
  </AppPage>
</template>

<style scoped>
/* ===== Tarjetas de alertas (móvil) ===== */
.dash-cards { display: flex; flex-direction: column; }
.dash-card {
  padding: 0.85rem;
  border-top: 1px solid var(--line);
}
.dash-card:first-child { border-top: 0; }
.dash-card__top {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.dash-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0.55rem 0 0;
}
.dash-card__wa {
  display: inline-flex;
  align-items: center;
  margin-top: 0.5rem;
  font-size: var(--fs-sm);
  font-weight: 600;
}

.rounded-4 {
  border-radius: var(--radius-xl) !important;
}

.card {
  transition: transform 0.2s;
}

.list-group-item {
  background: transparent;
}

.bg-light-subtle {
  background-color: var(--surface-sunken) !important;
}

.dash-social {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  color: var(--text-muted);
  text-decoration: none;
}
.dash-social:hover { color: var(--accent); }
</style>
