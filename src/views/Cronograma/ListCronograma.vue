<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { storeToRefs } from 'pinia';
import { Modal } from 'bootstrap';
import { showAlerta } from '@/funciones';
import { Pencil, Trash, CalendarDays, ClipboardCheck } from 'lucide-vue-next';
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn';

// --- FullCalendar Imports ---
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { useReunionesStore } from '../../stores/reunions';
import { useParroquiaStore } from '@/stores/parroquia';
import { useRoute, useRouter } from 'vue-router';
import AppPage from '@/components/AppPage.vue';
import { useMediaQuery } from '@/composables/useMediaQuery';

const esMovil = useMediaQuery('(max-width: 767px)');
const calendarRef = ref(null);

// --- Stores ---
const reunionesStore = useReunionesStore();
const authStore = useAuthStore();
const { items: reuniones, loading } = storeToRefs(reunionesStore);
const { fetchAll, add, save, remove } = reunionesStore;
const route = useRoute();
const router = useRouter();

// --- Estado de Modales ---
const detailsModalInstance = ref(null);
const formModalInstance = ref(null);

// Estado para VER detalles
const selectedEvent = ref({ id: null, title: '', start: '', description: '', type: '' });

// Estado para el FORMULARIO (Draft)
const draft = ref({ id: null, nombre_tema: '', fecha: '', descripcion: '', tipo: '' });
const isEditing = ref(false);
const saving = ref(false);

// Tipos de reunión activos para esta parroquia (configurable).
const parroquiaStore = useParroquiaStore();
const tiposReunion = computed(() => parroquiaStore.tiposReunion);

// Color por tipo de reunión (mismo criterio en el calendario y en la leyenda).
const COLORES_TIPO = { Confirmandos: '#198754', Catequistas: '#dc3545', Apoderados: '#fd7e14' };
const colorTipo = (tipo) => COLORES_TIPO[tipo] || '#3788d8';

const draftDate = ref('');
const draftTime = ref('');

// --- Configuración FullCalendar ---
const formattedEvents = computed(() => {
  if (!reuniones || !reuniones.value) return [];
  return reuniones.value.map(r => {
    const color = colorTipo(r.tipo);

    return {
      id: r.id,
      title: r.nombre_tema,
      start: r.fecha, // 'YYYY-MM-DD'
      backgroundColor: color,
      borderColor: color,
      extendedProps: { descripcion: r.descripcion, tipo: r.tipo }
    };
  });
});

const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
  // En celular el calendario mensual es ilegible: arranca en vista de lista.
  initialView: esMovil.value ? 'listMonth' : 'dayGridMonth',
  timeZone: 'local',
  locale: esLocale,
  aspectRatio: esMovil.value ? 1 : 2.3,
  height: esMovil.value ? 'auto' : undefined,
  eventDisplay: 'block',
  headerToolbar: esMovil.value
    ? { left: 'prev,next', center: 'title', right: 'today' }
    : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
  buttonText: { today: 'Hoy', month: 'Mes', list: 'Lista' },
  events: formattedEvents.value,
  displayEventTime: false,

  // INTERACCIÓN
  eventClick: handleEventClick,
  dateClick: handleDateClick,
}));

// Al cruzar el breakpoint, cambiar la vista del calendario ya montado.
watch(esMovil, (movil) => {
  const api = calendarRef.value?.getApi?.();
  if (api) api.changeView(movil ? 'listMonth' : 'dayGridMonth');
});

