<script setup>
import AppButton from '@/components/AppButton.vue'
import { storeToRefs } from 'pinia';
import { Modal } from 'bootstrap';
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn';
import { Cake, ArrowRight } from 'lucide-vue-next';
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useMediaQuery } from '@/composables/useMediaQuery';

const esMovil = useMediaQuery('(max-width: 767px)');
const calendarRef = ref(null);

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
import { useGruposStore } from '../../stores/grupos';
import AppPage from '@/components/AppPage.vue';
import { useParroquiaStore } from '@/stores/parroquia';

const router = useRouter();
const confirmandosStore = useConfirmandosStore();
const usersStore = useUsersStore();
const authStore = useAuthStore();
const parroquiaStore = useParroquiaStore();
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
    // Color de los confirmandos = color de la parroquia. Se lee UNA vez (dentro del computed,
    // así que reacciona si cambia en Configuración); FullCalendar necesita un color literal.
    const colorConfirmando = parroquiaStore.colorEfectivo;
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
        confirmandos.value.forEach(c => processPerson(c, 'Confirmando', colorConfirmando));

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
        misConfirmandos.forEach(c => processPerson(c, 'Confirmando', colorConfirmando));

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

watch(esMovil, (movil) => {
    const api = calendarRef.value?.getApi?.();
    if (api) api.changeView(movil ? 'listMonth' : 'dayGridMonth');
});

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

let detachFocusReturn = () => {};

onMounted(async () => {
    await Promise.all([
        confirmandosStore.fetchAll(),
        usersStore.fetchAll()
    ]);

    nextTick(() => {
        const detailsEl = document.getElementById('detailsModal');
        if (detailsEl) {
            detailsModalInstance.value = new Modal(detailsEl);
            detachFocusReturn = attachModalFocusReturn(detailsEl);
        }
    });
});

onUnmounted(() => {
    detachFocusReturn();
    detailsModalInstance.value?.dispose();
});
</script>

<template>
    <AppPage title="Cumpleaños"
        :subtitle="esCoordinadorOAdmin ? 'Seguimiento general de la comunidad' : 'Cumpleaños de mi grupo'"
        :loading="loading">
        <template #actions>
            <div class="d-flex gap-3">
                <div class="d-flex align-items-center">
                    <span class="d-inline-block rounded-circle me-2" style="width: 12px; height: 12px; background-color: var(--accent);"></span>
                    <small class="text-muted">Confirmandos</small>
                </div>
                <div class="d-flex align-items-center">
                    <span class="d-inline-block rounded-circle me-2" style="width: 12px; height: 12px; background-color: #f59e0b;"></span>
                    <small class="text-muted">Catequistas</small>
                </div>
            </div>
        </template>

        <div class="surface surface--pad mb-4">
            <FullCalendar ref="calendarRef" :options="calendarOptions" />
        </div>

        <div class="modal fade" id="detailsModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-sm">
                <div class="modal-content">
                    <div class="modal-header">
                      <span class="modal-header__icon" aria-hidden="true"><Cake :size="18" /></span>
                      <div class="modal-header__text">
                        <h5 class="modal-title">¡Cumpleaños!</h5>
                      </div>
                      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                    </div>

                    <div class="modal-body text-center py-4">
                        <h4 class="fw-bold text-dark mb-1 fs-5">{{ selectedEvent.title.replace('🎂 ', '') }}</h4>

                        <div class="d-flex justify-content-center gap-2 mb-3">
                            <span class="badge rounded-pill px-3 py-1.5 small"
                                :class="selectedEvent.type === 'Confirmando' ? 'bg-primary-subtle text-primary' : 'bg-warning-subtle text-warning-emphasis'">
                                {{ selectedEvent.type }}
                            </span>
                        </div>

                        <div v-if="esCoordinadorOAdmin && selectedEvent.grupo" class="mb-3">
                            <button @click="irAlGrupo(selectedEvent.grupo.id)"
                                class="btn btn-sm btn-soft-group border-0 px-3 py-1.5 rounded-pill d-inline-flex align-items-center gap-1"
                                :style="{ color: 'var(--text)', border: `1px solid ${selectedEvent.grupo.color || '#cbd5e1'}` }">
                                <span class="dot-indicator"
                                    :style="{ backgroundColor: selectedEvent.grupo.color || '#cbd5e1' }"></span>
                                <span class="fw-bold text-truncate" style="max-width: 140px;">{{
                                    selectedEvent.grupo.nombre }}</span>
                                <ArrowRight class="text-muted" :size="16" aria-hidden="true" />
                            </button>
                        </div>

                        <div class="mt-2">
                            <div class="display-3 text-primary fw-bold lh-1 mb-1">
                                {{ selectedEvent.age }}
                            </div>
                            <p class="text-muted fw-bold mb-2"
                                style="font-size: 0.75rem;">Años a cumplir</p>
                            <small class="text-secondary d-block mt-2 bg-light p-2 rounded-3">
                                Nacimiento: {{ formatBirthDate(selectedEvent.originalDate) }}
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <AppButton variant="ghost" type="button" data-bs-dismiss="modal">Cerrar</AppButton>
                    </div>
                </div>
            </div>
        </div>
    </AppPage>
