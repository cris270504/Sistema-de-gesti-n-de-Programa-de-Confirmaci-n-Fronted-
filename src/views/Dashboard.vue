<script setup>
import { storeToRefs } from 'pinia';
import { useUsersStore } from '../stores/users';
import { useGruposStore } from '../stores/grupos';
import { useConfirmandosStore } from '../stores/confirmandos';
import { onMounted, computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useReunionesStore } from '../stores/reunions';
import { CalendarIcon, ArrowDownCircleIcon, ChatBubbleLeftRightIcon, ExclamationTriangleIcon, ClockIcon, MapPinIcon, UserGroupIcon } from '@heroicons/vue/24/outline';
import { CircleAlert, User } from 'lucide-vue-next';
import { showAlerta, confirmar } from '@/funciones';
import PerfilConfirmandoModal from '@/components/Modals/PerfilConfirmandoModal.vue'; // ➔ NUEVO: Importamos el componente del modal

const authStore = useAuthStore();
const confirmandosStore = useConfirmandosStore();
const { fetchAll: fetchConfirmandos } = confirmandosStore;
const { items: confirmandosRaw, count: cantConfirmandos, stats: metricas } = storeToRefs(confirmandosStore);

const usersStore = useUsersStore();
const { fetchAll: fetchUsers } = usersStore;
const { count: cantUsers } = storeToRefs(usersStore);

const gruposStore = useGruposStore();
const { fetchAll: fetchGrupos } = gruposStore;
const { count: cantGrupos } = storeToRefs(gruposStore);

const reunionesStore = useReunionesStore();
const { fetchUpcoming } = reunionesStore;
const { upcomingItems, loading: loadingReuniones } = storeToRefs(reunionesStore);

// ➔ NUEVO: Referencia para el modal
const perfilModalRef = ref(null);

const esGestor = authStore.can('ver usuarios');

onMounted(() => {
  if (authStore.can('ver confirmandos')) fetchConfirmandos();
  if (authStore.can('ver usuarios')) fetchUsers();
  if (authStore.can('ver grupos')) fetchGrupos();
  if (authStore.can('ver cronograma')) fetchUpcoming();
});

