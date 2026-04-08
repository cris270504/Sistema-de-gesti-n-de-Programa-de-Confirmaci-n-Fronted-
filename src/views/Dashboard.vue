<script setup>
import { storeToRefs } from 'pinia';
import { useConfirmandosStore } from '../stores/confirmandos';
import { useUsersStore } from '../stores/users';
import { useGruposStore } from '../stores/grupos';
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useReunionesStore } from '../stores/reunions';
import { CalendarIcon, ClockIcon } from '@heroicons/vue/24/outline';

const authStore = useAuthStore();

const confirmandosStore = useConfirmandosStore();
const { fetchAll: fetchConfirmandos } = confirmandosStore;
const { count: cantConfirmandos, loading: loadingConfirmandos } = storeToRefs(confirmandosStore);

const usersStore = useUsersStore();
const { fetchAll: fetchUsers } = usersStore;
const { count: cantUsers, loading: loadingUsers } = storeToRefs(usersStore);

const gruposStore = useGruposStore();
const { fetchAll: fetchGrupos } = gruposStore;
const { count: cantGrupos, loading: loadingGrupos } = storeToRefs(gruposStore);

const reunionesStore = useReunionesStore();
const { fetchUpcoming } = reunionesStore;
const { upcomingItems, loading: loadingReuniones } = storeToRefs(reunionesStore);

