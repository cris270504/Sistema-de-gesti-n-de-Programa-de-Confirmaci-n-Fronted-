<script setup>
import AppSkeleton from '@/components/AppSkeleton.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import AppButton from '@/components/AppButton.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useConfirmandosStore } from '../../stores/confirmandos';
import { useGruposStore } from '../../stores/grupos';
import { useSacramentosStore } from '../../stores/sacramentos';
import { useTiposApoderadoStore } from '../../stores/tiposApoderado';
import { useAuthStore } from '@/stores/auth';
import { useParroquiaStore } from '@/stores/parroquia';

import { storeToRefs } from 'pinia';
import { showAlerta, confirmar } from '@/funciones';
import { Modal } from 'bootstrap';
import { buscarApoderados } from '@/services/confirmandos';
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn';
import { useFieldValidation, validarCelular } from '@/composables/useFieldValidation';
import {
  SquarePen, UserPlus, Contact, User, CalendarDays, Smartphone,
  Plus, Users, CircleX, Check,
} from 'lucide-vue-next';

const emit = defineEmits(['saved']);

// Stores
const confirmandoStore = useConfirmandosStore();
const gruposStore = useGruposStore();
const sacramentosStore = useSacramentosStore();
const tiposApoderadoStore = useTiposApoderadoStore();
const authStore = useAuthStore()
const parroquiaStore = useParroquiaStore()

// Campos que la parroquia volvió obligatorios (Configuración → Datos del confirmando).
const obligatorio = (campo) => parroquiaStore.confirmandoEsObligatorio(campo)

const { items: availableGrupos } = storeToRefs(gruposStore);
const { items: availableSacramentos } = storeToRefs(sacramentosStore);
const { items: tiposApoderado } = storeToRefs(tiposApoderadoStore);

// Modal Refs
const modalRef = ref(null);
const modalInstance = ref(null);

const searchParentQuery = ref('');
const parentResults = ref([]);
const isExistingParent = ref(false);

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
  apoderados: [],
  estado: 'en_preparacion',
});

const loading = ref(false);
const saving = ref(false);

const isEditing = computed(() => !!draft.value.id);
const title = computed(() => (isEditing.value ? 'Editar Confirmando' : 'Nuevo Confirmando'));

const { errores, marcarTocado } = useFieldValidation({
  celular: () => validarCelular(draft.value.celular),
});

// Máximo permitido en el input = hoy (no se admite una fecha de nacimiento futura).
const maxDate = computed(() => new Date().toISOString().slice(0, 10));
// Mínimo razonable: 100 años atrás (evita fechas absurdas tipo 1850).
const minDate = computed(() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 100);
  return d.toISOString().slice(0, 10);
});

// Edad en años a partir de una fecha ISO (yyyy-mm-dd).
function edadDesde(iso) {
  if (!iso) return null;
  const hoy = new Date();
  const n = new Date(iso + 'T00:00:00');
  let e = hoy.getFullYear() - n.getFullYear();
  const m = hoy.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e--;
  return e;
}

const buscarPadresExistentes = async (e, index) => {
  const query = e.target.value;
  if (query.length < 3) {
    draft.value.apoderados[index].sugerencias = [];
    return;
  }

  try {
    draft.value.apoderados[index].sugerencias = await buscarApoderados(query);
  } catch (error) {
    console.error("Error buscando apoderados:", error);
  }
};

// Al seleccionar un padre de la lista
const seleccionarPadreExistente = (padre, index) => {
  const ap = draft.value.apoderados[index];
  ap.nombres = padre.nombres;
  ap.apellidos = padre.apellidos;
  ap.celular = padre.celular;
  ap.es_existente = true;
  ap.sugerencias = []; // Limpiar lista
};

const limpiarSeleccion = (index) => {
  const ap = draft.value.apoderados[index];
  ap.nombres = '';
  ap.apellidos = '';
  ap.celular = '';
  ap.es_existente = false;
};

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
    // silent: este modal ya muestra su propio "Cargando expediente…"; no queremos
    // además meter en skeleton la tabla que quedó detrás.
    const confirmando = await confirmandoStore.fetchById(Number(id), { silent: true });

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
        estado: confirmando.estado ?? 'en_preparacion',
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
    showAlerta(e?.message || 'Error al cargar datos', 'error');
    close();
  } finally {
    loading.value = false;
  }
}

const addApoderado = () => {
  draft.value.apoderados.push({
    tipo_apoderado_id: '',
    nombres: '',
    apellidos: '',
    celular: '',
    sugerencias: [], // Para guardar los resultados de búsqueda de esta tarjeta
    es_existente: false // Para saber si viene de la DB
  });
};

const removeApoderado = (index) => {
  draft.value.apoderados.splice(index, 1);
};

