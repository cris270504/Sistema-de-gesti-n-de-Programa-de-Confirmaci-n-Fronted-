<script setup>
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { useGruposStore } from '@/stores/grupos';
import { RouterLink } from 'vue-router';
import { Users } from 'lucide-vue-next'; // Icono para el botón

const authStore = useAuthStore();
const gruposStore = useGruposStore();
const { items: allGrupos, loading } = storeToRefs(gruposStore);

onMounted(() => {
  // Cargamos todos los grupos para poder filtrar los nombres y detalles
  gruposStore.fetchAll();
});

// Filtramos la lista completa de grupos comparando con los IDs que tiene el usuario
const myGroups = computed(() => {
  const userGroupId = authStore.user?.grupo_id;
  
  // Si no hay grupos cargados o el usuario no tiene grupos
  if (!allGrupos.value || userGroupId.length === 0) return [];

  return allGrupos.value.filter(grupo => userGroupId.includes(grupo.id));
});
</script>

<template>
  <div class="container-fluid p-4">
    <h2 class="title mb-4">Mis Grupos Asignados</h2>

    <div v-if="loading" class="text-center p-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Cargando...</span>
      </div>
    </div>

    <div v-else class="row g-4">
      
      <div v-if="myGroups.length === 0" class="col-12">
        <div class="alert alert-info" role="alert">
          No tienes grupos asignados actualmente. Contacta al coordinador.
        </div>
      </div>

      <div v-for="grupo in myGroups" :key="grupo.id" class="col-md-6 col-lg-4">
        <div class="card shadow-sm h-100 border-0">
          <div class="card-header bg-white border-bottom-0 pt-3">
            <h5 class="card-title text-primary fw-bold mb-0">{{ grupo.nombre }}</h5>
          </div>
          <div class="card-body">
            <p class="card-text text-muted">
              <small>Periodo: {{ grupo.periodo }}</small>
            </p>
            <div class="d-flex justify-content-between align-items-center mt-3">
              <span class="badge bg-light text-dark border">
                {{ grupo.confirmandos ? grupo.confirmandos.length : 0 }} Confirmandos
              </span>
              
              <RouterLink 
                :to="{ name: 'gruposAsignacion', params: { id: grupo.id } }" 
                class="btn btn-outline-primary btn-sm d-flex align-items-center"
              >
                <Users :size="16" class="me-2"/>
                Gestionar
              </RouterLink>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.card {
  transition: transform 0.2s;
}
.card:hover {
  transform: translateY(-5px);
}
</style>