<script setup>
import { ref, computed, onMounted } from 'vue';
import { useConfirmandosStore } from '../../stores/confirmandos';
import { useGruposStore } from '../../stores/grupos';
import { useSacramentosStore } from '../../stores/sacramentos';
import { useTiposApoderadoStore } from '../../stores/tiposApoderado';
import { storeToRefs } from 'pinia';
import { showAlerta } from '@/funciones';
import { Modal } from 'bootstrap';

const emit = defineEmits(['saved']);

// Stores
const confirmandoStore = useConfirmandosStore();
const gruposStore = useGruposStore();
const sacramentosStore = useSacramentosStore();
const tiposApoderadoStore = useTiposApoderadoStore();

const { items: availableGrupos } = storeToRefs(gruposStore);
const { items: availableSacramentos } = storeToRefs(sacramentosStore);
const { items: tiposApoderado } = storeToRefs(tiposApoderadoStore);

// Modal Refs
const modalRef = ref(null);
const modalInstance = ref(null);

// Estado
const draft = ref({
  id: null,
  nombres: '',
  apellidos: '',
  celular: '',
  genero: null,
  fecha_nacimiento: '',
  grupo_id: null,
  sacramento_faltante_id: null,
  apoderados: []
});

const loading = ref(false);
const saving = ref(false);

const isEditing = computed(() => !!draft.value.id);
const title = computed(() => (isEditing.value ? 'Editar Confirmando' : 'Nuevo Confirmando'));

