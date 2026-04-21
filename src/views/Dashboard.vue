<script setup>
import { storeToRefs } from 'pinia';
import { useUsersStore } from '../stores/users';
import { useGruposStore } from '../stores/grupos';
import { useConfirmandosStore } from '../stores/confirmandos';
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useReunionesStore } from '../stores/reunions';
import { CalendarIcon } from '@heroicons/vue/24/outline';

const authStore = useAuthStore();

// 1. PRIMERO inicializamos el store
const confirmandosStore = useConfirmandosStore();
// 2. DESPUÉS extraemos las referencias (incluyendo metricas/stats)
const { fetchAll: fetchConfirmandos } = confirmandosStore;
const { 
    count: cantConfirmandos, 
    loading: loadingConfirmandos, 
    stats: metricas // Este es el getter que agregamos al store
} = storeToRefs(confirmandosStore);

const usersStore = useUsersStore();
const { fetchAll: fetchUsers } = usersStore;
const { count: cantUsers, loading: loadingUsers } = storeToRefs(usersStore);

const gruposStore = useGruposStore();
const { fetchAll: fetchGrupos } = gruposStore;
const { count: cantGrupos, loading: loadingGrupos } = storeToRefs(gruposStore);

const reunionesStore = useReunionesStore();
const { fetchUpcoming } = reunionesStore;
const { upcomingItems, loading: loadingReuniones } = storeToRefs(reunionesStore);

