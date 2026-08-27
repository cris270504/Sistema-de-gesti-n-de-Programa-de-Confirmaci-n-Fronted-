<script setup>
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
import {
  SquarePen, UserPlus, User, IdCard, Phone, Mail, CalendarDays,
  Info, Check,
} from 'lucide-vue-next';

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
    showAlerta('Error al cargar datos', 'error');
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
          <div>
            <h5 class="modal-title fw-bold text-white">
              <component :is="isEditing ? SquarePen : UserPlus" class="h-5 w-5 me-2 text-white-50 d-inline-block align-text-bottom" aria-hidden="true" />
              {{ title }}
            </h5>
            <p class="text-white-50 small mb-0">Complete los datos del formulario.</p>
          </div>
          <button type="button" class="btn-close btn-close-white" @click="close" aria-label="Close"></button>
        </div>

        <div class="modal-body">
          <div v-if="loading && isEditing" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted fw-medium">Cargando...</p>
          </div>

          <form v-else @submit.prevent="submitUpdate" id="userForm" class="needs-validation">
            <div class="row g-4">

              <div class="col-12">
                <label for="userName" class="form-label fw-bold text-secondary small text-uppercase">Nombre Completo</label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <User class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input id="userName" v-model="draft.name" type="text" class="form-control border-start-0"
                    placeholder="Ej. Christopher Carrillo" required :disabled="saving">
                </div>
              </div>

              <div class="col-md-4">
                <label for="userDni" class="form-label fw-bold text-secondary small text-uppercase">DNI</label>
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
                <label for="userCelular" class="form-label fw-bold text-secondary small text-uppercase">Celular</label>
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
                <label for="userFechaNacimiento" class="form-label fw-bold text-secondary small text-uppercase">Fecha de nacimiento</label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <CalendarDays class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input id="userFechaNacimiento" v-model="draft.fechaNacimiento" type="date"
                    class="form-control border-start-0" required :disabled="saving">
                </div>
              </div>

              <div class="col-12">
                <label for="userEmail" class="form-label fw-bold text-secondary small text-uppercase">Correo Electrónico</label>
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
                <label class="form-label fw-bold text-secondary small text-uppercase mb-2">Asignar Roles</label>
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
                  <div v-else class="text-muted fst-italic py-2">
                    <div class="spinner-border spinner-border-sm text-primary me-2"></div> Cargando...
                  </div>
                </div>
              </div>

              <!-- SECCIÓN DE GRUPOS -->
              <div class="col-12">
                <label class="form-label fw-bold text-secondary small text-uppercase mb-2">Asignar Grupos (Opcional)</label>
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
                  <div v-else-if="loading" class="text-muted fst-italic py-2">
                    <div class="spinner-border spinner-border-sm text-primary me-2"></div> Cargando...
                  </div>
                  <div v-else class="text-muted fst-italic py-2">
                    <Info class="h-4 w-4 me-1" aria-hidden="true" /> No hay grupos disponibles.
                  </div>
                </div>
              </div>

            </div>
          </form>
        </div>

        <div class="modal-footer bg-light-subtle">
          <button type="button" class="btn btn-outline-secondary px-4 fw-medium border-0" @click="close"
            :disabled="saving">
            Cancelar
          </button>
          <button type="submit" form="userForm" class="btn btn-primary px-4 fw-medium shadow-sm" :disabled="saving">
            <template v-if="saving">
              <span class="spinner-border spinner-border-sm me-2"></span>
            </template>
            <template v-else>
              <Check class="h-4 w-4 me-1" aria-hidden="true" /> Guardar
            </template>
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================================
    ESTÉTICA "BLUE HEADER"
  ========================================= */

/* 1. ESTRUCTURA */
.modal-content {
  border: none;
  border-radius: 1rem;
  background-color: #f8fafc;
  /* Gris nube */
  overflow: hidden;
  /* Para que el header no se salga de las esquinas */
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
}

/* 2. HEADER COLORIDO */
.modal-header {
  /* Degradado Azul Real a un tono un poco más oscuro */
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  padding: 1.5rem 2rem;
  border-bottom: none;
}

.text-white-50 {
  color: rgba(255, 255, 255, 0.75) !important;
}

/* 3. BODY & INPUTS */
.modal-body {
  padding: 2rem;
}

/* Inputs */
.form-control {
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  padding: 0.7rem 1rem;
  font-size: 0.95rem;
  color: #334155;
  border-left: none;
}

/* Iconos de Input */
.bg-blue-soft {
  background-color: #eff6ff !important;
  border: 1px solid #cbd5e1;
  border-right: none;
  color: #2563eb !important;
  /* Icono Azul */
}

/* Focus State */
.input-group:focus-within {
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
  border-radius: 0.375rem;
}

.input-group:focus-within .form-control,
.input-group:focus-within .bg-blue-soft {
  border-color: #2563eb;
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
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  color: #64748b;
  font-weight: 500;
  font-size: 0.85rem;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.role-card:hover {
  border-color: #93c5fd;
  color: #2563eb;
}

/* Rol Seleccionado */
.btn-check:checked+.role-card {
  background-color: #2563eb !important;
  /* Azul Real */
  border-color: #2563eb !important;
  color: #ffffff !important;
}

.btn-check:checked+.role-card i {
  color: #ffffff !important;
}

/* 5. FOOTER */
.modal-footer {
  padding: 1rem 2rem 1.5rem;
  border-top: 1px solid #e2e8f0;
}

/* Botones */
.btn-primary {
  background-color: #2563eb;
  border-color: #2563eb;
  padding: 0.6rem 1.5rem;
  transition: all 0.2s;
}

.btn-primary:hover {
  background-color: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);
}

.btn-outline-secondary:hover {
  background-color: #f1f5f9;
  color: #0f172a;
}
</style>