async function submitUpdate() {
  if (saving.value) return;

  const payload = {
    nombres: draft.value.nombres?.trim(),
    apellidos: draft.value.apellidos?.trim(),
    celular: draft.value.celular?.trim() ? draft.value.celular.trim() : null,
    genero: draft.value.genero ? draft.value.genero : null,
    fecha_nacimiento: draft.value.fecha_nacimiento ? draft.value.fecha_nacimiento : null,
    grupo_id: draft.value.grupo_id ? draft.value.grupo_id : null,
    sacramento_faltante_id: draft.value.sacramento_faltante_id ? draft.value.sacramento_faltante_id : null,
    apoderados: draft.value.apoderados && draft.value.apoderados.length > 0 ? draft.value.apoderados : [],
    estado: draft.value.estado,
  };

  if (!payload.nombres) return showAlerta('Faltan Nombres', 'warning');
  if (!payload.apellidos) return showAlerta('Faltan Apellidos', 'warning');

  // Campos obligatorios según la configuración de la parroquia.
  if (obligatorio('celular') && !payload.celular) return showAlerta('El celular es obligatorio.', 'warning');
  if (obligatorio('fecha_nacimiento') && !payload.fecha_nacimiento) return showAlerta('La fecha de nacimiento es obligatoria.', 'warning');
  if (obligatorio('genero') && !payload.genero) return showAlerta('El género es obligatorio.', 'warning');

  // No se admite una fecha de nacimiento futura.
  if (payload.fecha_nacimiento && payload.fecha_nacimiento > maxDate.value) {
    return showAlerta('La fecha de nacimiento no puede ser futura.', 'warning');
  }

  for (const ap of payload.apoderados) {
    if (!ap.nombres || !ap.apellidos || !ap.tipo_apoderado_id) {
      return showAlerta('Completa los datos de todos los apoderados', 'warning');
    }
  }

  saving.value = true;

  // Aviso NO bloqueante si queda fuera del rango de edad para grupos.
  {
    const { min, max } = parroquiaStore.gruposEdad;
    const edad = edadDesde(payload.fecha_nacimiento);
    if (edad != null && ((min != null && edad < min) || (max != null && edad > max))) {
      const rango = [min ?? '…', max ?? '…'].join('–');
      const seguir = await confirmar({
        titulo: `Edad fuera del rango para grupos (${rango} años)`,
        texto: `Tiene ${edad} años; el generador automático de grupos no lo incluirá. ¿Guardar de todos modos?`,
        icono: 'question', confirmarTexto: 'Sí, guardar', cancelarTexto: 'Volver',
      });
      if (!seguir) { saving.value = false; return; }
    }
  }

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
  <div class="modal fade" ref="modalRef" tabindex="-1" role="dialog" aria-modal="true"
    aria-labelledby="confirmandoModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">

        <header class="modal-header">
          <span class="modal-header__icon" aria-hidden="true">
            <component :is="isEditing ? SquarePen : UserPlus" :size="18" />
          </span>
          <div class="modal-header__text">
            <h5 id="confirmandoModalLabel" class="modal-title">{{ title }}</h5>
            <p class="modal-subtitle">Gestión de datos del confirmando y familia.</p>
          </div>
          <button type="button" class="btn-close" @click="close" aria-label="Cerrar"></button>
        </header>

        <div class="modal-body">
          <div v-if="loading && isEditing" role="status" aria-live="polite" aria-label="Cargando expediente">
            <AppSkeleton skeleton="form" />
          </div>

          <form v-else @submit.prevent="submitUpdate" id="confirmandoForm" class="needs-validation"
            aria-labelledby="confirmandoModalLabel">
            <div class="row g-4">

              <div class="col-12">
                <h6 class="text-secondary fw-bold small mb-3 border-bottom pb-2">Datos Personales</h6>
              </div>

              <div class="col-md-6">
                <label class="form-label fw-bold text-secondary small">Apellidos <span
                    class="text-danger">*</span></label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <Contact class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input v-model="draft.apellidos" type="text" class="form-control border-start-0" required
                    aria-label="Apellidos del confirmando" :disabled="saving">
                </div>
              </div>

              <div class="col-md-6">
                <label class="form-label fw-bold text-secondary small">Nombres <span
                    class="text-danger">*</span></label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <User class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input v-model="draft.nombres" type="text" class="form-control border-start-0" required
                    aria-label="Nombres del confirmando" :disabled="saving">
                </div>
              </div>

              <div class="col-md-5">
                <label class="form-label fw-bold text-secondary small">Fecha Nacimiento
                  <span v-if="obligatorio('fecha_nacimiento')" class="text-danger">*</span></label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <CalendarDays class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input v-model="draft.fecha_nacimiento" :max="maxDate" :min="minDate" type="date" class="form-control border-start-0"
                    :required="obligatorio('fecha_nacimiento')" aria-label="Fecha de nacimiento" :disabled="saving">
                </div>
              </div>

              <div class="col-md-3">
                <label class="form-label fw-bold text-secondary small">Celular
                  <span v-if="obligatorio('celular')" class="text-danger">*</span></label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <Smartphone class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input v-model="draft.celular" type="tel" class="form-control border-start-0" maxlength="9"
                    :required="obligatorio('celular')"
                    :class="{ 'is-invalid': errores.celular }" @blur="marcarTocado('celular')"
                    aria-label="Celular del confirmando" :disabled="saving">
                  <div v-if="errores.celular" class="invalid-feedback">{{ errores.celular }}</div>
                </div>
              </div>

              <div class="col-md-4">
                <label class="form-label fw-bold text-secondary small">Género
                  <span v-if="obligatorio('genero')" class="text-danger">*</span></label>
                <div class="input-group">
                  <span class="input-group-text bg-blue-soft text-primary border-end-0">
                    <User class="h-4 w-4" aria-hidden="true" />
                  </span>

                  <select v-model="draft.genero" class="form-select border-start-0" aria-label="Género del confirmando"
                    :required="obligatorio('genero')" :disabled="saving">
                    <option :value="null">-- Sin asignar --</option>
                    <option value="m">Masculino</option>
                    <option value="f">Femenino</option>
                  </select>
                </div>
              </div>

              <div class="col-12 mt-4">
                <h6 class="text-secondary fw-bold small mb-3 border-bottom pb-2">Información Eclesiástica
                </h6>
              </div>

              <div class="col-md-6">
                <label class="form-label fw-bold text-secondary small">Grupo Asignado</label>
                <select v-model="draft.grupo_id" class="form-select" aria-label="Grupo asignado al confirmando"
                  :disabled="saving || authStore.user?.roles?.includes('catequista')">
                  <option :value="null">-- Sin asignar --</option>
                  <option v-for="g in availableGrupos" :key="g.id" :value="g.id">
                    {{ g.nombre }}
                  </option>
                </select>
              </div>

              <div class="col-md-6">
                <label class="form-label fw-bold text-secondary small">Estado del Confirmando</label>
                <div v-if="draft.estado === 'retirado'" class="form-control-plaintext fw-semibold text-danger py-1">
                  Retirado del programa
                  <small class="d-block text-muted fw-normal">Para reingresarlo, usa el botón en la lista de confirmandos.</small>
                </div>
                <select v-else v-model="draft.estado" class="form-select border-start-0" aria-label="Estado del confirmando"
                  :disabled="saving || authStore.user?.roles?.includes('catequista')">
                  <option value="en_preparacion">En Preparación</option>
                  <option value="confirmado">Confirmado (Finalizado)</option>
                </select>
                <small v-if="draft.estado !== 'retirado'" class="text-muted">El retiro se hace desde la lista (pide un motivo).</small>
              </div>

              <div class="col-md-6">
                <label class="form-label fw-bold text-secondary small">
                  Sacramento faltante
                </label>
                <select v-model="draft.sacramento_faltante_id" class="form-select border-primary" required
                  aria-label="Sacramento faltante" :disabled="saving">
                  <option :value="null" disabled>-- Seleccionar --</option>
                  <option v-for="sac in availableSacramentos" :key="sac.id" :value="sac.id">{{ sac.nombre }}</option>
                </select>
              </div>

              <div class="col-12 mt-4">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                  <h6 class="text-secondary fw-bold small mb-0">Apoderados</h6>
                  <AppButton variant="soft" size="sm" :icon="Plus" type="button" @click="addApoderado" :disabled="saving">Agregar</AppButton>
                </div>

                <AppEmpty v-if="draft.apoderados.length === 0" compact :icon="Users"
                  message="Aún no hay apoderados registrados." />

                <div v-else class="d-flex flex-column gap-3">
                  <div v-for="(ap, index) in draft.apoderados" :key="index"
                    class="card border shadow-sm apoderado-card">
                    <div class="card-body p-3 position-relative">
                      <button type="button" class="btn-close position-absolute top-0 end-0 m-2"
                        :aria-label="`Eliminar apoderado ${index + 1}`" @click="removeApoderado(index)"
                        :disabled="saving"></button>

                      <div class="row g-2">
                        <div class="col-12 mb-1">
                          <label class="form-label small fw-bold text-primary mb-1">Parentesco</label>
                          <select v-model="ap.tipo_apoderado_id" class="form-select form-select-sm" required
                            :aria-label="`Parentesco del apoderado ${index + 1}`" :disabled="saving">
                            <option value="" disabled>-- Seleccione --</option>
                            <option v-for="tipo in tiposApoderado" :key="tipo.id" :value="tipo.id">{{ tipo.nombre }}
                            </option>
                          </select>
                        </div>

                        <div class="col-md-6 position-relative">
                          <label class="form-label small text-muted mb-0">Apellidos</label>
                          <input type="text" v-model="ap.apellidos" class="form-control form-control-sm" required
                            :aria-label="`Apellidos del apoderado ${index + 1}`" :disabled="saving"
                            @input="buscarPadresExistentes($event, index)"
                            placeholder="Escriba para buscar..." autocomplete="off">

                          <ul v-if="ap.sugerencias && ap.sugerencias.length > 0"
                            class="list-group position-absolute w-100 shadow-lg z-3 mt-1"
                            aria-label="Sugerencias de apoderados existentes">
                            <li v-for="p in ap.sugerencias" :key="p.id" class="list-group-item p-0">
                              <button type="button" @click="seleccionarPadreExistente(p, index)"
                                class="list-group-item-action w-100 d-flex justify-content-between align-items-center py-2 px-3 border-0 bg-transparent text-start cursor-pointer">
                                <span>
                                  <span class="d-block fw-bold small">{{ p.apellidos }}, {{ p.nombres }}</span>
                                  <span class="d-block text-muted extra-small">Cel: {{ p.celular || '---' }}</span>
                                </span>
                                <span class="badge rounded-pill bg-info-subtle text-info border small">Existente</span>
                              </button>
                            </li>
                          </ul>
                        </div>

                        <div class="col-md-6">
                          <label class="form-label small text-muted mb-0">Nombres</label>
                          <input type="text" v-model="ap.nombres" class="form-control form-control-sm" required
                            :aria-label="`Nombres del apoderado ${index + 1}`" :disabled="saving">
                        </div>

                        <div class="col-md-6">
                          <label class="form-label small text-muted mb-0">Celular</label>
                          <div class="input-group input-group-sm">
                            <input type="tel" v-model="ap.celular" class="form-control" maxlength="9"
                              :aria-label="`Celular del apoderado ${index + 1}`" :disabled="saving">
                            <AppButton
                              v-if="ap.es_existente"
                              variant="soft-danger"
                              icon-only
                              :icon="CircleX"
                              type="button"
                              :aria-label="`Quitar selección de apoderado existente ${index + 1}`"
                              @click="limpiarSeleccion(index)"></AppButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </form>
        </div>

        <footer class="modal-footer">
          <AppButton variant="secondary" type="button" @click="close" :disabled="saving">Cancelar</AppButton>
          <AppButton type="submit" form="confirmandoForm" :icon="Check" :loading="saving">Guardar</AppButton>
        </footer>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================================
   ESTÉTICA "BLUE HEADER" (MODAL STANDARD)
========================================= */
.z-3 {
  z-index: 1050;
}

.cursor-pointer {
  cursor: pointer;
}

.extra-small {
  font-size: var(--fs-xs);
}

.border-dashed {
  border-style: dashed !important;
}

/* Estilo para que la lista no se corte si la tarjeta es pequeña */
.apoderado-card {
  overflow: visible !important;
}

.list-group {
  max-height: 200px;
  overflow-y: auto;
}

.form-control,
.form-select {
  background-color: var(--surface);
  border: 1px solid var(--line-strong);
  padding: 0.6rem 1rem;
  font-size: var(--fs-base);
  color: var(--text);
}

/* Inputs con grupo */
.form-control.border-start-0 {
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

.form-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent);
}

/* 4. EXTRAS ESPECÍFICOS (Apoderados) */
.bg-primary-subtle {
  background-color: var(--accent-soft) !important;
  color: #1e40af;
  border-color: var(--accent-ring);
}

.border-dashed {
  border-style: dashed !important;
}

.apoderado-card {
  transition: transform 0.2s;
}

.apoderado-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md) !important;
}

/* ===== MODO OSCURO =====
   Este modal redefine localmente form-control/btn-soft-primary/bg-*-subtle
   con colores propios (gana por scoping a los de main.css). */
:root[data-bs-theme="dark"] .form-control,
:root[data-bs-theme="dark"] .form-select {
  background-color: var(--surface-sunken);
  border-color: var(--line-strong);
  color: var(--text);
}
:root[data-bs-theme="dark"] .bg-blue-soft {
  background-color: #1e2547 !important;
  border-color: var(--line-strong);
  color: #93c5fd !important;
}
:root[data-bs-theme="dark"] .bg-primary-subtle {
  background-color: #1e2547 !important;
  color: color-mix(in srgb, var(--accent) 55%, #fff);
  border-color: #3730a3;
}
</style>