const extractDateTime = (isoString) => {
  if (!isoString) return { date: '', time: '09:00' };

  const dateObj = new Date(isoString);

  // Ajuste local manual para asegurar formato inputs
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`
  };
};

// Función para mostrar texto bonito en el modal de detalles
const formatDisplayDate = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// --- MÉTODOS DE INTERACCIÓN ---
const handleDateClick = (info) => {
  // Validación de permisos
  if (!authStore.can('crear cronograma')) return;

  // Validación de fecha pasada (Usando strings, seguro)
  const todayStr = new Date().toLocaleDateString('en-CA'); // Retorna formato YYYY-MM-DD local
  // Nota: info.dateStr viene como YYYY-MM-DD o ISO completo
  const clickedDatePart = info.dateStr.split('T')[0];

  if (clickedDatePart < todayStr) {
    showAlerta('No puedes agendar actividades en fechas pasadas.', 'warning');
    return;
  }

  isEditing.value = false;

  if (info.dateStr.indexOf('T') > -1) {
    // Si es vista de semana/día (ej: "2025-11-27T13:00:00-05:00")
    const parts = info.dateStr.split('T');
    draftDate.value = parts[0]; // "2025-11-27"
    // Tomamos la hora del string directamente
    draftTime.value = parts[1].substring(0, 5);
  } else {
    // Si es vista de mes (ej: "2025-11-27")
    // Al asignarlo directo, evitamos cualquier conversión de zona horaria
    draftDate.value = info.dateStr;
    draftTime.value = '09:00';
  }
  // -----------------------

  // Limpiar el resto del formulario. El tipo arranca en el primer tipo activo
  // de la parroquia (antes 'Catequesis', que ni siquiera es un tipo válido).
  draft.value = {
    id: null,
    nombre_tema: '',
    descripcion: '',
    tipo: tiposReunion.value[0] || 'Confirmandos'
  };

  formModalInstance.value?.show();
};

// 2. Clic en un evento (VER DETALLES)
const handleEventClick = (info) => {
  selectedEvent.value = {
    id: Number(info.event.id),
    title: info.event.title,
    start: info.event.startStr, // Fecha formateada YYYY-MM-DD
    description: info.event.extendedProps.descripcion,
    type: info.event.extendedProps.tipo
  };
  detailsModalInstance.value?.show();
};

// 3. Clic en "Editar" desde el modal de detalles (EDITAR)
const openEditFromDetails = () => {
  if (!authStore.can('editar cronograma')) return;
  detailsModalInstance.value?.hide();

  isEditing.value = true;

  // --- CORRECCIÓN: Usar el extractor seguro ---
  // selectedEvent.value.start tiene el formato ISO "feo"
  const { date, time } = extractDateTime(selectedEvent.value.start);

  draftDate.value = date;
  draftTime.value = time;
  // -------------------------------------------

  draft.value = {
    id: selectedEvent.value.id,
    nombre_tema: selectedEvent.value.title,
    descripcion: selectedEvent.value.description,
    tipo: selectedEvent.value.type
  };

  formModalInstance.value?.show();
};

// 4. Guardar (Crear o Actualizar)
const handleSubmit = async () => {
  if (saving.value) return;

  const fechaFinal = `${draftDate.value} ${draftTime.value}`;

  if (!draft.value.nombre_tema || !draftDate.value || !draftTime.value) {
    showAlerta('Nombre, Fecha y Hora son obligatorios', 'warning');
    return;
  }

  // Asignamos la fecha combinada al draft
  draft.value.fecha = fechaFinal;

  // Con un solo tipo activo el campo es de solo lectura: forzamos el valor.
  if (tiposReunion.value.length === 1) draft.value.tipo = tiposReunion.value[0];

  saving.value = true;
  try {
    if (isEditing.value) {
      await save(draft.value.id, draft.value);
    } else {
      await add(draft.value);
    }
    await fetchAll({ force: true });
    formModalInstance.value?.hide();
  } catch (e) {
    console.error(e);
  } finally {
    saving.value = false;
  }
};

// 5. Eliminar
const handleDelete = async () => {
  await remove(selectedEvent.value.id);
  detailsModalInstance.value?.hide();
  await fetchAll({ force: true });
};

const canRegisterAttendance = computed(() => {
  if (authStore.isCoordinador) return true;

  const tipo = selectedEvent.value.type;

  if (tipo === 'Confirmandos') {
    return authStore.hasRole('catequista');
  }
  return false;
});

const handleAttendance = () => {
  detailsModalInstance.value?.hide();

  const tipo = selectedEvent.value.type;
  const fechaEvento = selectedEvent.value.start;

  const d = new Date(fechaEvento);
  const mesStr = d.toLocaleDateString('en-CA').slice(0, 7);

  let routeName = 'asistencias-confirmandos';
  if (tipo === 'Catequistas') routeName = 'asistencias-catequistas';
  if (tipo === 'Apoderados') routeName = 'asistencias-apoderados';

  const queryParams = {
    fecha: mesStr
  };

  if (authStore.user?.grupo_ids?.length) {
    queryParams.grupo = authStore.user.grupo_ids[0];
  }

  router.push({
    name: routeName,
    query: queryParams
  });
};

let detachDetailsFocusReturn = () => {};
let detachFormFocusReturn = () => {};

onMounted(async () => {
  if (authStore.can('ver cronograma')) {
    await fetchAll();
  }
  nextTick(() => {
    // Inicializar ambos modales
    const detailsEl = document.getElementById('detailsModal');
    if (detailsEl) {
      detailsModalInstance.value = new Modal(detailsEl);
      detachDetailsFocusReturn = attachModalFocusReturn(detailsEl);
    }

    const formEl = document.getElementById('formModal');
    if (formEl) {
      formModalInstance.value = new Modal(formEl);
      detachFormFocusReturn = attachModalFocusReturn(formEl);
    }
  });
});

onUnmounted(() => {
  detachDetailsFocusReturn();
  detachFormFocusReturn();
  detailsModalInstance.value?.dispose();
  formModalInstance.value?.dispose();
});
</script>

<template>
  <AppPage title="Cronograma" subtitle="Calendario de reuniones y actividades" :loading="loading">
    <div class="d-flex flex-wrap gap-3 mb-3 align-items-center bg-white p-3 rounded shadow-sm border">
      <span class="text-muted small fw-bold text-uppercase me-2">Referencias:</span>
      <div v-for="t in tiposReunion" :key="t" class="d-flex align-items-center">
        <span class="d-inline-block rounded-circle me-2" style="width: 12px; height: 12px;"
          :style="{ backgroundColor: colorTipo(t) }"></span>
        <span class="small text-dark">{{ t }}</span>
      </div>
    </div>

    <div class="surface surface--pad mb-4">
      <FullCalendar ref="calendarRef" :options="calendarOptions" />
    </div>

    <div class="modal fade" id="detailsModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title fw-bold">{{ selectedEvent.title }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <span class="badge bg-secondary mb-2">{{ selectedEvent.type }}</span>
              <h6 class="text-muted text-capitalize">
                <CalendarDays class="h-4 w-4 me-2 d-inline-block align-text-bottom" aria-hidden="true" />
                {{ formatDisplayDate(selectedEvent.start) }}
              </h6>
            </div>
            <div class="p-3 bg-light rounded border">
              <p class="mb-0 text-secondary">{{ selectedEvent.description || 'Sin descripción.' }}</p>
            </div>
          </div>
          <div class="modal-footer border-0 justify-content-between">
            <div class="d-flex gap-2">
              <button v-if="authStore.can('eliminar cronograma')" class="btn btn-sm btn-danger" @click="handleDelete">
                <Trash />
              </button>
              <button v-if="authStore.can('editar cronograma')" class="btn btn-sm btn-warning me-2"
                @click="openEditFromDetails">
                <Pencil />
              </button>
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
              <button v-if="canRegisterAttendance" class="btn btn-success" @click="handleAttendance">
                <ClipboardCheck class="h-4 w-4 me-1" aria-hidden="true" />
                Asistencia
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="formModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered">
        
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ isEditing ? 'Editar Actividad' : 'Agendar Nueva Actividad' }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="handleSubmit">
              <div class="mb-3">
                <label class="form-label">Nombre / Tema <span class="text-danger">*</span></label>
                <input v-model="draft.nombre_tema" type="text" class="form-control" required :disabled="saving">
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Fecha <span class="text-danger">*</span></label>
                  <input v-model="draftDate" type="date" class="form-control" required :disabled="saving">
                </div>

                <div class="col-md-6 mb-3">
                  <label class="form-label">Hora <span class="text-danger">*</span></label>
                  <input v-model="draftTime" type="time" class="form-control" required :disabled="saving">
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label d-block">Tipo</label>

                <!-- 1 tipo: solo lectura -->
                <div v-if="tiposReunion.length <= 1" class="fw-semibold text-dark py-1">
                  {{ tiposReunion[0] || '—' }}
                </div>

                <!-- 2-3 tipos: botones -->
                <div v-else-if="tiposReunion.length <= 3" class="btn-group w-100" role="group"
                  aria-label="Tipo de reunión">
                  <template v-for="t in tiposReunion" :key="t">
                    <input type="radio" class="btn-check" :id="`tipo-${t}`" name="tipoReunion" :value="t"
                      v-model="draft.tipo" :disabled="saving">
                    <label class="btn btn-outline-primary" :for="`tipo-${t}`">{{ t }}</label>
                  </template>
                </div>

                <!-- 4+ tipos: selector -->
                <select v-else v-model="draft.tipo" class="form-select" :disabled="saving">
                  <option v-for="t in tiposReunion" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Descripción</label>
                <textarea v-model="draft.descripcion" class="form-control" rows="3" :disabled="saving"></textarea>
              </div>

              <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"
                  :disabled="saving">Cancelar</button>
                <button type="submit" class="btn btn-success" :disabled="saving">
                  <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                  {{ saving ? 'Guardando...' : 'Guardar' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </AppPage>
</template>

<style scoped>
:deep(.fc table),
:deep(.fc tbody),
:deep(.fc thead),
:deep(.fc tr),
:deep(.fc td),
:deep(.fc th) {
  background-color: transparent !important;
  /* Forzamos transparencia para que mande el contenedor */
  border-color: var(--fc-border-color) !important;
}

/* Evita que Bootstrap ponga gris las filas al pasar el mouse */
:deep(.fc tr:hover) {
  background-color: transparent !important;
}

/* --- 1. CONTENEDORES PRINCIPALES (EL FONDO BLANCO) --- */
/* Forzamos blanco en todas las capas contenedoras para tapar el gris */
:deep(.fc),
:deep(.fc-view-harness),
:deep(.fc-scroller),
:deep(.fc-daygrid-body),
:deep(.fc-scrollgrid),
:deep(.fc-scrollgrid-section) {
  background-color: #ffffff !important;
}

/* Anulamos cualquier hover en los contenedores grandes */
:deep(.fc-view-harness:hover),
:deep(.fc-scroller:hover),
:deep(.fc-daygrid-body:hover),
:deep(.fc-scrollgrid:hover) {
  background-color: #ffffff !important;
}

/* --- 2. VARIABLES Y FUENTES --- */
:deep(.fc) {
  font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --fc-border-color: #dee2e6;
  --fc-page-bg-color: #ffffff;
  --fc-neutral-bg-color: #f8f9fa;
  --fc-list-event-hover-bg-color: #e9ecef;
  --fc-today-bg-color: rgba(13, 110, 253, 0.05);
  /* Variable nativa para 'hoy' */
}

/* --- 3. EL ÚNICO HOVER QUE QUEREMOS (DÍA INDIVIDUAL) --- */
/* Esta es la única celda que debe cambiar de color */
:deep(.fc-daygrid-day) {
  transition: background-color 0.2s ease !important;
}

:deep(.fc-daygrid-day:hover) {
  background-color: #f1f5f9 !important;
  /* Gris suave */
  cursor: pointer;
}

:deep(.fc-daygrid-event-dot) {
  display: none;
}

/* --- 4. CABECERA Y BOTONES --- */
:deep(.fc-toolbar-title) {
  font-size: 1.5rem !important;
  font-weight: 700;
  color: #343a40;
}

:deep(.fc-col-header-cell) {
  background-color: var(--fc-neutral-bg-color) !important;
  padding: 0.75rem 0;
  color: #495057;
  text-transform: uppercase;
  font-size: 0.85rem;
}

:deep(.fc-button-primary) {
  background-color: #0d6efd;
  border-color: #0d6efd;
  text-transform: capitalize;
  /* Capitaliza "mes", "semana" */
}

:deep(.fc-button-primary:hover) {
  background-color: #0b5ed7;
  border-color: #0a58ca;
}

:deep(.fc-button-primary:disabled) {
  background-color: #0d6efd;
  border-color: #0d6efd;
  opacity: 0.65;
}

/* --- 5. EVENTOS --- */
:deep(.fc-event) {
  border: none !important;
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 0.85rem;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  /* Sombra un poco más fuerte */
  transition: transform 0.1s ease, box-shadow 0.1s ease;
  margin-bottom: 2px !important;
  color: #ffffff !important;
  /* Texto blanco SIEMPRE */
}

:deep(.fc-event:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  filter: brightness(110%);
  /* Aclara un poco el color al pasar el mouse */
}

:deep(.fc-event-title),
:deep(.fc-event-time) {
  color: #ffffff !important;
  font-weight: 600 !important;
}

/* --- 6. LISTA (AGENDA) --- */
:deep(.fc-list-day-cushion) {
  background-color: var(--fc-neutral-bg-color) !important;
}

:deep(.fc-list-event:hover td) {
  background-color: var(--fc-list-event-hover-bg-color) !important;
}

:deep(.fc-list-day-text),
:deep(.fc-list-day-side-text),
:deep(.fc-daygrid-day-number) {
  color: #212529;
  text-decoration: none;
  padding: 0.5rem;
}

/* El título del evento en la vista lista: legible (la regla .fc-event-title de
   arriba lo dejaba blanco sobre fondo blanco). */
:deep(.fc-list-event-title),
:deep(.fc-list-event-title a) {
  color: #1e293b !important;
  font-weight: 600 !important;
  text-decoration: none;
}
:deep(.fc-list-event-time) { color: #64748b !important; }

/* --- 7. MÓVIL --- */
@media (max-width: 767px) {
  :deep(.fc-toolbar) {
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
  }
  :deep(.fc-toolbar-title) {
    font-size: 1.05rem !important;
    text-align: center;
  }
  :deep(.fc-toolbar-chunk) {
    display: flex;
    justify-content: center;
  }
  :deep(.fc-button) {
    padding: 0.3rem 0.7rem !important;
    font-size: 0.85rem !important;
  }
  :deep(.fc-list-event-title) { white-space: normal; }
}

:deep(.fc-day-today) {
  /* Fondo azul claro más visible (puedes cambiar el color hex si prefieres otro tono) */
  background-color: #e7f1ff !important;
}

/* Al pasar el mouse sobre hoy, lo oscurecemos un poco más */
:deep(.fc-day-today:hover) {
  background-color: #d1e7dd !important;
  /* Un tono verdoso suave o azul más oscuro */
  transition: background-color 0.2s ease;
}

/* Opcional: Hacer que el NÚMERO del día hoy sea más grueso y de color primario */
:deep(.fc-day-today .fc-daygrid-day-number) {
  font-weight: 800;
  color: #0d6efd;
  font-size: 1.1em;
  background-color: #d1e7dd !important;
}
</style>