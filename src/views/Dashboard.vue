<script setup>
import { storeToRefs } from 'pinia';
import { onMounted, computed, ref } from 'vue';

import { useAuthStore } from '@/stores/auth';
import { useDashboardStore } from '../stores/dashboard';
import { useReunionesStore } from '../stores/reunions';
import { useConfirmandosStore } from '../stores/confirmandos';

import { CalendarIcon, ChatBubbleLeftRightIcon, ExclamationTriangleIcon, ClockIcon, MapPinIcon } from '@heroicons/vue/24/outline';
import { CircleAlert, User } from 'lucide-vue-next';
import { confirmar } from '@/funciones';
import PerfilConfirmandoModal from '@/components/Modals/PerfilConfirmandoModal.vue';

// 1. Instancias
const authStore = useAuthStore();
const esGestor = authStore.can('ver usuarios');

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
// Reemplazamos las 60 líneas de lógica pesada por un simple filtro de seguridad
const confirmandosAlerta = computed(() => {
  const dataAlertas = alertas.value || [];
  
  return dataAlertas.filter(alerta => {
    // El gestor ve todas las alertas. El catequista solo ve las de su propio grupo.
    return esGestor || alerta.grupo_id === authStore.user?.grupo_id;
  });
});

// 4. Métodos
const confirmarRetiroJoven = async (joven) => {
  const confirmado = await confirmar({
    titulo: '¿Retirar confirmando del programa?',
    texto: `Estás a punto de registrar la baja formal de ${joven.nombre_completo} debido a la acumulación crítica de inasistencias.`,
    icono: 'warning',
    confirmarTexto: 'Sí, retirar del programa',
    cancelarTexto: 'Cancelar'
  });

  if (confirmado) {
    const exito = await confirmandosStore.registrarRetiro(joven.id, joven.nombre_completo);
    if (exito) {
      // ➔ CORRECCIÓN CRÍTICA: En lugar de descargar los 458kB de confirmandos de nuevo,
      // simplemente actualizamos las métricas del dashboard.
      await dashboardStore.fetchMetricas();
    }
  }
};
</script>

