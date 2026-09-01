<script setup>
import { useUsersStore } from '@/stores/users';
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useParroquiaStore } from '@/stores/parroquia';
import { Pencil, Trash, Plus, User, Mail, Ban, CircleCheck, Search, X } from 'lucide-vue-next';
import UserModal from '../../components/Modals/userModal.vue';
import AppPage from '@/components/AppPage.vue';

const usersStore = useUsersStore();
const { items: users, loading, error } = storeToRefs(usersStore);
const { fetchAll: fetchAllUsers, remove: removeUser, setEstado } = usersStore;

// Normaliza texto para búsqueda: minúsculas, sin tildes.
const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Activos primero; dentro de cada bloque, por nombre.
const usuariosOrdenados = computed(() => [...(users.value || [])].sort((a, b) => {
  const act = Number(b.activo !== false) - Number(a.activo !== false);
  return act !== 0 ? act : (a.name || '').localeCompare(b.name || '', 'es');
}));

// Filtro por estado. Por defecto solo los activos.
const filtroEstado = ref('activos');
const busqueda = ref('');

const usuariosVisibles = computed(() => {
  let lista = usuariosOrdenados.value;
  if (filtroEstado.value === 'activos') lista = lista.filter(u => u.activo !== false);
  else if (filtroEstado.value === 'inactivos') lista = lista.filter(u => u.activo === false);

  const q = norm(busqueda.value.trim());
  if (q) {
    lista = lista.filter(u =>
      norm(u.name).includes(q) || norm(u.dni).includes(q) || norm(u.email).includes(q));
  }
  return lista;
});

const gruposDe = (u) => (u.grupos?.length ?? u.grupo_ids?.length ?? 0);

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
  fetchAllUsers({ force: true });
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

    <div class="users-bar">
      <div class="input-group users-search shadow-sm">
        <span class="input-group-text bg-white border-end-0 text-muted">
          <Search class="h-4 w-4" aria-hidden="true" />
        </span>
        <input type="text" class="form-control border-start-0 ps-0" v-model="busqueda"
          placeholder="Buscar por nombre, DNI o correo…" aria-label="Buscar usuario" :disabled="loading">
        <button v-if="busqueda" @click="busqueda = ''" aria-label="Limpiar búsqueda"
          class="btn btn-white border border-start-0 text-muted">
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div class="seg" role="group" aria-label="Filtrar usuarios por estado">
        <button type="button" class="seg__btn" :class="{ 'seg__btn--on': filtroEstado === 'activos' }"
          @click="filtroEstado = 'activos'">Activos</button>
        <button type="button" class="seg__btn" :class="{ 'seg__btn--on': filtroEstado === 'inactivos' }"
          @click="filtroEstado = 'inactivos'">Deshabilitados</button>
        <button type="button" class="seg__btn" :class="{ 'seg__btn--on': filtroEstado === 'todos' }"
          @click="filtroEstado = 'todos'">Todos</button>
      </div>

      <span class="users-count">{{ usuariosVisibles.length }} usuario(s)</span>
    </div>

    <div v-if="usuariosVisibles.length === 0" class="surface empty-state">
      {{ (users && users.length) ? 'No hay usuarios que coincidan con la búsqueda o el filtro.' : 'No hay usuarios registrados.' }}
    </div>

    <div v-else class="user-grid">
      <article v-for="u in usuariosVisibles" :key="u.id" class="user-card"
        :class="{ 'user-card--off': u.activo === false }">
        <div class="user-card__head">
          <div class="icon-box">
            <User :size="18" class="text-dark" />
          </div>

          <div class="user-card__id">
            <div class="user-card__name">
              {{ u.name }}
              <span v-if="u.activo === false" class="user-badge-off">Inactivo</span>
            </div>
            <div class="user-card__roles">
              <template v-if="u.roles && u.roles.length > 0">
                <span v-for="role in u.roles" :key="role.id" class="role-badge" :style="{
                  backgroundColor: getRoleStyle(role.name).bg,
                  color: getRoleStyle(role.name).text,
                  borderColor: getRoleStyle(role.name).border,
                }">
                  {{ parroquiaStore.roleLabel(role.name) }}
                </span>
              </template>
              <span v-else class="text-muted fst-italic small">Sin rol</span>
            </div>
          </div>

          <div v-if="authStore.can('editar usuarios')" class="user-card__actions">
            <button @click="abrirEditar(u)" class="btn-action btn-soft-primary" title="Editar">
              <Pencil :size="18" />
            </button>
            <button v-if="u.activo === false" class="btn-action btn-soft-success" title="Activar" @click="setEstado(u)">
              <CircleCheck :size="18" />
            </button>
            <button v-else class="btn-action btn-soft-warning" title="Desactivar" @click="setEstado(u)">
              <Ban :size="18" />
            </button>
            <button class="btn-action btn-soft-danger" :disabled="gruposDe(u) > 0"
              :title="gruposDe(u) > 0 ? 'Tiene grupos asignados: reasígnalos o desactívalo' : 'Eliminar'"
              @click="removeUser(u.id, u.name)">
              <Trash :size="18" />
            </button>
          </div>
        </div>

        <div class="user-card__contact">
          <span class="uc-line">
            <Mail :size="14" class="opacity-75" />
            <span class="text-truncate">{{ u.email || 'Sin correo' }}</span>
          </span>
          <span class="uc-line font-monospace">
            DNI: {{ u.dni || '—' }}
          </span>
        </div>
      </article>
    </div>

    <UserModal ref="modalRef" @saved="recargarTabla" />
  </AppPage>
