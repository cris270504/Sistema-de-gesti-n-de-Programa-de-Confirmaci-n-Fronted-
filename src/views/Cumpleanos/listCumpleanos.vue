<script setup>
import { storeToRefs } from 'pinia';
import { Modal } from 'bootstrap';
import { ref, computed, onMounted, nextTick } from 'vue';

// --- FullCalendar Imports ---
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';

// --- Stores ---
import { useConfirmandosStore } from '../../stores/confirmandos';
import { useUsersStore } from '../../stores/users'; // <--- 1. Importar Store Usuarios

const confirmandosStore = useConfirmandosStore();
const usersStore = useUsersStore();

const { items: confirmandos, loading: loadingConf } = storeToRefs(confirmandosStore);
const { items: users, loading: loadingUsers } = storeToRefs(usersStore);

// Combinar loadings
const loading = computed(() => loadingConf.value || loadingUsers.value);

// --- Estado de Modales ---
const detailsModalInstance = ref(null);
const selectedEvent = ref({ 
    id: null, 
    title: '', 
    start: '', 
    description: '', 
    type: '',
    age: 0,
    originalDate: ''
});

// --- LÓGICA DE EVENTOS (CUMPLEAÑOS) ---
// --- LÓGICA DE EVENTOS (CUMPLEAÑOS) ---
const calendarEvents = computed(() => {
    const events = [];
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    const processPerson = (person, type, color) => {
        if (!person.fecha_nacimiento) return;

        // 1. DETERMINAR EL NOMBRE CORRECTO SEGÚN EL TIPO
        // Si tiene 'nombres' (Confirmando), úsalo. Si no, usa 'name' (User/Catequista).
        const fullName = person.nombres 
            ? `${person.nombres} ${person.apellidos}` 
            : person.name;

        const parts = person.fecha_nacimiento.split('-'); 
        if(parts.length !== 3) return;
        
        const birthMonth = parts[1];
        const birthDay = parts[2];
        const birthYear = parseInt(parts[0]);

        years.forEach(year => {
            events.push({
                id: `${type}-${person.id}-${year}`,
                title: `🎂 ${fullName}`, // <--- AQUI USAMOS LA VARIABLE CALCULADA
                start: `${year}-${birthMonth}-${birthDay}`,
                allDay: true,
                backgroundColor: color,
                borderColor: color,
                extendedProps: {
                    type: type,
                    originalDate: person.fecha_nacimiento,
                    age: year - birthYear,
                    description: `${type} - Cumple ${year - birthYear} años`
                }
            });
        });
    };

    // ... el resto sigue igual (forEach confirmandos, forEach catequistas) ...
    confirmandos.value.forEach(c => processPerson(c, 'Confirmando', '#3b82f6'));

    const catequistas = users.value.filter(u => 
        u.roles?.some(r => r.name === 'catequista' || r.name === 'coordinador')
    );
    catequistas.forEach(u => processPerson(u, 'Catequista', '#f59e0b'));

    return events;
});

const calendarOptions = computed(() => ({
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    timeZone: 'local',
    locale: esLocale,
    aspectRatio: 2.3,
    eventDisplay: 'block',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
    buttonText: { today: 'Hoy', month: 'Mes', list: 'Lista' },
    displayEventTime: false, // Es cumpleaños, no necesita hora
    events: calendarEvents.value, // <--- Vinculamos los eventos calculados
    
    // Al hacer clic en un evento
    eventClick: (info) => {
        const props = info.event.extendedProps;
        selectedEvent.value = {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            type: props.type,
            description: props.description,
            age: props.age,
            originalDate: props.originalDate
        };
        detailsModalInstance.value?.show();
    }
}));

// Función para mostrar texto bonito en el modal
const formatDisplayDate = (dateObj) => {
    if (!dateObj) return '';
    // Formateamos la fecha del evento (ej: 2026)
    return new Date(dateObj).toLocaleString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
};

// Formato para fecha de nacimiento original
const formatBirthDate = (isoString) => {
    if (!isoString) return '';
    // Crear fecha sin ajuste horario (truco para fechas string YYYY-MM-DD)
    const [y, m, d] = isoString.split('-');
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
};

onMounted(async () => {
    // Cargamos ambas fuentes de datos
    await Promise.all([
        confirmandosStore.fetchAll(),
        usersStore.fetchAll()
    ]);

    nextTick(() => {
        const detailsEl = document.getElementById('detailsModal');
        if (detailsEl) detailsModalInstance.value = new Modal(detailsEl);
    });
});