const confirmandosAlerta = computed(() => {
  const data = confirmandosRaw.value || [];

  return data.map(c => {
    const asistencias = c.asistencias || [];

    // 1. ORDENAR ASISTENCIAS POR FECHA (De la más antigua a la más reciente)
    const asistenciasOrdenadas = [...asistencias].sort((a, b) => {
      return new Date(a.reunion?.fecha || a.created_at) - new Date(b.reunion?.fecha || b.created_at);
    });

    // 2. CONTADORES DINÁMICOS Y DETECCIÓN DE CONSECUTIVAS
    let maxInjustificadasSeguidas_Historico = 0; // La peor racha que tuvo en el año
    let rachaActiva = 0; // La racha EXACTA con la que terminó su última reunión registrada

    const conteo = asistenciasOrdenadas.reduce((acc, curr) => {
      const tieneAcuerdoPendiente = curr.justificacion?.estado === 'pendiente';

      // Si es falta injustificada pura (y no está en trámite)
      if (curr.estado === 'falta injustificada' && !tieneAcuerdoPendiente) {
        acc.faltas_injustificadas++;
        rachaActiva++; // La racha viva sigue creciendo

        if (rachaActiva > maxInjustificadasSeguidas_Historico) {
          maxInjustificadasSeguidas_Historico = rachaActiva;
        }
      }
      // Si asiste, llega tarde, justifica o hace acuerdo -> LA RACHA ACTIVA SE ROMPE
      else {
        rachaActiva = 0;
      }

      // Sumatorias totales
      if (curr.estado === 'falta justificada') acc.faltas_justificadas++;
      if (curr.estado === 'tardanza') acc.tardanzas++;

      return acc;
    }, { faltas_injustificadas: 0, faltas_justificadas: 0, tardanzas: 0 });

    // 3. DETERMINAR NIVEL DE RIESGO Y MOTIVO (SEMÁFORO MEJORADO)
    let nivelRiesgo = 'NINGUNO';
    let motivoAlerta = '';

    // PRIORIDAD 1: Regla de Expulsión por Acumulación Total (Peligro Inminente)
    if (conteo.faltas_injustificadas >= 4) {
      nivelRiesgo = 'ALTO';
      motivoAlerta = `Alerta Crítica: ${conteo.faltas_injustificadas} faltas injustificadas ACUMULADAS.`;
    }
    // PRIORIDAD 2: Regla de Expulsión por Racha ACTIVA (Está a una falta de irse)
    else if (rachaActiva >= 2) {
      nivelRiesgo = 'ALTO';
      motivoAlerta = `Alerta Crítica: ${rachaActiva} faltas injustificadas en sus ÚLTIMAS reuniones (Riesgo inminente).`;
    }
    // PRIORIDAD 3: El "Olvido". Tuvo 3 seguidas en el pasado, rompió la regla, pero nadie lo sacó.
    else if (maxInjustificadasSeguidas_Historico >= 3) {
      nivelRiesgo = 'ALTO';
      motivoAlerta = `Alerta Crítica: Tuvo ${maxInjustificadasSeguidas_Historico} faltas seguidas en el pasado y no fue retirado.`;
    }
    // RIESGO NARANJA: Acumulación peligrosa de Justificadas
    else if (conteo.faltas_justificadas >= 4) {
      nivelRiesgo = 'MEDIO';
      motivoAlerta = `Alerta de Desconexión: Tiene ${conteo.faltas_justificadas} faltas justificadas. Está perdiendo el hilo.`;
    }
    // RIESGO AMARILLO: Problema de puntualidad
    else if (conteo.tardanzas >= 4) {
      nivelRiesgo = 'BAJO';
      motivoAlerta = `Alerta de Impuntualidad: Acumula ${conteo.tardanzas} tardanzas. Requiere llamado de atención.`;
    }

    const apoderado = c.apoderados && c.apoderados.length > 0 ? c.apoderados[0] : null;

    return {
      ...c,
      nombre_completo: `${c.apellidos}, ${c.nombres}`,
      total_faltas_injustificadas: conteo.faltas_injustificadas,
      total_faltas_justificadas: conteo.faltas_justificadas,
      total_tardanzas: conteo.tardanzas,
      injustificadas_seguidas: rachaActiva, 
      racha_historica: maxInjustificadasSeguidas_Historico,
      nivel_riesgo: nivelRiesgo,
      motivo_alerta: motivoAlerta,
      nombre_apoderado: apoderado ? `${apoderado.apellidos}, ${apoderado.nombres}` : 'No asignado',
      celular_apoderado: apoderado ? apoderado.celular : c.celular
    };
  }).filter(c => {
    const cumpleRol = esGestor || c.grupo_id === authStore.user?.grupo_id;
    const estaActivo = c.estado !== 'retirado';
    const tieneAlerta = c.nivel_riesgo !== 'NINGUNO';
    return cumpleRol && estaActivo && tieneAlerta;
  });
});

const listaCatequistas = computed(() => {
  const usuarios = usersStore.items || [];
  return usuarios.filter(u => u.roles && u.roles.includes('catequista'));
});

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
      await fetchConfirmandos();
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
              <h2 class="fw-bold mb-0 text-info">{{ cantConfirmandos }}</h2>
              <p class="text-muted small mb-0">Confirmandos</p>
              <RouterLink :to="{ name: 'confirmandos' }" class="stretched-link"></RouterLink>
            </div>
          </div>
          <div v-if="authStore.can('ver usuarios')" class="col-sm-4">
            <div class="card border-0 shadow-sm rounded-4 text-center p-3">
              <h2 class="fw-bold mb-0 text-success">{{ cantUsers }}</h2>
              <p class="text-muted small mb-0">Usuarios</p>
              <RouterLink :to="{ name: 'users' }" class="stretched-link"></RouterLink>
            </div>
          </div>
          <div v-if="authStore.can('ver grupos')" class="col-sm-4">
            <div class="card border-0 shadow-sm rounded-4 text-center p-3">
              <h2 class="fw-bold mb-0 text-warning">{{ cantGrupos }}</h2>
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
                        <span v-if="esGestor">{{ c.grupo?.nombre || 'Sin grupo' }}</span>
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