</template>

<style scoped>
/* Barra superior: búsqueda + filtro de estado + conteo */
.users-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.users-search {
  flex: 1 1 260px;
  max-width: 380px;
}

.seg {
  display: inline-flex;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  background: #f8fafc;
  padding: 3px;
  gap: 2px;
}

.seg__btn {
  border: 0;
  background: transparent;
  padding: 0.4rem 0.9rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: #64748b;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, box-shadow 0.15s;
}

.seg__btn:hover:not(.seg__btn--on) {
  color: #1e293b;
}

.seg__btn--on {
  background: #ffffff;
  color: var(--parroquia-color, #2563eb);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
}

.users-count {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-left: auto;
}

/* Cuadrícula de tarjetas */
.user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 0.85rem;
}

@media (max-width: 400px) {
  .user-grid {
    grid-template-columns: 1fr;
  }
}

.user-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  padding: 0.9rem 1rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.15s, border-color 0.15s;
}

.user-card:hover {
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  border-color: #d1d5db;
}

.user-card--off {
  background: #f8fafc;
}

.user-card--off .user-card__id,
.user-card--off .user-card__contact {
  opacity: 0.6;
}

.user-card__head {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
}

.icon-box {
  width: 36px;
  height: 36px;
  background-color: #f3f4f6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.user-card__id {
  min-width: 0;
  flex: 1;
}

.user-card__name {
  font-weight: 700;
  color: #1f2937;
  font-size: 0.98rem;
  line-height: 1.2;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.user-card__roles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.4rem;
}

.role-badge {
  padding: 0.2em 0.6em;
  font-size: 0.72rem;
  font-weight: 600;
  border-radius: 6px;
  border-width: 1px;
  border-style: solid;
}

.user-card__actions {
  display: flex;
  gap: 0.35rem;
  flex-shrink: 0;
}

.user-card__contact {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.7rem;
  padding-top: 0.6rem;
  border-top: 1px solid #f1f5f9;
  font-size: 0.85rem;
  color: #64748b;
}

.uc-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.user-badge-off {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #64748b;
  background: #e2e8f0;
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
}

/* Botón Principal (heredado del resto de vistas) */
.btn-primary {
  background-color: #2563eb;
  border-color: #2563eb;
  font-size: 0.9rem;
}

.btn-primary:hover {
  background-color: #1d4ed8;
}
</style>
