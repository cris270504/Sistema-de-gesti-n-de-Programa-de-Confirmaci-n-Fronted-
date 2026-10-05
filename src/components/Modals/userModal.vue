<script setup>
import AppSkeleton from '@/components/AppSkeleton.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import AppButton from '@/components/AppButton.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useUsersStore } from '../../stores/users';
import { useRolesStore } from '../../stores/roles';
import { useGruposStore } from '../../stores/grupos'; // ➔ NUEVO: Importamos el store de grupos
import { useParroquiaStore } from '@/stores/parroquia';
import { storeToRefs } from 'pinia';
import { showAlerta } from '@/funciones';
import { Modal } from 'bootstrap';
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn';
import { useFieldValidation, validarDni, validarCelular, validarEmail } from '@/composables/useFieldValidation';
import { SquarePen, UserPlus, User, IdCard, Phone, Mail, CalendarDays, Check, Layers } from 'lucide-vue-next';

const usersStore = useUsersStore();
const rolesStore = useRolesStore();
const gruposStore = useGruposStore(); // ➔ NUEVO: Instanciamos el store

const { items: availableRoles } = storeToRefs(rolesStore);
const parroquiaStore = useParroquiaStore();
// El proveedor no se asigna desde la UI de una parroquia.
const rolesVisibles = computed(() => (availableRoles.value || []).filter(r => r.name !== 'proveedor'));
const { items: availableGrupos } = storeToRefs(gruposStore); // ➔ NUEVO: Extraemos los grupos disponibles

const emit = defineEmits(['saved']);
const modalRef = ref(null);
const modalInstance = ref(null);

// ➔ NUEVO: Agregamos grupo_ids al estado inicial
const draft = ref({ 
  id: null, 
  name: '', 
  celular: '', 
  dni: '', 
  email: '', 
  fechaNacimiento: null, 
  roles: [],
  grupo_ids: [] 
});

const loading = ref(false);
const saving = ref(false);

const isEditing = computed(() => !!draft.value.id);
const title = computed(() => (isEditing.value ? 'Editar Usuario' : 'Nuevo Usuario'));

const { errores, marcarTocado } = useFieldValidation({
  dni: () => validarDni(draft.value.dni),
  celular: () => validarCelular(draft.value.celular),
  email: () => validarEmail(draft.value.email),
});

let detachFocusReturn = () => {};
onMounted(() => {
  modalInstance.value = new Modal(modalRef.value, {
    backdrop: 'static',
    keyboard: false
  });
  detachFocusReturn = attachModalFocusReturn(modalRef.value);
});

onUnmounted(() => {
  detachFocusReturn();
  modalInstance.value?.dispose();
});

const open = async (id = null) => {
  // ➔ NUEVO: Limpiamos grupo_ids al abrir
  draft.value = {
    id: id,
    name: '',
    celular: '',
    dni: '',
    email: '',
    fechaNacimiento: null,
    roles: [],
    grupo_ids: []
  };

  modalInstance.value.show();

  // Cargamos roles si no existen
  if (!availableRoles.value || availableRoles.value.length === 0) {
    await rolesStore.fetchAll();
  }

  // ➔ NUEVO: Cargamos grupos si no existen
  if (!availableGrupos.value || availableGrupos.value.length === 0) {
    await gruposStore.fetchAll();
  }

  if (id) {
    await loadUserData(id);
  }
};

const close = () => {
  modalInstance.value.hide();
};

defineExpose({ open });

async function loadUserData(id) {
  loading.value = true;
  try {
    const user = await usersStore.fetchById(Number(id));
    
    if (user) {
      draft.value = {
        id: user.id,
        name: user.name ?? '',
        celular: user.celular ?? null,
        dni: user.dni ?? '',
        email: user.email ?? '',
        fechaNacimiento: user.fecha_nacimiento || '', 
        roles: user.roles?.map(role => role.id) || [],
        // ➔ NUEVO: Mapeamos los IDs de los grupos del usuario
        grupo_ids: user.grupos?.map(g => g.id) || [] 
      };
    } else {
      showAlerta(`Usuario no encontrado`, 'warning');
      close();
    }
  } catch(e) {
    console.error("Error al cargar:", e);
    showAlerta(e?.message || 'Error al cargar datos', 'error');
    close();
  } finally {
    loading.value = false;
  }
}

