<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { Modal } from 'bootstrap';
import { useRolesStore } from '@/stores/roles';
import { usePermissionsStore } from '@/stores/permissions';
import { useAuthStore } from '@/stores/auth';
import { useParroquiaStore } from '@/stores/parroquia';
import { getRoles } from '@/services/roles';
import { showAlerta } from '@/funciones';
import { Pencil, Trash, Plus, ShieldCheck, Search, KeyRound, Users } from 'lucide-vue-next';

// --- Stores ---
const rolesStore = useRolesStore();
const permissionsStore = usePermissionsStore();
const authStore = useAuthStore();
const parroquiaStore = useParroquiaStore();
const { items: roles, loading, error } = storeToRefs(rolesStore);
const { items: permissions, loading: loadingPermisos } = storeToRefs(permissionsStore);
const { fetchAll, add, save, remove } = rolesStore;

// Solo el proveedor de la plataforma gestiona el catálogo global de roles/permisos.
const puedeGestionar = computed(() => authStore.can('administrar plataforma'));

// Roles que no se pueden eliminar desde la UI para evitar dejar el sistema sin administración.
const ROLES_PROTEGIDOS = ['admin', 'administrador', 'coordinador'];
const esProtegido = (nombre) => ROLES_PROTEGIDOS.includes(String(nombre || '').toLowerCase().trim());

// --- Normalización de formas de datos de la API ---
const permName = (p) => (typeof p === 'string' ? p : p?.name ?? '');
const rolePermNames = (role) => {
  const raw = role?.permissions?.data ?? role?.permissions ?? [];
  return raw.map(permName).filter(Boolean);
};

// --- Estado del modal / formulario ---
const modalInstance = ref(null);
const draft = ref({ id: null, name: '', permissions: [] });
const search = ref('');
const saving = ref(false);
const loadingRole = ref(false);

const isEditing = computed(() => !!draft.value.id);
const modalTitle = computed(() => (isEditing.value ? 'Editar Rol' : 'Nuevo Rol'));

// Etiquetas legibles para agrupar permisos por el verbo inicial ("ver usuarios" -> "Ver / Consultar").
const GRUPO_LABELS = {
  ver: 'Ver / Consultar',
  crear: 'Crear',
  editar: 'Editar',
  actualizar: 'Actualizar',
  eliminar: 'Eliminar',
  borrar: 'Eliminar',
  asignar: 'Asignar',
  gestionar: 'Gestionar',
};
const grupoDePermiso = (nombre) => {
  const verbo = String(nombre).trim().toLowerCase().split(/\s+/)[0];
  return GRUPO_LABELS[verbo] || 'Otros';
};