</template>

<style scoped>
.btn-soft-group {
    background-color: var(--surface-sunken);
    font-size: var(--fs-xs);
    transition: all 0.2s ease;
}
.btn-soft-group:hover {
    background-color: var(--surface-sunken);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
}

.dot-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
}

.rounded-4 {
    border-radius: var(--radius-xl) !important;
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
    --fc-border-color: var(--line);
    --fc-today-bg-color: rgba(59, 130, 246, 0.05);
    --fc-event-border-color: transparent;
}

:deep(.fc-daygrid-day:hover) {
    background-color: var(--surface-sunken) !important;
    cursor: pointer;
}

:deep(.fc-event) {
    border-radius: 50px;
    padding: 2px 8px;
    font-size: var(--fs-sm);
    box-shadow: var(--shadow-md);
    border: none !important;
    margin-bottom: 2px !important;
}

:deep(.fc-daygrid-event-dot) {
    display: none;
}

:deep(.fc-toolbar-title) {
    font-size: var(--fs-lg) !important;
    text-transform: capitalize;
}

:deep(.fc-button-primary) {
    background-color: white;
    color: #4b5563;
    border: 1px solid var(--line);
    box-shadow: var(--shadow-sm);
}

:deep(.fc-button-primary:hover) {
    background-color: var(--surface-sunken);
    color: #111827;
}

:deep(.fc-button-primary.fc-button-active) {
    background-color: var(--accent);
    color: white;
    border-color: var(--accent);
}

:deep(.fc-day-today .fc-daygrid-day-number) {
    background-color: var(--accent);
    color: white;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 4px;
}

:deep(.fc-list-event-title),
:deep(.fc-list-event-title a) {
    color: var(--text) !important;
    font-weight: 600 !important;
    text-decoration: none;
}

@media (max-width: 767px) {
    :deep(.fc-toolbar) {
        flex-direction: column;
        gap: 0.5rem;
        align-items: stretch;
    }
    :deep(.fc-toolbar-title) {
        font-size: var(--fs-base) !important;
        text-align: center;
    }
    :deep(.fc-toolbar-chunk) {
        display: flex;
        justify-content: center;
    }
    :deep(.fc-button) {
        padding: 0.3rem 0.7rem !important;
        font-size: var(--fs-ui) !important;
    }
    :deep(.fc-list-event-title) { white-space: normal; }
}

/* ===== MODO OSCURO =====
   :deep() sin selector propio antes compila a global (sin scoping) — se
   scopea a mano vía `.surface` (el contenedor propio de esta vista que
   envuelve el calendario) para no afectar otras vistas con FullCalendar
   (ListCronograma.vue colorea sus botones con --accent, no necesita
   este fix). */
:root[data-bs-theme="dark"] .surface :deep(.fc-button-primary) {
  background-color: var(--line);
  color: var(--text);
  border-color: var(--line-strong);
}
:root[data-bs-theme="dark"] .surface :deep(.fc-button-primary:hover) {
  background-color: var(--line-strong);
  color: var(--text);
}
</style>