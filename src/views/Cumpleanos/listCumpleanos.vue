<script setup>
import { storeToRefs } from 'pinia';
import { Modal } from 'bootstrap';
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';

// --- FullCalendar Imports ---
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';

// --- Stores ---
import { useConfirmandosStore } from '../../stores/confirmandos';
import { useUsersStore } from '../../stores/users';
import { useAuthStore } from '@/stores/auth';
import { useGruposStore } from '../../stores/grupos'; // <--- Importamos store de grupos para mapeo

const router = useRouter();
const confirmandosStore = useConfirmandosStore();
const usersStore = useUsersStore();
const authStore = useAuthStore();
const gruposStore = useGruposStore();

const { items: confirmandos, loading: loadingConf } = storeToRefs(confirmandosStore);
const { items: users, loading: loadingUsers } = storeToRefs(usersStore);

const loading = computed(() => loadingConf.value || loadingUsers.value);

// --- LÓGICA DE ROLES ---
const esCoordinadorOAdmin = computed(() => {
    const roles = authStore.user?.roles || [];
    return roles.some(role => {
        const name = typeof role === 'string' ? role : role.name;
        return ['admin', 'coordinador', 'super-admin'].includes(name.trim().toLowerCase());
    });
});

const miGrupoId = computed(() => authStore.user?.grupo_id);

// --- Estado de Modales ---
const detailsModalInstance = ref(null);
const selectedEvent = ref({
    id: null,
    title: '',
    start: '',
    description: '',
    type: '',
    age: 0,
    originalDate: '',
    grupo: null
});

// --- LÓGICA DE EVENTOS (CUMPLEAÑOS) ---
const calendarEvents = computed(() => {
    const events = [];
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    const processPerson = (person, type, color, grupoRelacion = null) => {
        if (!person.fecha_nacimiento) return;

        // Determinar nombre completo
        const fullName = person.nombres
            ? `${person.nombres} ${person.apellidos}`
            : person.name;

        const parts = person.fecha_nacimiento.split('-');
        if (parts.length !== 3) return;

        const birthMonth = parts[1];
        const birthDay = parts[2];
        const birthYear = parseInt(parts[0]);

        years.forEach(year => {
            events.push({
                id: `${type}-${person.id}-${year}`,
                title: `🎂 ${fullName}`,
                start: `${year}-${birthMonth}-${birthDay}`,
                allDay: true,
                backgroundColor: color,
                borderColor: color,
                extendedProps: {
                    type: type,
                    originalDate: person.fecha_nacimiento,
                    age: year - birthYear,
                    description: `${type} - Cumple ${year - birthYear} años`,
                    grupo: grupoRelacion || person.grupo || null
                }
            });
        });
    };

    // --- FILTRADO SEGÚN ROL ---
    if (esCoordinadorOAdmin.value) {
        // 1. El Coordinador/Admin ve TODOS los confirmandos
        confirmandos.value.forEach(c => processPerson(c, 'Confirmando', '#3b82f6'));

        // 2. Ve TODOS los usuarios con rol de catequista o coordinador
        const catequistas = users.value.filter(u => {
            const roles = u.roles || [];
            return roles.some(role => {
                const name = typeof role === 'string' ? role : role.name;
                return ['catequista', 'coordinador'].includes(name.trim().toLowerCase());
            });
        });
        catequistas.forEach(u => processPerson(u, 'Catequista', '#f59e0b'));
    } else {
        // --- VISTA CATEQUISTA (SÓLO SU GRUPO E INTEGRANTES) ---

        // 1. Mis Confirmandos directos de mi grupo
        const misConfirmandos = confirmandos.value.filter(c =>
            authStore.user?.grupo_ids?.includes(Number(c.grupo_id))
        );
        misConfirmandos.forEach(c => processPerson(c, 'Confirmando', '#3b82f6'));

        // 2. Mis Colegas Catequistas (Incluido yo mismo)
        // Buscamos en la lista de todos los usuarios a aquellos que compartan grupo_id con mi sesión
        const misColegas = users.value.filter(u => {
            // Si el usuario tiene un array de grupos, verificamos si hay intersección
            const usuarioComparteGrupo = u.grupo_ids?.some(id => authStore.user?.grupo_ids?.includes(id));

            const roles = u.roles || [];
            const tieneRolPermitido = roles.some(role => {
                const name = typeof role === 'string' ? role : role.name;
                return ['catequista', 'coordinador'].includes(name.trim().toLowerCase());
            });

            return usuarioComparteGrupo && tieneRolPermitido;
        });
        misColegas.forEach(u => processPerson(u, 'Catequista', '#f59e0b'));
    }

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
    displayEventTime: false,
    events: calendarEvents.value,

    eventClick: (info) => {
        const props = info.event.extendedProps;
        selectedEvent.value = {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            type: props.type,
            description: props.description,
            age: props.age,
            originalDate: props.originalDate,
            grupo: props.grupo
        };
        detailsModalInstance.value?.show();
    }
}));

const irAlGrupo = (grupoId) => {
    if (grupoId) {
        detailsModalInstance.value?.hide();
        router.push({ name: 'miGrupo', params: { id: grupoId } });
    }
};

const formatBirthDate = (isoString) => {
    if (!isoString) return '';
    const [y, m, d] = isoString.split('-');
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
};