// UNIFICAMOS onMounted en uno solo y corregimos errores de lógica
onMounted(() => {
  if (authStore.can('ver confirmandos')) fetchConfirmandos();
  if (authStore.can('ver usuarios')) fetchUsers();
  if (authStore.can('ver grupos')) fetchGrupos();
  if (authStore.can('ver cronograma')) fetchUpcoming();
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleDateString('es-ES', options);
};
</script>

<template>
  <main class="container-fluid p-4 bg-light min-vh-100">
    <div class="d-flex align-items-center justify-content-between mb-4 bg-white p-4 rounded-4 shadow-sm">
      <div class="d-flex align-items-center">
        <img src="@/assets/logo.png" alt="Logo Parroquia" class="me-4 d-none d-md-block" style="height: 70px; width: auto; object-fit: contain;" />
        <div>
          <h1 class="h3 mb-1 text-gray-800 fw-bold">Panel de Control</h1>
          <p class="text-muted mb-0">Bienvenido al Sistema de Gestión de Confirmación 2026</p>
        </div>
      </div>
      <div class="text-end d-none d-lg-block">
        <span class="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill fw-bold text-uppercase">Periodo Activo</span>
      </div>
    </div>

    <div v-if="authStore.can('ver confirmandos')" class="row mb-4 g-3">
      <div class="col-md-6">
        <div class="card border-0 shadow-sm rounded-4 h-100">
          <div class="card-body p-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="text-muted fw-bold text-uppercase small mb-0">Índice de Retención</h6>
              <span class="fs-4 fw-bold text-success">{{ metricas.tasaRetencion }}%</span>
            </div>
            <div class="progress rounded-pill" style="height: 12px;">
              <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" 
                   :style="{ width: metricas.tasaRetencion + '%' }"></div>
            </div>
            <div class="d-flex justify-content-between mt-2 small">
              <span class="text-muted"><strong>{{ metricas.activos }}</strong> activos</span>
              <span class="text-muted">Meta: 100%</span>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card border-0 shadow-sm rounded-4 h-100">
          <div class="card-body p-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="text-muted fw-bold text-uppercase small mb-0">Tasa de Deserción</h6>
              <span class="fs-4 fw-bold text-danger">{{ metricas.tasaDesercion }}%</span>
            </div>
            <div class="progress rounded-pill" style="height: 12px;">
              <div class="progress-bar bg-danger" :style="{ width: metricas.tasaDesercion + '%' }"></div>
            </div>
            <div class="d-flex justify-content-between mt-2 small">
              <span class="text-muted"><strong>{{ metricas.retirados }}</strong> retirados</span>
              <span class="text-danger fw-bold">Bajas del periodo</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row mb-4">
      <div v-if="authStore.can('ver confirmandos')" class="col-lg-4 col-md-6 mb-3">
        <div class="card border-0 shadow-sm rounded-4 overflow-hidden h-100">
          <div class="card-body d-flex align-items-center p-4">
            <div class="flex-shrink-0 bg-info-subtle text-info p-3 rounded-4 me-3">
              <i class="bi bi-people-fill fs-2"></i>
            </div>
            <div>
              <h3 class="fw-bold mb-0">{{ cantConfirmandos }}</h3>
              <p class="text-muted mb-0">Inscritos</p>
              <RouterLink :to="{ name: 'confirmandos' }" class="stretched-link small text-info fw-bold text-decoration-none">Gestionar lista →</RouterLink>
            </div>
          </div>
        </div>
      </div>

      <div v-if="authStore.can('ver usuarios')" class="col-lg-4 col-md-6 mb-3">
        <div class="card border-0 shadow-sm rounded-4 overflow-hidden h-100">
          <div class="card-body d-flex align-items-center p-4">
            <div class="flex-shrink-0 bg-success-subtle text-success p-3 rounded-4 me-3">
              <i class="bi bi-person-badge fs-2"></i>
            </div>
            <div>
              <h3 class="fw-bold mb-0">{{ cantUsers }}</h3>
              <p class="text-muted mb-0">Usuarios</p>
              <RouterLink :to="{ name: 'users' }" class="stretched-link small text-success fw-bold text-decoration-none">Configurar accesos →</RouterLink>
            </div>
          </div>
        </div>
      </div>

      <div v-if="authStore.can('ver grupos')" class="col-lg-4 col-md-12 mb-3">
        <div class="card border-0 shadow-sm rounded-4 overflow-hidden h-100">
          <div class="card-body d-flex align-items-center p-4">
            <div class="flex-shrink-0 bg-warning-subtle text-warning p-3 rounded-4 me-3">
              <i class="bi bi-grid-3x3-gap fs-2"></i>
            </div>
            <div>
              <h3 class="fw-bold mb-0">{{ cantGrupos }}</h3>
              <p class="text-muted mb-0">Grupos Pastorales</p>
              <RouterLink :to="{ name: 'grupos' }" class="stretched-link small text-warning fw-bold text-decoration-none" style="color: #856404 !important;">Ver grupos →</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row">
      <div class="col-lg-8 mb-4">
        <div class="card border-0 shadow-sm rounded-4 h-100">
          <div class="card-header bg-white py-3 border-0 rounded-top-4 d-flex justify-content-between align-items-center mt-2">
            <h5 class="mb-0 fw-bold text-dark d-flex align-items-center">
              <CalendarIcon class="h-5 w-5 me-2 text-primary" />
              Próximas Actividades
            </h5>
            <router-link to="/cronograma" class="btn btn-sm btn-outline-primary rounded-pill px-3">Ver cronograma</router-link>
          </div>
          <div class="card-body">
            <div v-if="loadingReuniones" class="text-center py-5">
              <div class="spinner-border text-primary" role="status"></div>
            </div>
            <div v-else-if="upcomingItems.length === 0" class="text-center py-5 text-muted bg-light rounded-4">
              <i class="bi bi-calendar-x fs-1 opacity-25 d-block mb-2"></i>
              <p>No hay actividades programadas próximamente.</p>
            </div>
            <div v-else class="list-group list-group-flush">
              <div v-for="actividad in upcomingItems" :key="actividad.id" class="list-group-item px-0 py-3 border-light">
                <div class="d-flex align-items-center">
                  <div class="bg-primary text-white rounded-3 p-2 text-center me-3" style="min-width: 60px;">
                    <span class="d-block fw-bold fs-4 mb-0">{{ new Date(actividad.fecha).getDate() }}</span>
                    <span class="small text-uppercase" style="font-size: 0.7rem;">{{ new Date(actividad.fecha).toLocaleString('es', {month: 'short'}) }}</span>
                  </div>
                  <div class="flex-grow-1">
                    <h6 class="mb-0 fw-bold text-dark">{{ actividad.nombre_tema }}</h6>
                    <p class="mb-0 text-muted small">{{ actividad.descripcion }}</p>
                    <span class="badge bg-light text-primary border border-primary-subtle mt-1 fw-normal">{{ actividad.tipo }}</span>
                  </div>
                  <div class="text-end">
                    <small class="fw-bold text-primary d-block">{{ new Date(actividad.fecha).toLocaleTimeString('es', {hour: '2-digit', minute:'2-digit'}) }}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-4 mb-4">
        <div class="card border-0 shadow-sm rounded-4 h-100 bg-white">
          <div class="card-header bg-white py-3 border-0 pt-4">
            <h5 class="mb-0 fw-bold text-dark">Avisos Rápidos</h5>
          </div>
          <div class="card-body pt-0">
            <div class="p-4 rounded-4 bg-primary-subtle border border-primary-subtle mb-3">
              <p class="fw-bold text-primary mb-2">💡 Recordatorio</p>
              <p class="small text-primary-emphasis mb-0">No olvides registrar la asistencia inmediatamente termine la reunión para no alterar las métricas de retención.</p>
            </div>
            <div class="p-4 rounded-4 bg-light">
              <p class="fw-bold text-dark mb-2">📋 Soporte</p>
              <p class="small text-muted mb-0">Si tienes problemas con el sistema, contacta al coordinador del Programa.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.rounded-4 { border-radius: 1rem !important; }
.bg-primary-subtle { background-color: #e7f0fe !important; }
.bg-info-subtle { background-color: #e0f7fa !important; }
.bg-success-subtle { background-color: #e8f5e9 !important; }
.bg-warning-subtle { background-color: #fff3e0 !important; }

.list-group-item {
  transition: background-color 0.2s;
}

.list-group-item:hover {
  background-color: #f8fafc;
}
</style>