async function submitUpdate() {
  if (saving.value) return;

  const name = draft.value.name?.trim();
  const celular = draft.value.celular?.trim();
  const selectedRoleIds = draft.value.roles;
  const dni = draft.value.dni?.trim();
  const email = draft.value.email?.trim();
  const fechaNacimiento = draft.value.fechaNacimiento;
  const grupoIds = draft.value.grupo_ids; // ➔ NUEVO: Capturamos los grupos seleccionados

  if (!name) return showAlerta('El nombre es obligatorio', 'warning');
  if (!dni) return showAlerta('El DNI es obligatorio', 'warning');
  if (!email) return showAlerta('El email es obligatorio', 'warning');
  if (!selectedRoleIds || selectedRoleIds.length === 0) return showAlerta('Selecciona al menos un rol', 'warning');

  const selectedRoleNames = selectedRoleIds.map(id => {
    const role = availableRoles.value.find(r => r.id === id);
    return role ? role.name : null;
  }).filter(name => name !== null);

  // ➔ NUEVO: Agregamos grupo_ids al payload
  const payload = { 
    name, 
    roles: selectedRoleNames, 
    celular, 
    dni, 
    email, 
    fecha_nacimiento: fechaNacimiento,
    grupo_ids: grupoIds 
  };

  saving.value = true;
  try {
    let result;
    if (draft.value.id) {
      result = await usersStore.save(draft.value.id, payload);
    } else {
      result = await usersStore.add(payload);
    }
    emit('saved', { id: draft.value.id || result?.id });
    close();
  } catch (e) {
    console.error("Error al guardar:", e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="modal fade" ref="modalRef" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">

        <div class="modal-header">
          <span class="modal-header__icon" aria-hidden="true">
            <component :is="isEditing ? SquarePen : UserPlus" :size="18" />
          </span>
          <div class="modal-header__text">
            <h5 class="modal-title">{{ title }}</h5>
            <p class="modal-subtitle">Complete los datos del formulario.</p>
          </div>
          <button type="button" class="btn-close" @click="close" aria-label="Cerrar"></button>
        </div>

        <div class="modal-body">
          <div v-if="loading && isEditing" role="status" aria-live="polite" aria-label="Cargando usuario">
            <AppSkeleton skeleton="form" />
          </div>

          <form v-else @submit.prevent="submitUpdate" id="userForm" class="needs-validation">
            <div class="row g-4">

              <div class="col-12">
                <label for="userName" class="form-label fw-bold text-secondary small">Nombre Completo</label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <User class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input id="userName" v-model="draft.name" type="text" class="form-control border-start-0"
                    placeholder="Ej. Christopher Carrillo" required :disabled="saving">
                </div>
              </div>

              <div class="col-md-4">
                <label for="userDni" class="form-label fw-bold text-secondary small">DNI</label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <IdCard class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input id="userDni" v-model="draft.dni" type="text" class="form-control border-start-0"
                    :class="{ 'is-invalid': errores.dni }" @blur="marcarTocado('dni')"
                    placeholder="12345678" required :disabled="saving">
                  <div v-if="errores.dni" class="invalid-feedback">{{ errores.dni }}</div>
                </div>
              </div>

              <div class="col-md-4">
                <label for="userCelular" class="form-label fw-bold text-secondary small">Celular</label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <Phone class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input id="userCelular" v-model="draft.celular" type="text" class="form-control border-start-0"
                    :class="{ 'is-invalid': errores.celular }" @blur="marcarTocado('celular')"
                    placeholder="987654321" :disabled="saving">
                  <div v-if="errores.celular" class="invalid-feedback">{{ errores.celular }}</div>
                </div>
              </div>

              <div class="col-md-4">
                <label for="userFechaNacimiento" class="form-label fw-bold text-secondary small">Fecha de nacimiento</label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <CalendarDays class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input id="userFechaNacimiento" v-model="draft.fechaNacimiento" type="date"
                    class="form-control border-start-0" required :disabled="saving">
                </div>
              </div>

              <div class="col-12">
                <label for="userEmail" class="form-label fw-bold text-secondary small">Correo Electrónico</label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <Mail class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input id="userEmail" v-model="draft.email" type="email" class="form-control border-start-0"
                    :class="{ 'is-invalid': errores.email }" @blur="marcarTocado('email')"
                    placeholder="usuario@ejemplo.com" required :disabled="saving">
                  <div v-if="errores.email" class="invalid-feedback">{{ errores.email }}</div>
                </div>
              </div>

              <!-- SECCIÓN DE ROLES -->
              <div class="col-12">
                <label class="form-label fw-bold text-secondary small mb-2">Asignar Roles</label>
                <div class="chip-container p-3 rounded-3 bg-white border">
                  <div v-if="rolesVisibles.length" class="d-flex flex-wrap gap-2">
                    <template v-for="role in rolesVisibles" :key="role.id">
                      <input class="btn-check" type="checkbox" :id="'role-' + role.id" :value="role.id"
                        v-model="draft.roles" :disabled="saving" />
                      <label class="role-card d-flex align-items-center gap-1 px-3 py-2 rounded-pill transition-all"
                        :for="'role-' + role.id">
                        <Check v-if="draft.roles.includes(role.id)" class="h-4 w-4" aria-hidden="true" />
                        <span>{{ parroquiaStore.roleLabel(role.name) }}</span>
                      </label>
                    </template>
                  </div>
                  <div v-else role="status" aria-live="polite" aria-label="Cargando roles">
                    <AppSkeleton skeleton="lines" />
                  </div>
                </div>
              </div>

              <!-- SECCIÓN DE GRUPOS -->
              <div class="col-12">
                <label class="form-label fw-bold text-secondary small mb-2">Asignar Grupos (Opcional)</label>
                <div class="chip-container chip-container--scroll p-3 rounded-3 bg-white border">
                  <div v-if="availableGrupos && availableGrupos.length" class="d-flex flex-wrap gap-2">
                    <template v-for="grupo in availableGrupos" :key="grupo.id">
                      <input class="btn-check" type="checkbox" :id="'grupo-' + grupo.id" :value="grupo.id"
                        v-model="draft.grupo_ids" :disabled="saving" />
                      <label class="role-card d-flex align-items-center gap-1 px-3 py-2 rounded-pill transition-all"
                        :for="'grupo-' + grupo.id">
                        <Check v-if="draft.grupo_ids.includes(grupo.id)" class="h-4 w-4 text-primary" aria-hidden="true" />
                        <span>{{ grupo.nombre }}</span>
                      </label>
                    </template>
                  </div>
                  <div v-else-if="loading" role="status" aria-live="polite" aria-label="Cargando grupos">
                    <AppSkeleton skeleton="lines" />
                  </div>
                  <AppEmpty v-else compact :icon="Layers" message="Aún no hay grupos para asignar." />
                </div>
              </div>

            </div>
          </form>
        </div>

        <div class="modal-footer">
          <AppButton variant="secondary" type="button" @click="close" :disabled="saving">Cancelar</AppButton>
          <AppButton type="submit" form="userForm" :icon="Check" :loading="saving">Guardar</AppButton>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================================
    ESTÉTICA "BLUE HEADER"
  ========================================= */

/* Inputs */
.form-control {
  background-color: var(--surface);
  border: 1px solid var(--line-strong);
  padding: 0.7rem 1rem;
  font-size: var(--fs-base);
  color: var(--text);
  border-left: none;
}

/* Iconos de Input */
.bg-blue-soft {
  background-color: var(--accent-soft) !important;
  border: 1px solid var(--line-strong);
  border-right: none;
  color: var(--accent) !important;
  /* Icono Azul */
}

/* Focus State */
.input-group:focus-within {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent);
  border-radius: var(--radius-sm);
}

.input-group:focus-within .form-control,
.input-group:focus-within .bg-blue-soft {
  border-color: var(--accent);
}

/* 4. ROLES Y GRUPOS (chips) */
.chip-container {
  max-height: 190px;
  overflow-y: auto;
}

.chip-container--scroll {
  max-height: 220px;
}

.role-card {
  background-color: var(--surface);
  border: 1px solid var(--line);
  color: var(--text-muted);
  font-weight: 500;
  font-size: var(--fs-ui);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  box-shadow: var(--shadow-sm);
}

.role-card:hover {
  border-color: #93c5fd;
  color: var(--accent);
}

/* Rol Seleccionado */
.btn-check:checked+.role-card {
  background-color: var(--accent) !important;
  /* Azul Real */
  border-color: var(--accent) !important;
  color: #ffffff !important;
}

.btn-check:checked+.role-card i {
  color: #ffffff !important;
}

/* ===== MODO OSCURO ===== */
:root[data-bs-theme="dark"] .form-control {
  background-color: var(--surface-sunken);
  border-color: var(--line-strong);
  color: var(--text);
}
:root[data-bs-theme="dark"] .bg-blue-soft {
  background-color: #1e2547 !important;
  border-color: var(--line-strong);
  color: #93c5fd !important;
}
:root[data-bs-theme="dark"] .role-card {
  background-color: var(--surface);
  border-color: var(--line);
  color: var(--text-muted);
}
:root[data-bs-theme="dark"] .role-card:hover {
  border-color: var(--accent);
  color: #93c5fd;
}
</style>