<script setup>
import AppEmpty from '@/components/AppEmpty.vue'
import AppButton from '@/components/AppButton.vue'
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
      <AppButton :icon="Plus" @click="abrirCrear">Nuevo usuario</AppButton>
    </template>

    <div v-if="error" class="alert-error !mb-4">{{ error }}</div>

    <div class="users-bar">
      <div class="input-group users-search shadow-sm">
        <span class="input-group-text bg-white border-end-0 text-muted">
          <Search class="h-4 w-4" aria-hidden="true" />
        </span>
        <input type="text" class="form-control border-start-0 ps-0" v-model="busqueda"
          placeholder="Buscar por nombre, DNI o correo…" aria-label="Buscar usuario" :disabled="loading">
        <AppButton
          v-if="busqueda"
          variant="secondary"
          icon-only
          :icon="X"
          @click="busqueda = ''"
          aria-label="Limpiar búsqueda"></AppButton>
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

    <div v-if="usuariosVisibles.length === 0" class="surface">
      <AppEmpty :icon="User"
        :message="(users && users.length) ? 'No hay usuarios que coincidan con la búsqueda o el filtro.' : 'Aún no hay usuarios registrados.'">
        <AppButton v-if="!(users && users.length)" :icon="Plus" @click="abrirCrear">Nuevo usuario</AppButton>
      </AppEmpty>
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
            <AppButton variant="soft" icon-only @click="abrirEditar(u)" title="Editar" aria-label="Editar"><Pencil :size="18" /></AppButton>
            <AppButton
              v-if="u.activo === false"
              variant="soft"
              tone="success"
              icon-only
              title="Activar"
              @click="setEstado(u)"
              aria-label="Activar"><CircleCheck :size="18" /></AppButton>
            <AppButton
              v-else
              variant="soft"
              tone="warning"
              icon-only
              title="Desactivar"
              @click="setEstado(u)"
              aria-label="Desactivar"><Ban :size="18" /></AppButton>
            <AppButton
              variant="soft"
              tone="danger"
              icon-only
              :disabled="gruposDe(u) > 0"
              :title="gruposDe(u) > 0 ? 'Tiene grupos asignados: reasígnalos o desactívalo' : 'Eliminar'"
              :aria-label="gruposDe(u) > 0 ? 'Tiene grupos asignados: reasígnalos o desactívalo' : `Eliminar usuario ${u.name}`"
              @click="removeUser(u.id, u.name)"><Trash :size="18" /></AppButton>
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
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface-sunken);
  padding: 3px;
  gap: 2px;
}

.seg__btn {
  border: 0;
  background: transparent;
  padding: 0.4rem 0.9rem;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, box-shadow 0.15s;
}

.seg__btn:hover:not(.seg__btn--on) {
  color: var(--text);
}

.seg__btn--on {
  background: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.users-count {
  font-size: var(--fs-sm);
  color: var(--text-muted);
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
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  padding: 0.9rem 1rem;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.15s, border-color 0.15s;
}

.user-card:hover {
  box-shadow: var(--shadow-md);
  border-color: #d1d5db;
}

.user-card--off {
  background: var(--surface-sunken);
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
  background-color: var(--surface-sunken);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  flex-shrink: 0;
}

.user-card__id {
  min-width: 0;
  flex: 1;
}

.user-card__name {
  font-weight: 700;
  color: #1f2937;
  font-size: var(--fs-base);
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
  font-size: var(--fs-xs);
  font-weight: 600;
  border-radius: var(--radius-sm);
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
  border-top: 1px solid var(--line);
  font-size: var(--fs-ui);
  color: var(--text-muted);
}

.uc-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.user-badge-off {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text-muted);
  background: var(--line);
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.45rem;
}

/* ===== MODO OSCURO ===== */
:root[data-bs-theme="dark"] .seg {
  border-color: var(--line-strong);
  background: var(--surface-sunken);
}
:root[data-bs-theme="dark"] .seg__btn { color: var(--text-muted); }
:root[data-bs-theme="dark"] .seg__btn:hover:not(.seg__btn--on) { color: var(--text); }
:root[data-bs-theme="dark"] .seg__btn--on { background: var(--line); }

:root[data-bs-theme="dark"] .user-card {
  border-color: var(--line);
  background: var(--surface);
}
:root[data-bs-theme="dark"] .user-card:hover { border-color: var(--line-strong); }
:root[data-bs-theme="dark"] .icon-box {
  background-color: var(--line);
  border-color: var(--line-strong);
}
:root[data-bs-theme="dark"] .user-card__name { color: var(--text); }
:root[data-bs-theme="dark"] .user-card__contact {
  border-top-color: var(--line);
}
:root[data-bs-theme="dark"] .user-badge-off {
  color: var(--text);
}
</style>