onMounted(async () => {
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
                <p class="text-muted mb-0 small">
                    {{ esCoordinadorOAdmin ? 'Seguimiento general de la comunidad' : 'Cumpleaños en mi Grupo Pastoral'
                    }}
                </p>
            </div>

            <div class="d-flex gap-3">
                <div class="d-flex align-items-center">
                    <span class="d-inline-block rounded-circle me-2"
                        style="width: 12px; height: 12px; background-color: #3b82f6;"></span>
                    <small class="text-muted">Confirmandos</small>
                </div>
                <div class="d-flex align-items-center">
                    <span class="d-inline-block rounded-circle me-2"
                        style="width: 12px; height: 12px; background-color: #f59e0b;"></span>
                    <small class="text-muted">Catequistas</small>
                </div>
            </div>
        </div>

        <div class="card shadow border-0 rounded-4 mb-4">
            <div class="card-body p-3">
                <div v-if="loading" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-2 text-muted">Cargando fechas...</p>
                </div>
                <FullCalendar v-else :options="calendarOptions" />
            </div>
        </div>

        <div class="modal fade" id="detailsModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-sm">
                <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                    <div class="modal-header bg-primary text-white position-relative overflow-hidden border-0 py-3">
                        <div class="position-absolute top-0 start-0 w-100 h-100 opacity-25"
                            style="background: radial-gradient(circle at top right, white, transparent);"></div>

                        <h5 class="modal-title fw-bold position-relative z-1 d-flex align-items-center gap-2"
                            style="font-size: 1.1rem;">
                            <i class="bi bi-cake2-fill"></i>¡Cumpleaños!
                        </h5>
                        <button type="button" class="btn-close btn-close-white position-relative z-1 shadow-none"
                            data-bs-dismiss="modal"></button>
                    </div>

                    <div class="modal-body text-center py-4">
                        <h4 class="fw-bold text-dark mb-1 fs-5">{{ selectedEvent.title.replace('🎂 ', '') }}</h4>

                        <div class="d-flex justify-content-center gap-2 mb-3">
                            <span class="badge rounded-pill px-3 py-1.5 text-uppercase small"
                                :class="selectedEvent.type === 'Confirmando' ? 'bg-primary-subtle text-primary' : 'bg-warning-subtle text-warning-emphasis'">
                                {{ selectedEvent.type }}
                            </span>
                        </div>

                        <div v-if="esCoordinadorOAdmin && selectedEvent.grupo" class="mb-3">
                            <button @click="irAlGrupo(selectedEvent.grupo.id)"
                                class="btn btn-sm btn-soft-group border-0 px-3 py-1.5 rounded-pill d-inline-flex align-items-center gap-1"
                                :style="{ color: '#1e293b', border: `1px solid ${selectedEvent.grupo.color || '#cbd5e1'}` }">
                                <span class="dot-indicator"
                                    :style="{ backgroundColor: selectedEvent.grupo.color || '#cbd5e1' }"></span>
                                <span class="fw-bold text-truncate" style="max-width: 140px;">{{
                                    selectedEvent.grupo.nombre }}</span>
                                <i class="bi bi-arrow-right-short text-muted fs-6"></i>
                            </button>
                        </div>

                        <div class="mt-2">
                            <div class="display-3 text-primary fw-bold lh-1 mb-1">
                                {{ selectedEvent.age }}
                            </div>
                            <p class="text-muted text-uppercase fw-bold tracking-wider mb-2"
                                style="font-size: 0.75rem;">Años a cumplir</p>
                            <small class="text-secondary d-block mt-2 bg-light p-2 rounded-3">
                                Nacimiento: {{ formatBirthDate(selectedEvent.originalDate) }}
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer justify-content-center bg-light border-0 py-2">
                        <button type="button" class="btn btn-outline-secondary btn-sm px-4 rounded-pill"
                            data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>

    </div>
</template>

<style scoped>
.dot-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
}

.btn-soft-group {
    background-color: #f8fafc;
    font-size: 0.75rem;
    transition: all 0.2s ease;
}

.btn-soft-group:hover {
    background-color: #f1f5f9;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.rounded-4 {
    border-radius: 1rem !important;
}

/* Estilos de tabla del calendario */
:deep(.fc table),
:deep(.fc tbody),
:deep(.fc thead),
:deep(.fc tr),
:deep(.fc td),
:deep(.fc th) {
    background-color: transparent !important;
    border-color: var(--fc-border-color) !important;
}

:deep(.fc) {
    font-family: 'Segoe UI', Roboto, sans-serif;
    --fc-border-color: #e5e7eb;
    --fc-today-bg-color: rgba(59, 130, 246, 0.05);
    --fc-event-border-color: transparent;
}

:deep(.fc-daygrid-day:hover) {
    background-color: #f8fafc !important;
    cursor: pointer;
}

:deep(.fc-event) {
    border-radius: 50px;
    padding: 2px 8px;
    font-size: 0.8rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    border: none !important;
    margin-bottom: 2px !important;
}

:deep(.fc-daygrid-event-dot) {
    display: none;
}

:deep(.fc-toolbar-title) {
    font-size: 1.25rem !important;
    text-transform: capitalize;
}

:deep(.fc-button-primary) {
    background-color: white;
    color: #4b5563;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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