onMounted(() => {
  if (authStore.can('ver confirmandos')) fetchConfirmandos();
  if (authStore.can('ver usuarios')) fetchUsers();
  if (authStore.can('ver grupos')) fetchGrupos();
  if (authStore.can('ver cronograma'));
  fetchUpcoming();
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
onMounted(() => {
  if (authStore.can('ver confirmandos')) fetchConfirmandos();
  if (authStore.can('ver usuarios')) fetchUsers();
  if (authStore.can('ver grupos')) fetchGrupos();
});
</script>
<template>
  <main class="container-fluid p-4">
    <h1 class="h3 mb-4 text-gray-800">Dashboard</h1>

    <div class="row">
      <div v-if="authStore.can('ver confirmandos')" class="col-lg-3 col-md-6 col-12 mb-4">
        <div class="card bg-info text-white shadow-sm border-0 h-100">
          <div class="card-body position-relative">
            <div v-if="loadingConfirmandos" class="d-flex justify-content-center align-items-center h-100">
              <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
            <div v-else>
              <h3 class="display-5 fw-bold mb-0">{{ cantConfirmandos }}</h3>
              <p class="fs-5 mb-0">Confirmandos</p>
            </div>
            <div class="position-absolute top-50 end-0 translate-middle-y me-3 opacity-25">
              <i class="bi bi-people-fill" style="font-size: 4.5rem;"></i>
            </div>
          </div>
          <RouterLink v-if="authStore.can('ver todos los confirmandos')"  :to="{ name: 'confirmandos' }"
            class="card-footer d-flex justify-content-between align-items-center text-white text-decoration-none small stretched-link">
            <span>Ver lista</span>
            <i class="bi bi-arrow-right-circle"></i>
          </RouterLink>
        </div>
      </div>

      <div v-if="authStore.can('ver usuarios')" class="col-lg-3 col-md-6 col-12 mb-4">
        <div class="card bg-success text-white shadow-sm border-0 h-100">
          <div class="card-body position-relative">
            <div v-if="loadingUsers" class="d-flex justify-content-center align-items-center h-100">
              <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
            <div v-else>
              <h3 class="display-5 fw-bold mb-0">{{ cantUsers }}</h3>
              <p class="fs-5 mb-0">Usuarios Registrados</p>
            </div>
            <div class="position-absolute top-50 end-0 translate-middle-y me-3 opacity-25">
              <i class="bi bi-person-plus" style="font-size: 4.5rem;"></i>
            </div>
          </div>
          <RouterLink v-if="authStore.can('ver usuarios')"  :to="{ name: 'users' }"
            class="card-footer d-flex justify-content-between align-items-center text-white text-decoration-none small stretched-link">
            <span>Ver usuarios</span>
            <i class="bi bi-arrow-right-circle"></i>
          </RouterLink>
        </div>
      </div>
      <div v-if="authStore.can('ver grupos')" class="col-lg-3 col-md-6 col-12 mb-4">
        <div class="card bg-warning text-dark shadow-sm border-0 h-100">
          <div class="card-body position-relative">
            <div v-if="loadingGrupos" class="d-flex justify-content-center align-items-center h-100">
              <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
            <div v-else>
              <h3 class="display-5 fw-bold mb-0">{{ cantGrupos }}</h3>
              <p class="fs-5 mb-0">Grupos Activos</p>
            </div>
            <div class="position-absolute top-50 end-0 translate-middle-y me-3 opacity-25">
              <i class="bi bi-collection" style="font-size: 4.5rem;"></i>
            </div>
          </div>
          <RouterLink v-if="authStore.can('ver todos los grupos')"  :to="{ name: 'grupos' }"
            class="card-footer d-flex justify-content-between align-items-center text-dark text-decoration-none small stretched-link">
            <span>Gestionar grupos</span>
            <i class="bi bi-arrow-right-circle"></i>
          </RouterLink>
        </div>
      </div>
    </div>

    <div class="row">
      <div class="col-lg-6 mb-4">
        <div class="card shadow mb-4">
          <div class="card-header py-3 d-flex justify-content-between align-items-center bg-white">
            <h6 class="m-0 font-weight-bold text-primary d-flex align-items-center gap-2">
              <CalendarIcon class="h-5 w-5" />
              Próximas Actividades
            </h6>
            <router-link to="/cronograma" class="btn btn-sm btn-outline-primary">Ver todo</router-link>
          </div>
          <div class="card-body">

            <div v-if="loadingReuniones" class="text-center py-4">
              <div class="spinner-border text-primary" role="status"></div>
              <p class="mt-2 text-sm text-gray-500">Cargando agenda...</p>
            </div>

            <div v-else-if="upcomingItems.length === 0" class="text-center py-4 text-gray-500">
              <p>No hay actividades programadas próximamente.</p>
            </div>

            <ul v-else class="list-group list-group-flush">
              <li v-for="actividad in upcomingItems" :key="actividad.id" class="list-group-item px-0 py-3">
                <div class="d-flex w-100 justify-content-between align-items-start">
                  <div>
                    <h5 class="mb-1 font-semibold text-gray-800">{{ actividad.nombre_tema }}</h5>
                    <p class="mb-1 text-sm text-gray-600">{{ actividad.descripcion }}</p>

                    <span class="badge bg-secondary mt-1 fw-normal">
                      {{ actividad.tipo }}
                    </span>
                  </div>
                  <div class="text-end" style="min-width: 100px;">
                    <small class="text-primary fw-bold d-block">
                      {{ formatDate(actividad.fecha) }}
                    </small>
                  </div>
                </div>
              </li>
            </ul>

          </div>
        </div>
      </div>

      <div class="col-lg-6 mb-4">
        <div class="card shadow mb-4">
          <div class="card-header py-3 bg-white">
            <h6 class="m-0 font-weight-bold text-gray-700">Avisos Rápidos</h6>
          </div>
          <div class="card-body">
            <p>Bienvenido al sistema de gestión.</p>
            <p class="text-muted">Recuerda tomar asistencia en cada reunión.</p>
          </div>
        </div>
      </div>

    </div>

  </main>
</template>

<style scoped>
/* Estilo para que el spinner ocupe el espacio */
.card-body>div[v-if="loadingUsers"],
.card-body>div[v-if="loadingConfirmandos"],
.card-body>div[v-if="loadingGrupos"] {
  min-height: 80px;
  /* Asegura que la tarjeta no colapse mientras carga */
}

.list-group-item:last-child {
  border-bottom: 0;
}
</style>