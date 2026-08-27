<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { Modal } from 'bootstrap';
import { useRolesStore } from '@/stores/roles';
import { usePermissionsStore } from '@/stores/permissions';
import { getRoles } from '@/services/roles';
import { showAlerta } from '@/funciones';
import { Pencil, Trash, Plus, ShieldCheck, Search, KeyRound, Users } from 'lucide-vue-next';

// --- Stores ---
const rolesStore = useRolesStore();
const permissionsStore = usePermissionsStore();
const { items: roles, loading, error } = storeToRefs(rolesStore);
const { items: permissions, loading: loadingPermisos } = storeToRefs(permissionsStore);
const { fetchAll, add, save, remove } = rolesStore;

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
  await Promise.all([fetchAll(), permissionsStore.fetchAll()]);
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
      <button class="btn btn-success shadow-sm px-3 py-2 d-flex align-items-center" @click="openModal(null)">
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
                <th class="text-center" style="width: 12%;">Acciones</th>
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
                      <span class="fw-semibold text-capitalize d-block">{{ role.name }}</span>
                      <span v-if="role.users_count != null" class="text-muted small d-flex align-items-center gap-1">
                        <Users :size="13" /> {{ role.users_count }} usuario(s)
                      </span>
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
                <td class="text-center">
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
      <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div class="modal-content border-0 shadow-lg">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title fw-bold">{{ modalTitle }}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" :disabled="saving"></button>
          </div>

          <div class="modal-body p-4">
            <form id="roleForm" @submit.prevent="handleSubmit">
              <div class="mb-3">
                <label for="roleName" class="form-label fw-bold text-secondary">
                  Nombre del rol <span class="text-danger">*</span>
                </label>
                <input
                  id="roleName"
                  type="text"
                  v-model="draft.name"
                  class="form-control form-control-lg"
                  placeholder="Ej: coordinador"
                  autocomplete="off"
                  required
                  :disabled="saving"
                >
              </div>

              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="form-label fw-bold text-secondary mb-0">
                  Permisos
                  <span class="badge bg-primary ms-1">{{ draft.permissions.length }}</span>
                </label>
              </div>

              <div class="input-group mb-3">
                <span class="input-group-text bg-white text-muted"><Search :size="16" /></span>
                <input
                  type="text"
                  v-model="search"
                  class="form-control"
                  placeholder="Buscar permiso..."
                  autocomplete="off"
                  :disabled="saving"
                >
              </div>

              <div v-if="loadingPermisos" class="text-center py-4 text-muted">
                <div class="spinner-border spinner-border-sm text-primary me-2"></div> Cargando permisos...
              </div>

              <div v-else-if="loadingRole" class="text-center py-4 text-muted">
                <div class="spinner-border spinner-border-sm text-primary me-2"></div> Cargando permisos del rol...
              </div>

              <div v-else-if="gruposFiltrados.length === 0" class="text-center py-4 text-muted fst-italic">
                No se encontraron permisos.
              </div>

              <div v-else class="perm-scroll border rounded-3 p-2">
                <div v-for="grupo in gruposFiltrados" :key="grupo.titulo" class="mb-3">
                  <div class="d-flex align-items-center justify-content-between px-1 mb-1">
                    <span class="text-uppercase small fw-bold text-muted d-flex align-items-center gap-1">
                      <KeyRound :size="13" /> {{ grupo.titulo }}
                    </span>
                    <button
                      type="button"
                      class="btn btn-link btn-sm p-0 text-decoration-none"
                      :disabled="saving"
                      @click="toggleGrupo(grupo.items)"
                    >
                      {{ grupoCompleto(grupo.items) ? 'Quitar todos' : 'Seleccionar todos' }}
                    </button>
                  </div>
                  <div class="row g-1">
                    <div v-for="permiso in grupo.items" :key="permiso.id" class="col-12 col-sm-6">
                      <div class="form-check bg-light rounded px-2 py-1 m-0 d-flex align-items-center">
                        <input
                          class="form-check-input mt-0 me-2"
                          type="checkbox"
                          :id="'perm-' + permiso.id"
                          :value="permiso.name"
                          v-model="draft.permissions"
                          :disabled="saving"
                        >
                        <label class="form-check-label small text-truncate w-100" :for="'perm-' + permiso.id">
                          {{ permiso.name }}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div class="modal-footer bg-light">
            <button type="button" class="btn btn-light" data-bs-dismiss="modal" :disabled="saving">Cancelar</button>
            <button type="submit" form="roleForm" class="btn btn-primary px-4" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
              {{ saving ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.perm-scroll {
  max-height: 42vh;
  overflow-y: auto;
  background-color: #fbfcfe;
}

.bg-light {
  background-color: #f8f9fa !important;
}
</style>
