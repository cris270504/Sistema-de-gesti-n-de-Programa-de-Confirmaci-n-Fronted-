<script setup>
import { onMounted, ref, computed } from 'vue';
import { useGruposStore } from '../../stores/grupos';
import { showAlerta } from '@/funciones';
import { Modal } from 'bootstrap';

const emit = defineEmits(['saved']);

const gruposStore = useGruposStore();

// Modal Refs
const modalRef = ref(null);
const modalInstance = ref(null);

// Estado
const draft = ref({
  id: null,
  nombre: '',
  periodo: '',
  color: '#2563eb', // Color azul por defecto
});
const loading = ref(false);
const saving = ref(false);

const isEditing = computed(() => !!draft.value.id);
const title = computed(() => (isEditing.value ? 'Editar Grupo' : 'Nuevo Grupo'));

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
  draft.value = { id: id, nombre: '', periodo: '', color: '#2563eb' };
  
  modalInstance.value.show();

  // 2. Cargar datos si es edición
  if (id) {
    await loadData(id);
  }
};

const close = () => {
  modalInstance.value.hide();
};

defineExpose({ open });

async function loadData(id) {
  loading.value = true;
  try {
    const grupo = await gruposStore.fetchById(Number(id));

    if (grupo) {
      draft.value = {
        id: grupo.id,
        nombre: grupo.nombre ?? '',
        periodo: grupo.periodo ?? '',
        color: grupo.color ?? '#2563eb',
      };
    } else {
      showAlerta(`Grupo no encontrado`, 'warning');
      close();
    }
  } catch (e) {
    console.error("Error al cargar:", e);
    showAlerta('Error al cargar datos del grupo', 'error');
    close();
  } finally {
    loading.value = false;
  }
}

async function submitUpdate() {
  if (saving.value) return;

  const payload = {
    nombre: draft.value.nombre?.trim(),
    periodo: draft.value.periodo?.trim(),
    color: draft.value.color,
  };

  if (!payload.nombre) return showAlerta('El nombre es obligatorio', 'warning');
  if (!payload.periodo) return showAlerta('El periodo es obligatorio', 'warning');
  if (!payload.color) return showAlerta('El color es obligatorio', 'warning');

  saving.value = true;
  try {
    let result;
    if (draft.value.id) {
      result = await gruposStore.save(draft.value.id, payload);
    } else {
      result = await gruposStore.add(payload);
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
    <div class="modal-dialog modal-dialog-centered"> 
      <div class="modal-content">
        
        <div class="modal-header">
          <div>
            <h5 class="modal-title fw-bold text-white">
              <i class="bi me-2 text-white-50" :class="isEditing ? 'bi-pencil-square' : 'bi-collection-fill'"></i> 
              {{ title }}
            </h5>
            <p class="text-white-50 small mb-0">Gestión de grupos pastorales.</p>
          </div>
          <button type="button" class="btn-close btn-close-white" @click="close" aria-label="Close"></button>
        </div>

        <div class="modal-body">
          <div v-if="loading && isEditing" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted fw-medium">Cargando...</p>
          </div>

          <form v-else @submit.prevent="submitUpdate" id="grupoForm" class="needs-validation">
            <div class="row g-4">
                
                <div class="col-12">
                  <label for="grupoNombre" class="form-label fw-bold text-secondary small text-uppercase">Nombre del Grupo</label>
                  <div class="input-group">
                    <span class="input-group-text bg-blue-soft text-primary border-end-0">
                      <i class="bi bi-tag-fill"></i>
                    </span>
                    <input 
                      id="grupoNombre" 
                      v-model="draft.nombre" 
                      type="text" 
                      class="form-control border-start-0" 
                      placeholder="Ej. San José"
                      required 
                      :disabled="saving">
                  </div>
                </div>

                <div class="col-12">
                  <label for="grupoPeriodo" class="form-label fw-bold text-secondary small text-uppercase">Periodo</label>
                  <div class="input-group">
                    <span class="input-group-text bg-blue-soft text-primary border-end-0">
                      <i class="bi bi-calendar-range"></i>
                    </span>
                    <input 
                      id="grupoPeriodo" 
                      v-model="draft.periodo" 
                      type="text" 
                      class="form-control border-start-0" 
                      placeholder="Ej. 2025-2026"
                      required 
                      :disabled="saving">
                  </div>
                </div>
                
                <div class="col-12">
                  <label for="grupoColor" class="form-label fw-bold text-secondary small text-uppercase">Color Identificativo</label>
                  <div class="d-flex align-items-center gap-3 p-3 bg-white border rounded-3">
                      <input 
                        type="color" 
                        class="form-control form-control-color border-0 p-0 shadow-sm" 
                        id="grupoColor" 
                        v-model="draft.color" 
                        :disabled="saving"
                        title="Elige un color">
                      
                      <div class="input-group input-group-sm w-auto">
                        <span class="input-group-text border-0 bg-light">HEX</span>
                        <input 
                            type="text" 
                            class="form-control border-0 bg-light fw-bold font-monospace" 
                            v-model="draft.color" 
                            maxlength="7" 
                            :disabled="saving">
                      </div>

                      <div class="ms-auto d-flex align-items-center gap-2">
                          <span class="badge rounded-pill px-3 py-2 border shadow-sm" 
                                :style="{ backgroundColor: draft.color, color: '#fff' }">
                              Vista Previa
                          </span>
                      </div>
                  </div>
                </div>

            </div>
          </form>
        </div>

        <div class="modal-footer bg-light-subtle">
          <button type="button" class="btn btn-outline-secondary px-4 fw-medium border-0" @click="close" :disabled="saving">
            Cancelar
          </button>
          <button type="submit" form="grupoForm" class="btn btn-primary px-4 fw-medium shadow-sm" :disabled="saving">
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
   ESTÉTICA "BLUE HEADER" (MODELO ESTÁNDAR)
========================================= */

/* 1. ESTRUCTURA */
.modal-content {
  border: none;
  border-radius: 1rem;
  background-color: #f8fafc;
  overflow: hidden;
  box-shadow: 0 15px 40px rgba(0,0,0,0.15);
}

/* 2. HEADER */
.modal-header {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  padding: 1.5rem 2rem;
  border-bottom: none;
}
.text-white-50 { color: rgba(255, 255, 255, 0.75) !important; }

/* 3. BODY & INPUTS */
.modal-body { padding: 2rem; }

.form-control {
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  padding: 0.6rem 1rem;
  font-size: 0.95rem;
  color: #334155;
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

/* Estilo especial para el color picker */
.form-control-color {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    cursor: pointer;
}
.form-control-color::-webkit-color-swatch { border: none; border-radius: 50%; padding: 0; }
.form-control-color::-webkit-color-swatch-wrapper { padding: 0; }

/* 4. FOOTER */
.modal-footer { padding: 1rem 2rem 1.5rem; border-top: 1px solid #e2e8f0; }

.btn-primary {
  background-color: #2563eb;
  border-color: #2563eb;
  padding: 0.6rem 1.5rem;
}
.btn-primary:hover {
  background-color: #1d4ed8;
}
.btn-outline-secondary:hover { background-color: #f1f5f9; color: #0f172a; }
</style>