const maxDate = computed(() => {
  const today = new Date();
  return `${today.getFullYear() - 14}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
});

// Inicializar Modal
onMounted(() => {
  modalInstance.value = new Modal(modalRef.value, {
    backdrop: 'static',
    keyboard: false
  });
});

// --- FUNCIÓN PÚBLICA OPEN ---
const open = async (id = null) => {
  // 1. Resetear
  draft.value = {
    id: id, nombres: '', apellidos: '', celular: '', genero: null,
    fecha_nacimiento: '', grupo_id: null, sacramento_faltante_id: null, apoderados: []
  };

  modalInstance.value.show();

  // 2. Cargar catálogos si faltan (Paralelo)
  const promises = [];
  if (!availableGrupos.value.length) promises.push(gruposStore.fetchAll());
  if (!availableSacramentos.value.length) promises.push(sacramentosStore.fetchAll());
  if (!tiposApoderado.value.length) promises.push(tiposApoderadoStore.fetchAll());

  if (promises.length > 0) {
    loading.value = true;
    await Promise.all(promises);
    loading.value = false;
  }

  // 3. Cargar datos si es edición
  if (id) {
    await loadData(id);
  }
};

const close = () => {
  modalInstance.value.hide();
};

defineExpose({ open });

// --- LÓGICA DE NEGOCIO ---

async function loadData(id) {
  loading.value = true;
  try {
    const confirmando = await confirmandoStore.fetchById(Number(id));

    if (confirmando) {
      const sacramentoPendiente = confirmando.sacramentos?.find(s => s.pivot.estado === 'pendiente');

      draft.value = {
        id: confirmando.id,
        nombres: confirmando.nombres ?? '',
        apellidos: confirmando.apellidos ?? '',
        celular: confirmando.celular ?? '',
        genero: confirmando.genero ?? null,
        fecha_nacimiento: confirmando.fecha_nacimiento ?? '',
        grupo_id: confirmando.grupo_id ?? null,
        sacramento_faltante_id: sacramentoPendiente ? sacramentoPendiente.id : null,
        apoderados: confirmando.apoderados?.map(ap => ({
          nombres: ap.nombres,
          apellidos: ap.apellidos,
          celular: ap.celular,
          tipo_apoderado_id: ap.pivot.tipo_apoderado_id
        })) || []
      };
    } else {
      showAlerta(`Confirmando no encontrado`, 'warning');
      close();
    }
  } catch (e) {
    console.error("Error al cargar:", e);
    showAlerta('Error al cargar datos', 'error');
    close();
  } finally {
    loading.value = false;
  }
}

const addApoderado = () => {
  draft.value.apoderados.push({ nombres: '', apellidos: '', celular: '', tipo_apoderado_id: '' });
};

const removeApoderado = (index) => {
  draft.value.apoderados.splice(index, 1);
};

async function submitUpdate() {
  if (saving.value) return;

  const payload = {
    nombres: draft.value.nombres?.trim(),
    apellidos: draft.value.apellidos?.trim(),
    celular: draft.value.celular?.trim() || null,
    genero: draft.value.genero?.trim() || null,
    fecha_nacimiento: draft.value.fecha_nacimiento,
    grupo_id: draft.value.grupo_id || null,
    sacramento_faltante_id: draft.value.sacramento_faltante_id,
    apoderados: draft.value.apoderados
  };

  if (!payload.nombres) return showAlerta('Faltan Nombres', 'warning');
  if (!payload.apellidos) return showAlerta('Faltan Apellidos', 'warning');
  if (!payload.fecha_nacimiento) return showAlerta('Falta Fecha Nacimiento', 'warning');

  // Validación de edad solo si la fecha cambió o es nuevo
  if (payload.fecha_nacimiento > maxDate.value) return showAlerta('Debe tener al menos 14 años.', 'warning');

  if (!isEditing.value && !payload.sacramento_faltante_id) {
    return showAlerta('Debes seleccionar el sacramento a realizar', 'warning');
  }

  for (const ap of payload.apoderados) {
    if (!ap.nombres || !ap.apellidos || !ap.tipo_apoderado_id) {
      return showAlerta('Completa los datos de todos los apoderados', 'warning');
    }
  }

  saving.value = true;
  try {
    let result;
    if (draft.value.id) {
      result = await confirmandoStore.save(draft.value.id, payload);
    } else {
      result = await confirmandoStore.add(payload);
    }
    emit('saved', { id: draft.value.id || result?.id });
    close();
  } catch (e) {
    console.error(e);
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
              <i class="bi me-2 text-white-50" :class="isEditing ? 'bi-pencil-square' : 'bi-person-plus-fill'"></i>
              {{ title }}
            </h5>
            <p class="text-white-50 small mb-0">Gestión de datos del confirmando y familia.</p>
          </div>
          <button type="button" class="btn-close btn-close-white" @click="close" aria-label="Close"></button>
        </div>

        <div class="modal-body">
          <div v-if="loading && isEditing" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted fw-medium">Cargando expediente...</p>
          </div>

          <form v-else @submit.prevent="submitUpdate" id="confirmandoForm" class="needs-validation">
            <div class="row g-4">

              <div class="col-12">
                <h6 class="text-uppercase text-secondary fw-bold small mb-3 border-bottom pb-2">Datos Personales</h6>
              </div>

              <div class="col-md-6">
                <label class="form-label fw-bold text-secondary small text-uppercase">Apellidos <span
                    class="text-danger">*</span></label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0"><i
                      class="bi bi-person-lines-fill"></i></span>
                  <input v-model="draft.apellidos" type="text" class="form-control border-start-0" required
                    :disabled="saving">
                </div>
              </div>

              <div class="col-md-6">
                <label class="form-label fw-bold text-secondary small text-uppercase">Nombres <span
                    class="text-danger">*</span></label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0"><i
                      class="bi bi-person-fill"></i></span>
                  <input v-model="draft.nombres" type="text" class="form-control border-start-0" required
                    :disabled="saving">
                </div>
              </div>

              <div class="col-md-5">
                <label class="form-label fw-bold text-secondary small text-uppercase">Fecha Nacimiento </label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0"><i
                      class="bi bi-calendar-event"></i></span>
                  <input v-model="draft.fecha_nacimiento" :max="maxDate" type="date" class="form-control border-start-0"
                    required :disabled="saving">
                </div>
              </div>

              <div class="col-md-3">
                <label class="form-label fw-bold text-secondary small text-uppercase">Celular</label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0"><i
                      class="bi bi-phone"></i></span>
                  <input v-model="draft.celular" type="tel" class="form-control border-start-0" maxlength="9"
                    :disabled="saving">
                </div>
              </div>

              <div class="col-md-4">
                <label class="form-label fw-bold text-secondary small text-uppercase">Género</label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <i class="bi bi-person"></i>
                  </span>

                  <select v-model="draft.genero" class="form-select border-start-0" :disabled="saving">
                    <option :value="null">-- Sin asignar --</option>
                    <option value="m">Masculino</option>
                    <option value="f">Femenino</option>
                  </select>
                </div>
              </div>

              <div class="col-12 mt-4">
                <h6 class="text-uppercase text-secondary fw-bold small mb-3 border-bottom pb-2">Información Eclesiástica
                </h6>
              </div>

              <div class="col-md-6">
                <label class="form-label fw-bold text-secondary small text-uppercase">Grupo Asignado</label>
                <select v-model="draft.grupo_id" class="form-select" :disabled="saving">
                  <option :value="null">-- Sin asignar --</option>
                  <option v-for="g in availableGrupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
                </select>
              </div>

              <div class="col-md-6">
                <label class="form-label fw-bold text-secondary small text-uppercase">
                  Sacramento faltante <span class="text-danger">*</span>
                </label>
                <select v-model="draft.sacramento_faltante_id" class="form-select border-primary" required
                  :disabled="saving">
                  <option :value="null" disabled>-- Seleccionar --</option>
                  <option v-for="sac in availableSacramentos" :key="sac.id" :value="sac.id">{{ sac.nombre }}</option>
                </select>
              </div>

              <div class="col-12 mt-4">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                  <h6 class="text-uppercase text-secondary fw-bold small mb-0">Apoderados</h6>
                  <button type="button" class="btn btn-sm btn-soft-primary fw-bold" @click="addApoderado"
                    :disabled="saving">
                    <i class="bi bi-plus-lg me-1"></i> Agregar
                  </button>
                </div>

                <div v-if="draft.apoderados.length === 0"
                  class="text-center p-4 bg-light rounded-3 text-muted border border-dashed">
                  <i class="bi bi-people display-6 opacity-25"></i>
                  <p class="mb-0 mt-2 small">No hay apoderados registrados.</p>
                </div>

                <div v-else class="d-flex flex-column gap-3">
                  <div v-for="(ap, index) in draft.apoderados" :key="index"
                    class="card border shadow-sm apoderado-card">
                    <div class="card-body p-3 position-relative">
                      <button type="button" class="btn-close position-absolute top-0 end-0 m-2"
                        @click="removeApoderado(index)" :disabled="saving" aria-label="Eliminar"></button>

                      <div class="row g-2">
                        <div class="col-12 mb-1">
                          <label class="form-label small fw-bold text-primary mb-1">Parentesco</label>
                          <select v-model="ap.tipo_apoderado_id" class="form-select form-select-sm" required
                            :disabled="saving">
                            <option value="" disabled>-- Seleccione --</option>
                            <option v-for="tipo in tiposApoderado" :key="tipo.id" :value="tipo.id">{{ tipo.nombre }}
                            </option>
                          </select>
                        </div>
                        <div class="col-md-6">
                          <label class="form-label small text-muted mb-0">Apellidos</label>
                          <input type="text" v-model="ap.apellidos" class="form-control form-control-sm" required
                            :disabled="saving">
                        </div>
                        <div class="col-md-6">
                          <label class="form-label small text-muted mb-0">Nombres</label>
                          <input type="text" v-model="ap.nombres" class="form-control form-control-sm" required
                            :disabled="saving">
                        </div>
                        <div class="col-md-6">
                          <label class="form-label small text-muted mb-0">Celular</label>
                          <input type="tel" v-model="ap.celular" class="form-control form-control-sm" maxlength="9"
                            :disabled="saving">
                        </div>
                      </div>
                    </div>
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
          <button type="submit" form="confirmandoForm" class="btn btn-primary px-4 fw-medium shadow-sm"
            :disabled="saving">
            <template v-if="saving">
              <span class="spinner-border spinner-border-sm me-2"></span>
            </template>
            <template v-else>
              <i class="bi bi-check-lg me-1"></i> Guardar
            </template>
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================================
   ESTÉTICA "BLUE HEADER" (MODAL STANDARD)
========================================= */

/* 1. ESTRUCTURA */
.modal-content {
  border: none;
  border-radius: 1rem;
  background-color: #f8fafc;
  overflow: hidden;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
}

/* 2. HEADER COLORIDO */
.modal-header {
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

.form-control,
.form-select {
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  padding: 0.6rem 1rem;
  font-size: 0.95rem;
  color: #334155;
}

/* Inputs con grupo */
.form-control.border-start-0 {
  border-left: none;
}

.bg-blue-soft {
  background-color: #eff6ff !important;
  border: 1px solid #cbd5e1;
  border-right: none;
  color: #2563eb !important;
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

.form-select:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
}

/* 4. EXTRAS ESPECÍFICOS (Apoderados) */
.bg-primary-subtle {
  background-color: #e0e7ff !important;
  color: #1e40af;
  border-color: #c7d2fe;
}

.btn-soft-primary {
  background-color: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

.btn-soft-primary:hover {
  background-color: #2563eb;
  color: white;
}

.border-dashed {
  border-style: dashed !important;
}

.apoderado-card {
  transition: transform 0.2s;
}

.apoderado-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05) !important;
}

/* 5. FOOTER & BOTONES */
.modal-footer {
  padding: 1rem 2rem 1.5rem;
  border-top: 1px solid #e2e8f0;
}

.btn-primary {
  background-color: #2563eb;
  border-color: #2563eb;
  padding: 0.6rem 1.5rem;
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