<template>
  <main class="container-fluid p-3 p-lg-4 bg-light min-vh-100">
    <!-- HEADER COMPACTO -->
    <header class="row mb-4 align-items-center g-3">
      <div class="col-md-auto">
        <img src="@/assets/logo.png" alt="Logo" class="d-none d-md-block" style="height: 120px; width: auto;" />
      </div>
      <div class="col-md">
        <h1 class="h4 mb-0 fw-bold">Panel de Control <span class="fw-normal text-muted fs-6">/ Confirmación 2026</span>
        </h1>
        <div class="d-flex gap-3 mt-1">
          <a href="https://www.instagram.com/confirmacion_scj/" target="_blank"
            class="text-danger small text-decoration-none"><i class="bi bi-instagram me-1"></i>Instagram</a>
          <a href="https://www.facebook.com/profile.php?id=61588086533946" target="_blank"
            class="text-primary small text-decoration-none"><i class="bi bi-facebook me-1"></i>Facebook</a>
        </div>
      </div>
      <div class="col-md-auto ms-auto text-end">
        <span class="badge bg-white text-primary border border-primary-subtle px-3 py-2 rounded-pill shadow-sm">Periodo
          Activo</span>
      </div>
    </header>

    <div class="row g-4">
      <!-- COLUMNA PRINCIPAL (IZQUIERDA) -->
      <div class="col-xl-8">

        <!-- RESUMEN NUMÉRICO (CARDS MINI) -->
        <div class="row g-3 mb-4">
          <div v-if="authStore.can('ver confirmandos')" class="col-sm-4">
            <div class="card border-0 shadow-sm rounded-4 text-center p-3">
              <h2 class="fw-bold mb-0 text-info">{{ metricas.cant_confirmandos }}</h2>
              <p class="text-muted small mb-0">Confirmandos</p>
              <RouterLink :to="{ name: 'confirmandos' }" class="stretched-link"></RouterLink>
            </div>
          </div>
          <div v-if="authStore.can('ver usuarios')" class="col-sm-4">
            <div class="card border-0 shadow-sm rounded-4 text-center p-3">
              <h2 class="fw-bold mb-0 text-success">{{ metricas.cant_users }}</h2>
              <p class="text-muted small mb-0">Usuarios</p>
              <RouterLink :to="{ name: 'users' }" class="stretched-link"></RouterLink>
            </div>
          </div>
          <div v-if="authStore.can('ver grupos')" class="col-sm-4">
            <div class="card border-0 shadow-sm rounded-4 text-center p-3">
              <h2 class="fw-bold mb-0 text-warning">{{ metricas.cant_grupos }}</h2>
              <p class="text-muted small mb-0">Grupos</p>
              <RouterLink :to="{ name: 'grupos' }" class="stretched-link"></RouterLink>
            </div>
          </div>
        </div>

        <!-- TABLA DE ALERTAS -->
        <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
          <div class="card-header bg-white py-3 border-0 d-flex align-items-center">
            <ExclamationTriangleIcon class="h-5 w-5 text-danger me-2" />
            <h6 class="mb-0 fw-bold">Seguimiento Crítico</h6>
          </div>
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="bg-light text-muted small text-uppercase">
                <tr>
                  <th class="ps-4">Nombre</th>
                  <th>Situación</th>
                  <th>Apoderado / WhatsApp</th>
                  <th
                    v-if="confirmandosAlerta.some(c => c.injustificadas_seguidas >= 3 || c.total_faltas_injustificadas >= 5)">
                    RETIRO</th>
                </tr>
              </thead>
              <tbody class="small">
                <tr v-for="c in confirmandosAlerta" :key="c.id">
                  <td class="ps-4">
                    <!-- ➔ NUEVO: Contenedor flexible para alinear el botón y el nombre -->
                    <div class="d-flex align-items-start gap-2">
                      <button @click="perfilModalRef.abrir(c.id)"
                        class="btn btn-sm btn-light text-secondary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 mt-1"
                        style="width: 28px; height: 28px;" title="Ver Ficha Completa">
                        <User :size="14" />
                      </button>

                      <div>
                        <div class="fw-bold fs-6">
                          {{ c.nombre_completo }}
                        </div>
                        <span v-if="esGestor">{{ c.grupo || 'Sin grupo' }}</span>
                        <div class="small mt-0.5" :class="{
                          'text-danger fw-semibold': c.nivel_riesgo === 'ALTO',
                          'text-warning-custom': c.nivel_riesgo === 'MEDIO',
                          'text-muted': c.nivel_riesgo === 'BAJO'
                        }">
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
                      <i class="bi bi-whatsapp me-1"></i>{{ c.celular_apoderado }}
                    </a>
                  </td>
                  <td v-if="c.injustificadas_seguidas >= 3 || c.total_faltas_injustificadas >= 5" class="text-center">
                    <button type="button" @click="confirmarRetiroJoven(c)"
                      class="btn btn-sm btn-link p-1 rounded-circle hover-danger-btn d-inline-flex align-items-center justify-content-center"
                      style="width: 32px; height: 32px;" title="Dar de baja y retirar del programa">
                      <CircleAlert class="h-5 w-5 text-danger" />
                    </button>
                  </td>
                </tr>
                <!-- Mensaje si no hay alertas -->
                <tr v-if="confirmandosAlerta.length === 0">
                  <td colspan="4" class="text-center py-4 text-muted">
                    Todo en orden. No hay alertas críticas en este momento.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden">
          <div class="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center">
            <h6 class="mb-0 fw-bold d-flex align-items-center">
              <CalendarIcon class="h-5 w-5 text-primary me-2" />Próximos Encuentros
            </h6>
            <router-link to="/cronograma"
              class="btn btn-sm btn-primary-subtle text-primary rounded-pill px-3 fw-bold border-0">
              Calendario completo
            </router-link>
          </div>
          <div class="card-body p-0">
            <div v-if="loadingReuniones" class="p-5 text-center">
              <div class="spinner-border spinner-border-sm text-primary"></div>
            </div>
            <div v-else class="list-group list-group-flush">
              <div v-for="actividad in upcomingItems" :key="actividad.id"
                class="list-group-item p-4 border-light-subtle bg-transparent">
                <div class="row align-items-center">
                  <div class="col-auto">
                    <div class="bg-primary text-white rounded-4 p-2 text-center shadow-sm" style="min-width: 65px;">
                      <span class="d-block fw-bold fs-4">{{ new Date(actividad.fecha).getDate() }}</span>
                      <span class="small text-uppercase">{{ new Date(actividad.fecha).toLocaleString('es', {
                        month: 'short'
                      }) }}</span>
                    </div>
                  </div>
                  <div class="col">
                    <h6 class="fw-bold mb-1">{{ actividad.nombre_tema }}</h6>
                    <div class="d-flex gap-3 text-muted small">
                      <span>
                        <ClockIcon class="h-4 w-4 d-inline mb-1" /> {{ new
                          Date(actividad.fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) }}
                      </span>
                      <span>
                        <MapPinIcon class="h-4 w-4 d-inline mb-1" /> {{ actividad.tipo || 'Salón Parroquial' }}
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
        <!-- MÉTRICAS DE PROGRESO -->
        <div class="card border-0 shadow-sm rounded-4 p-4 mb-4" v-if="authStore.can('ver confirmandos')">
          <h6 class="fw-bold text-muted text-uppercase small mb-3">Estado de Retención</h6>
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
            <ChatBubbleLeftRightIcon class="h-5 w-5 me-2" />
            <span class="fw-bold small">Recordatorio</span>
          </div>
          <p class="small mb-0 opacity-75">Registra la asistencia al terminar la reunión para mantener las métricas
            actualizadas.</p>
        </div>
      </div>
    </div>
  </main>

  <!-- ➔ NUEVO: Componente inyectado al final del template -->
  <PerfilConfirmandoModal ref="perfilModalRef" />
</template>

<style scoped>
.rounded-4 {
  border-radius: 1rem !important;
}

.card {
  transition: transform 0.2s;
}

.list-group-item {
  background: transparent;
}

.bg-light-subtle {
  background-color: #f8fafc !important;
}

.btn-primary-subtle {
  background-color: #e7f0fe !important;
  /* El azul suave que usas en los badges */
  transition: all 0.2s ease;
}

.btn-primary-subtle:hover {
  background-color: #d1e3fd !important;
  /* Un tono ligeramente más oscuro al pasar el mouse */
  color: #0d6efd !important;
}
</style>