</script>

<template>
    <div class="container-fluid p-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="h3 text-gray-800 mb-1">Calendario de Cumpleaños</h2>
                <p class="text-muted mb-0 small">Confirmandos y Catequistas</p>
            </div>
            
            <div class="d-flex gap-3">
                <div class="d-flex align-items-center">
                    <span class="d-inline-block rounded-circle me-2" style="width: 12px; height: 12px; background-color: #3b82f6;"></span>
                    <small class="text-muted">Confirmandos</small>
                </div>
                <div class="d-flex align-items-center">
                    <span class="d-inline-block rounded-circle me-2" style="width: 12px; height: 12px; background-color: #f59e0b;"></span>
                    <small class="text-muted">Catequistas</small>
                </div>
            </div>
        </div>

        <div class="card shadow mb-4">
            <div class="card-body p-3">
                <div v-if="loading" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-2 text-muted">Cargando fechas...</p>
                </div>
                <FullCalendar v-else :options="calendarOptions" />
            </div>
        </div>

        <div class="modal fade" id="detailsModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-sm"> <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header bg-primary text-white position-relative overflow-hidden">
                        <div class="position-absolute top-0 start-0 w-100 h-100 opacity-25" 
                             style="background: radial-gradient(circle at top right, white, transparent);"></div>
                        
                        <h5 class="modal-title fw-bold position-relative z-1">
                            <i class="bi bi-cake2-fill me-2"></i>¡Cumpleaños!
                        </h5>
                        <button type="button" class="btn-close btn-close-white position-relative z-1" data-bs-dismiss="modal"></button>
                    </div>
                    
                    <div class="modal-body text-center py-4">
                        <h4 class="fw-bold text-dark mb-1">{{ selectedEvent.title.replace('🎂 ', '') }}</h4>
                        
                        <span class="badge rounded-pill px-3 py-2 mb-3"
                            :class="selectedEvent.type === 'Confirmando' ? 'bg-primary-subtle text-primary' : 'bg-warning-subtle text-warning text-dark'">
                            {{ selectedEvent.type }}
                        </span>

                        <div class="mt-3">
                            <div class="display-1 text-primary fw-bold lh-1 mb-2">
                                {{ selectedEvent.age }}
                            </div>
                            <p class="text-muted text-uppercase small fw-bold tracking-wider">Años a cumplir</p>
                        </div>
                    </div>
                    <div class="modal-footer justify-content-center bg-light border-0">
                        <button type="button" class="btn btn-outline-secondary btn-sm px-4 rounded-pill" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>

    </div>
</template>

<style scoped>
/* Estilos FullCalendar */
:deep(.fc table), :deep(.fc tbody), :deep(.fc thead), :deep(.fc tr), :deep(.fc td), :deep(.fc th) {
    background-color: transparent !important;
    border-color: var(--fc-border-color) !important;
}

:deep(.fc) {
    font-family: 'Segoe UI', Roboto, sans-serif;
    --fc-border-color: #e5e7eb;
    --fc-today-bg-color: rgba(59, 130, 246, 0.05);
    --fc-event-border-color: transparent;
}

/* Día Hover */
:deep(.fc-daygrid-day:hover) {
    background-color: #f8fafc !important;
    cursor: pointer;
}

/* Eventos Estilo Píldora */
:deep(.fc-event) {
    border-radius: 50px;
    padding: 2px 8px;
    font-size: 0.8rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    border: none !important;
    margin-bottom: 2px !important;
}

:deep(.fc-daygrid-event-dot) { display: none; } /* Ocultar punto en month view */

/* Header */
:deep(.fc-toolbar-title) {
    font-size: 1.25rem !important;
    text-transform: capitalize;
}

:deep(.fc-button-primary) {
    background-color: white;
    color: #4b5563;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
:deep(.fc-button-primary:hover) {
    background-color: #f9fafb;
    color: #111827;
}
:deep(.fc-button-primary.fc-button-active) {
    background-color: #3b82f6;
    color: white;
    border-color: #3b82f6;
}

/* Día actual más bonito */
:deep(.fc-day-today .fc-daygrid-day-number) {
    background-color: #3b82f6;
    color: white;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 4px;
}
</style>