const permisosOrdenados = computed(() =>
  [...permissions.value]
    .map((p) => ({ id: p.id, name: permName(p) }))
    .filter((p) => p.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
);

// Permisos agrupados y filtrados por el buscador del modal.
const gruposFiltrados = computed(() => {
  const q = search.value.trim().toLowerCase();
  const mapa = new Map();
  for (const permiso of permisosOrdenados.value) {
    if (q && !permiso.name.toLowerCase().includes(q)) continue;
    const grupo = grupoDePermiso(permiso.name);
    if (!mapa.has(grupo)) mapa.set(grupo, []);
    mapa.get(grupo).push(permiso);
  }
  return [...mapa.entries()]
    .map(([titulo, items]) => ({ titulo, items }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
});

const grupoCompleto = (items) => items.every((p) => draft.value.permissions.includes(p.name));

const toggleGrupo = (items) => {
  const nombres = items.map((p) => p.name);
  if (grupoCompleto(items)) {
    draft.value.permissions = draft.value.permissions.filter((n) => !nombres.includes(n));
  } else {
    const set = new Set([...draft.value.permissions, ...nombres]);
    draft.value.permissions = [...set];
  }
};

// --- Ciclo de vida ---
onMounted(async () => {
  await fetchAll();
  if (puedeGestionar.value) await permissionsStore.fetchAll();
  nextTick(() => {
    const el = document.getElementById('roleModal');
    if (el) modalInstance.value = new Modal(el, { backdrop: 'static' });
  });
});

onUnmounted(() => {
  modalInstance.value?.dispose();
});

// --- Métodos ---
const openModal = async (role = null) => {
  search.value = '';
  if (!role) {
    draft.value = { id: null, name: '', permissions: [] };
    modalInstance.value?.show();
    return;
  }

  // Abrimos de inmediato con lo que ya tenemos y luego refrescamos los permisos del rol.
  draft.value = { id: role.id, name: role.name ?? '', permissions: rolePermNames(role) };
  modalInstance.value?.show();

  loadingRole.value = true;
  try {
    const fresco = await getRoles(role.id);
    if (fresco && draft.value.id === role.id) {
      draft.value.name = fresco.name ?? draft.value.name;
      // Solo sobrescribimos si el endpoint realmente devolvió los permisos del rol.
      if (fresco.permissions !== undefined) {
        draft.value.permissions = rolePermNames(fresco);
      }
    }
  } catch {
    // Nos quedamos con los datos del listado; el usuario verá lo que había.
  } finally {
    loadingRole.value = false;
  }
};

const handleSubmit = async () => {
  const name = draft.value.name.trim();
  if (!name) {
    return showAlerta('El nombre del rol es obligatorio', 'warning');
  }

  const payload = { name, permissions: [...draft.value.permissions] };

  saving.value = true;
  try {
    if (isEditing.value) {
      await save(draft.value.id, payload);
    } else {
      await add(payload);
    }
    modalInstance.value?.hide();
    await fetchAll();
  } catch (e) {
    console.error(e);
  } finally {
    saving.value = false;
  }
};

const handleDelete = async (role) => {
  if (esProtegido(role.name)) {
    return showAlerta('Este rol está protegido y no puede eliminarse.', 'warning');
  }
  await remove(role.id, role.name);
};
</script>

<template>
  <div class="container-fluid p-4">

    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
      <div>
        <h2 class="h3 text-gray-800 mb-1">Gestión de Roles y Permisos</h2>
        <p class="text-muted mb-0 small">Define qué puede hacer cada tipo de usuario en el sistema</p>
      </div>
      <button v-if="puedeGestionar" class="btn btn-success shadow-sm px-3 py-2 d-flex align-items-center" @click="openModal(null)">
        <Plus :size="20" class="me-1" />
        <span class="fw-bold text-uppercase small">Nuevo Rol</span>
      </button>
    </div>

    <div class="card shadow border-0">
      <div class="card-body p-0">

        <div v-if="loading" class="text-center p-5">
          <div class="spinner-border text-primary" role="status"></div>
          <p class="mt-2 text-muted">Cargando roles...</p>
        </div>

        <div v-else-if="error" class="alert alert-danger m-3">
          {{ error }}
        </div>

        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th class="ps-4" style="width: 5%;">#</th>
                <th style="width: 22%;">Rol</th>
                <th>Permisos</th>
                <th v-if="puedeGestionar" class="text-center" style="width: 12%;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="roles.length === 0">
                <td colspan="4" class="text-center p-5 text-muted">
                  No hay roles registrados.
                </td>
              </tr>

              <tr v-for="(role, i) in roles" :key="role.id">
                <td class="ps-4 fw-bold text-muted">{{ i + 1 }}</td>
                <td>
                  <div class="d-flex align-items-center">
                    <div class="bg-light rounded p-2 me-3 text-primary">
                      <ShieldCheck :size="20" />
                    </div>
                    <div>
                      <span class="fw-semibold d-block">{{ parroquiaStore.roleLabel(role.name) }}</span>
                      <span class="text-muted small font-monospace">{{ role.name }}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div v-if="rolePermNames(role).length" class="d-flex flex-wrap gap-1">
                    <span
                      v-for="p in rolePermNames(role).slice(0, 6)"
                      :key="p"
                      class="badge rounded-pill bg-primary-subtle text-primary-emphasis border border-primary-subtle fw-normal"
                    >{{ p }}</span>
                    <span
                      v-if="rolePermNames(role).length > 6"
                      class="badge rounded-pill bg-secondary-subtle text-secondary-emphasis fw-normal"
                    >+{{ rolePermNames(role).length - 6 }} más</span>
                  </div>
                  <span v-else class="text-muted fst-italic small">Sin permisos asignados</span>
                </td>
                <td v-if="puedeGestionar" class="text-center">
                  <button class="btn btn-sm btn-outline-warning me-2" @click="openModal(role)" title="Editar">
                    <Pencil :size="16" />
                  </button>
                  <button
                    class="btn btn-sm btn-outline-danger"
                    :disabled="esProtegido(role.name)"
                    :title="esProtegido(role.name) ? 'Rol protegido' : 'Eliminar'"
                    @click="handleDelete(role)"
                  >
                    <Trash :size="16" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Crear / Editar Rol -->
    <div class="modal fade" id="roleModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content role-modal">
          <div class="modal-header">
            <h5 class="modal-title fw-bold">{{ modalTitle }}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" :disabled="saving"></button>
          </div>

          <div class="modal-body">
            <form id="roleForm" class="role-form" @submit.prevent="handleSubmit">
              <div class="role-form__top">
                <div class="role-field">
                  <label for="roleName">Nombre del rol <span class="text-danger">*</span></label>
                  <input id="roleName" type="text" v-model="draft.name" class="form-control"
                    placeholder="Ej: coordinador" autocomplete="off" required :disabled="saving">
                </div>

                <div class="role-field role-field--search">
                  <label for="permSearch">
                    Permisos <span class="badge text-bg-primary">{{ draft.permissions.length }}</span>
                  </label>
                  <div class="input-group">
                    <span class="input-group-text bg-white text-muted"><Search :size="15" /></span>
                    <input id="permSearch" type="text" v-model="search" class="form-control"
                      placeholder="Buscar permiso…" autocomplete="off" :disabled="saving">
                  </div>
                </div>
              </div>

              <div v-if="loadingPermisos || loadingRole" class="perm-state">
                <span class="spinner-border spinner-border-sm text-primary me-2"></span>
                {{ loadingPermisos ? 'Cargando permisos…' : 'Cargando permisos del rol…' }}
              </div>

              <div v-else-if="gruposFiltrados.length === 0" class="perm-state fst-italic">
                No se encontraron permisos.
              </div>

              <div v-else class="perm-scroll">
                <div v-for="grupo in gruposFiltrados" :key="grupo.titulo" class="perm-group">
                  <div class="perm-group__head">
                    <span class="perm-group__title">
                      <KeyRound :size="13" /> {{ grupo.titulo }}
                      <span class="perm-group__count">{{ grupo.items.length }}</span>
                    </span>
                    <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none" :disabled="saving"
                      @click="toggleGrupo(grupo.items)">
                      {{ grupoCompleto(grupo.items) ? 'Quitar todos' : 'Seleccionar todos' }}
                    </button>
                  </div>
                  <div class="perm-grid">
                    <label v-for="permiso in grupo.items" :key="permiso.id" class="perm-item"
                      :class="{ 'perm-item--on': draft.permissions.includes(permiso.name) }">
                      <input class="form-check-input" type="checkbox" :value="permiso.name"
                        v-model="draft.permissions" :disabled="saving">
                      <span class="text-truncate">{{ permiso.name }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-light" data-bs-dismiss="modal" :disabled="saving">Cancelar</button>
            <button type="submit" form="roleForm" class="btn btn-primary px-4" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
              {{ saving ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Encuadre explícito: el preflight de Tailwind quita bordes/relleno por defecto,
   así que la tarjeta del modal se define aquí sin depender de las clases de Bootstrap. */
.role-modal {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, .25);
}
.role-modal .modal-header {
  background: #2563eb;
  color: #fff;
  padding: 1rem 1.25rem;
  border: 0;
}
.role-modal .modal-body {
  padding: 1.25rem;
  max-height: min(70vh, 620px);
  overflow-y: auto;
}
.role-modal .modal-footer {
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  padding: .75rem 1.25rem;
}

.role-form__top {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}
@media (max-width: 640px) {
  .role-form__top { grid-template-columns: 1fr; }
}
.role-field label {
  display: block;
  font-size: .8rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: .35rem;
}

.perm-state { text-align: center; padding: 2rem 0; color: #94a3b8; }

.perm-scroll {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fbfcfe;
  padding: .5rem;
}
.perm-group + .perm-group { margin-top: .35rem; }
.perm-group__head {
  position: sticky;
  top: -.5rem;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .4rem .35rem;
  background: #fbfcfe;
}
.perm-group__title {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  font-size: .72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .03em;
  color: #64748b;
}
.perm-group__count {
  background: #e2e8f0;
  color: #475569;
  border-radius: 999px;
  padding: 0 .4rem;
  font-size: .68rem;
}
.perm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: .25rem;
}
.perm-item {
  display: flex;
  align-items: center;
  gap: .5rem;
  margin: 0;
  padding: .35rem .55rem;
  border: 1px solid transparent;
  border-radius: 7px;
  font-size: .82rem;
  color: #475569;
  cursor: pointer;
  transition: background .12s, border-color .12s;
}
.perm-item:hover { background: #eef2ff; }
.perm-item--on {
  background: #eef2ff;
  border-color: #c7d2fe;
  color: #3730a3;
  font-weight: 500;
}
.perm-item .form-check-input { margin: 0; flex-shrink: 0; }
</style>
