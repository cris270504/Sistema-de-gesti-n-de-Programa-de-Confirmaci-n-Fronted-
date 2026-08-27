<script setup>
import { useUsersStore } from '@/stores/users';
import { storeToRefs } from 'pinia';
import { onMounted, ref } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useParroquiaStore } from '@/stores/parroquia';
import { Pencil, Trash, Plus, User, Mail } from 'lucide-vue-next';
import UserModal from '../../components/Modals/userModal.vue';
import AppPage from '@/components/AppPage.vue';

const usersStore = useUsersStore();
const { items: users, loading, error } = storeToRefs(usersStore);
const { fetchAll: fetchAllUsers, remove: removeUser } = usersStore;

const authStore = useAuthStore();
const parroquiaStore = useParroquiaStore();

const modalRef = ref(null);

const abrirCrear = () => {
  modalRef.value.open();
};

const abrirEditar = (usuario) => {
  modalRef.value.open(usuario.id);
};

const recargarTabla = () => {
  fetchAllUsers();
}

// Roles con colores sólidos pero profesionales
const rolePalette = [
  { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' }, // Índigo
  { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' }, // Verde
  { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' }, // Naranja
  { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' }, // Gris
  { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' }, // Azul
];

const getRoleStyle = (roleName) => {
  if (!roleName) return rolePalette[3];
  let hash = 0;
  for (let i = 0; i < roleName.length; i++) {
    hash = roleName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % rolePalette.length;
  return rolePalette[index];
};

onMounted(() => {
  fetchAllUsers();
});
</script>

<template>
  <AppPage title="Usuarios" subtitle="Personal del sistema" :loading="loading">
    <template #actions>
      <button @click="abrirCrear" class="btn-primary">
        <Plus :size="18" class="mr-1.5" /> <span class="text-sm">Nuevo usuario</span>
      </button>
    </template>

    <div v-if="error" class="alert-error !mb-4">{{ error }}</div>

    <div class="surface table-wrap">
      <table class="mb-0">
        <thead>
          <tr>
            <th class="pl-4">Usuario</th>
            <th>Contacto</th>
            <th>Roles</th>
            <th v-if="authStore.can('editar usuarios')" class="!text-right pr-4">Acciones</th>
          </tr>
        </thead>
          <tbody>
            <tr v-if="!users || users.length === 0">
              <td colspan="4" class="text-center py-5 text-muted">No hay usuarios registrados.</td>
            </tr>

            <tr v-for="u in users" :key="u.id" class="hover-row">
              <td class="ps-4 py-2">
                <div class="d-flex align-items-center">
                    <div class="icon-box me-3">
                        <User :size="18" class="text-dark" />
                    </div>
                    <div>
                        <div class="fw-bold text-dark fs-6 lh-sm">{{ u.name }}</div>
                        <div class="text-muted mt-1 font-monospace small">
                           DNI: {{ u.dni }}
                        </div>
                    </div>
                </div>
              </td>
              
              <td class="py-2">
                <div class="d-flex align-items-center text-secondary small-text">
                    <Mail :size="16" class="me-2 opacity-75" />
                    <span>{{ u.email }}</span>
                </div>
              </td>
              
              <td class="py-2">
                <div class="d-flex flex-wrap gap-2">
                  <template v-if="u.roles && u.roles.length > 0">
                    <span v-for="role in u.roles" :key="role.id" 
                          class="role-badge"
                          :style="{ 
                              backgroundColor: getRoleStyle(role.name).bg, 
                              color: getRoleStyle(role.name).text,
                              borderColor: getRoleStyle(role.name).border 
                          }">
                      {{ parroquiaStore.roleLabel(role.name) }}
                    </span>
                  </template>
                  <span v-else class="text-muted fst-italic px-2 small">Sin rol</span>
                </div>
              </td>
              
              <td v-if="authStore.can('editar usuarios')" class="text-end pe-4 py-2">
                <div  class="d-inline-flex gap-2">
                  <button @click="abrirEditar(u)" class="btn btn-action btn-soft-primary" title="Editar">
                    <Pencil :size="18" />
                  </button>
                  <button class="btn btn-action btn-soft-danger" title="Eliminar" @click="removeUser(u.id, u.name)">
                    <Trash :size="18" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
    </div>

    <UserModal ref="modalRef" @saved="recargarTabla" />
  </AppPage>
</template>

<style scoped>
/* Header */
.page-title {
    font-size: 1.5rem; /* Reducido de 1.75 a 1.5 */
    font-weight: 700;
    color: #111827;
    margin-bottom: 0;
    letter-spacing: -0.5px;
}
.page-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
}

/* Icon Box (Avatar) */
.icon-box {
    width: 36px; /* Reducido de 40 a 36 */
    height: 36px;
    background-color: #f3f4f6;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e7eb;
}

/* Tabla */
.bg-light-gray {
    background-color: #f8fafc;
    border-bottom: 2px solid #e5e7eb;
}
/* Cabecera */
.bg-light-gray th {
    font-size: 0.75rem; 
    letter-spacing: 0.5px;
}

.hover-row:hover td {
    background-color: #f9fafb;
}
.hover-row td {
    border-bottom: 1px solid #f3f4f6;
    color: #374151; /* Gris oscuro suave */
    font-size: 0.95rem; /* Tamaño de letra equilibrado */
}

.small-text {
    font-size: 0.9rem;
}
.small { font-size: 0.85rem; }
.fs-7 { font-size: 0.85rem; }

/* Roles */
.role-badge {
    padding: 0.25em 0.65em;
    font-size: 0.75rem; /* Un poco más pequeño */
    font-weight: 600;
    border-radius: 6px;
    border-width: 1px;
    border-style: solid;
}

/* .btn-action y .btn-soft-* ahora son globales (src/assets/main.css) */
/* Botón Principal */
.btn-primary {
    background-color: #2563eb;
    border-color: #2563eb;
    font-size: 0.9rem;
}
.btn-primary:hover {
    background-color: #1d4ed8;
}
</style>