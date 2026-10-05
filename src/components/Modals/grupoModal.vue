<script setup>
import AppSkeleton from '@/components/AppSkeleton.vue'
import AppButton from '@/components/AppButton.vue'
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useGruposStore } from '../../stores/grupos';
import { useParroquiaStore } from '@/stores/parroquia';
import { showAlerta } from '@/funciones';
import { Modal } from 'bootstrap';
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn';
import { SquarePen, Layers, Tag, MapPin, CalendarRange, Check } from 'lucide-vue-next';

const emit = defineEmits(['saved']);

const gruposStore = useGruposStore();
const parroquiaStore = useParroquiaStore();
const procedencias = computed(() => parroquiaStore.procedencias);

// Modal Refs
const modalRef = ref(null);
const modalInstance = ref(null);

// Estado
const draft = ref({
  id: null,
  nombre: '',
  periodo: '',
  color: '#2563eb', // Color azul por defecto
  procedencia: '',
});
const loading = ref(false);
const saving = ref(false);

const isEditing = computed(() => !!draft.value.id);
const title = computed(() => (isEditing.value ? 'Editar Grupo' : 'Nuevo Grupo'));

// Inicializar Modal
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

// --- FUNCIÓN PÚBLICA OPEN ---
// Si la parroquia usa una sola procedencia, el grupo la toma automáticamente
// (el campo se oculta) para no romper la validación de "procedencia obligatoria".
const procedenciaPorDefecto = () =>
  parroquiaStore.usaProcedencia ? null : (parroquiaStore.procedencias[0] ?? null);

const open = async (id = null) => {
  // 1. Resetear
  draft.value = { id: id, nombre: '', periodo: '', color: '#2563eb', procedencia: procedenciaPorDefecto() };

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
        procedencia: grupo.procedencia ?? procedenciaPorDefecto() ?? '',
      };
    } else {
      showAlerta(`Grupo no encontrado`, 'warning');
      close();
    }
  } catch (e) {
    console.error("Error al cargar:", e);
    showAlerta(e?.message || 'Error al cargar datos del grupo', 'error');
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
    procedencia: (draft.value.procedencia || '').trim(),
  };

  if (!payload.nombre) return showAlerta('El nombre es obligatorio', 'warning');
  if (!payload.periodo) return showAlerta('El periodo es obligatorio', 'warning');
  if (!payload.color) return showAlerta('El color es obligatorio', 'warning');
  if (!payload.procedencia) return showAlerta('La procedencia es obligatoria', 'warning');

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
          <span class="modal-header__icon" aria-hidden="true">
            <component :is="isEditing ? SquarePen : Layers" :size="18" />
          </span>
          <div class="modal-header__text">
            <h5 class="modal-title">{{ title }}</h5>
            <p class="modal-subtitle">Gestión de grupos pastorales.</p>
          </div>
          <button type="button" class="btn-close" @click="close" aria-label="Cerrar"></button>
        </div>

        <div class="modal-body">
          <div v-if="loading && isEditing" role="status" aria-live="polite" aria-label="Cargando grupo">
            <AppSkeleton skeleton="form" />
          </div>

          <form v-else @submit.prevent="submitUpdate" id="grupoForm" class="needs-validation">
            <div class="row g-4">

              <div class="col-12">
                <label for="grupoNombre" class="form-label fw-bold text-secondary small">Nombre del
                  Grupo</label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <Tag class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input id="grupoNombre" v-model="draft.nombre" type="text" class="form-control border-start-0"
                    placeholder="Ej. San José" required :disabled="saving">
                </div>
              </div>

              <div v-if="parroquiaStore.usaProcedencia" class="col-12">
                <label for="grupoProcedencia"
                  class="form-label fw-bold text-secondary small">Procedencia</label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <MapPin class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <select v-model="draft.procedencia" class="form-select border-start-0" :disabled="saving">
                    <option :value="null">-- Sin asignar --</option>
                    <option v-for="p in procedencias" :key="p" :value="p">
                      {{ p.charAt(0).toUpperCase() + p.slice(1) }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="col-12">
                <label for="grupoPeriodo" class="form-label fw-bold text-secondary small">Periodo</label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <CalendarRange class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input id="grupoPeriodo" v-model="draft.periodo" type="text" class="form-control border-start-0"
                    placeholder="Ej. 2025-2026" required :disabled="saving">
                </div>
              </div>

              <div class="col-12">
                <label for="grupoColor" class="form-label fw-bold text-secondary small">Color
                  Identificativo</label>
                <div class="d-flex align-items-center gap-3 p-3 bg-white border rounded-3">
                  <input type="color" class="form-control form-control-color border-0 p-0 shadow-sm" id="grupoColor"
                    v-model="draft.color" :disabled="saving" title="Elige un color">

                  <div class="input-group input-group-sm w-auto">
                    <span class="input-group-text border-0 bg-light">HEX</span>
                    <input type="text" class="form-control border-0 bg-light fw-bold font-monospace"
                      v-model="draft.color" maxlength="7" :disabled="saving">
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

        <div class="modal-footer">
          <AppButton variant="secondary" type="button" @click="close" :disabled="saving">Cancelar</AppButton>
          <AppButton type="submit" form="grupoForm" :icon="Check" :loading="saving">Guardar</AppButton>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================================
   ESTÉTICA "BLUE HEADER" (MODELO ESTÁNDAR)
========================================= */

/* El marco del modal (contenido, cabecera, cuerpo) usa el estilo global
   unificado de src/assets/main.css. Aquí solo quedan los estilos propios
   del formulario de grupos. */

/* INPUTS */

.form-control {
  background-color: var(--surface);
  border: 1px solid var(--line-strong);
  padding: 0.6rem 1rem;
  font-size: var(--fs-base);
  color: var(--text);
  border-left: none;
}

.bg-blue-soft {
  background-color: var(--accent-soft) !important;
  border: 1px solid var(--line-strong);
  border-right: none;
  color: var(--accent) !important;
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

/* Estilo especial para el color picker */
.form-control-color {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
}

.form-control-color::-webkit-color-swatch {
  border: none;
  border-radius: 50%;
  padding: 0;
}

.form-control-color::-webkit-color-swatch-wrapper {
  padding: 0;
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
</style>