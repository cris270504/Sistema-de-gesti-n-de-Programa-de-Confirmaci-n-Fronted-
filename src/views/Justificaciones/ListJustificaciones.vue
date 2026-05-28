<script setup>
import { ref, onMounted, computed } from 'vue';
import { useJustificacionesStore } from '../../stores/justificaciones';
import { storeToRefs } from 'pinia';
import { showAlerta, showErroresDeValidacion } from '@/funciones';
import Swal from 'sweetalert2';
import { completeJustificacion } from '@/services/justificaciones';
import {
    Pencil, Trash, Plus, User, Phone, Calendar, Users,
    Wand2, Trash2, Save, Upload, Check, X
} from 'lucide-vue-next';
import { confirmar } from '../../funciones';

const justificacionesStore = useJustificacionesStore();
const { items: pendientes, loading } = storeToRefs(justificacionesStore);

const filterQuery = ref('');
const saving = ref(false);

// Control del Modal
const modalVisible = ref(false);
const form = ref({
    asistencia_id: null,
    confirmando: '',
    motivo: '',
    descripcion: ''
});

const filtroActual = ref('TODOS');

onMounted(async () => {
    try {
        await justificacionesStore.fetchPendientes();
    } catch (e) {
        showAlerta('No se pudieron cargar las faltas pendientes', 'error');
    }
});

const grupoSeleccionado = ref('');

/**
 * EXTRAER GRUPOS ÚNICOS DINÁMICAMENTE
 * Lee los datos que vienen del servidor y arma la lista de grupos existentes.
 */
const listaGruposUnicos = computed(() => {
    if (!pendientes.value) return [];
    // Extraemos todos los nombres de grupo y eliminamos duplicados usando Set
    const grupos = pendientes.value.map(item => item.grupo);
    return [...new Set(grupos)].filter(Boolean).sort();
});

// Buscador simple por nombre de confirmando o grupo (Blindado contra nulos)
const filteredPendientes = computed(() => {
    if (!pendientes.value) return [];

    return pendientes.value.filter(item => {
        const query = filterQuery.value ? filterQuery.value.toLowerCase() : '';

        // ➔ SOLUCIÓN: Aseguramos que si 'confirmando' o 'grupo' son nulos, se evalúen como string vacío
        const nombreConfirmando = item.confirmando ? item.confirmando.toLowerCase() : '';
        const nombreGrupo = item.grupo ? item.grupo.toLowerCase() : '';

        // Ahora el buscador nunca fallará, aunque el dato venga roto de la DB
        const coincideBusqueda = nombreConfirmando.includes(query) || nombreGrupo.includes(query);

        // Filtro por combo de grupo
        const coincideGrupo = !grupoSeleccionado.value || item.grupo === grupoSeleccionado.value;

        return coincideBusqueda && coincideGrupo;
    });
});

const justificacionesFiltradas = computed(() => {
    if (!filteredPendientes.value || filteredPendientes.value.length === 0) return [];

    let resultado = [...filteredPendientes.value];

    // Aplicamos el filtro según la pestaña seleccionada
    if (filtroActual.value !== 'TODOS') {
        resultado = resultado.filter(item => {
            return item.estado_justificacion === filtroActual.value.toLowerCase();
        });
    }

    // Ordenamos: De la fecha más actual (reciente) a la más antigua
    return resultado.sort((a, b) => {
        return new Date(b.fecha_falta) - new Date(a.fecha_falta);
    });
});

// Abrir modal para registrar acuerdo
const abrirModalAcuerdo = (item) => {
    form.value = {
        asistencia_id: item.asistencia_id,
        confirmando: item.confirmando,
        motivo: item.motivo || '',
        descripcion: item.descripcion || ''
    };
    modalVisible.value = true;
};

const cerrarModal = () => {
    modalVisible.value = false;
};

// Guardar acuerdo (Estado: Pendiente)
const guardarAcuerdo = async () => {
    if (!form.value.motivo || !form.value.descripcion) {
        showAlerta('Por favor, completa todos los campos del acuerdo', 'warning');
        return;
    }
    saving.value = true;

    const exito = await justificacionesStore.registrarAcuerdo({
        asistencia_id: form.value.asistencia_id,
        motivo: form.value.motivo,
        descripcion: form.value.descripcion
    });

    if (exito) {
        await justificacionesStore.fetchPendientes();

        // Reseteamos todos los filtros a su estado inicial de limpieza
        filtroActual.value = 'TODOS';
        grupoSeleccionado.value = ''; // <-- AGREGA ESTA LÍNEA AQUÍ
        filterQuery.value = '';

        cerrarModal();
    }

    saving.value = false;
};

// Helper formateo fecha
const formatFechaFalta = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
};

const getClaseAlertaFecha = (fechaFaltaStr) => {
    if (!fechaFaltaStr) return '';

    const fechaFalta = new Date(fechaFaltaStr);
    const hoy = new Date();

    // Convertimos la diferencia a días absolutos limpios
    const diferenciaMilisegundos = hoy - fechaFalta;
    const diasTranscurridos = Math.floor(diferenciaMilisegundos / (1000 * 60 * 60 * 24));

    // Si pasaron 14 días o más, activamos la alerta amarilla de "Última semana"
    return diasTranscurridos >= 7 ? 'fila-alerta-amarilla' : '';
};

const confirmarCumplimientoSwal = async (item) => {
    Swal.fire({
        title: '¿Validar cumplimiento de acuerdo?',
        html: `¿Confirmas que el joven <b>${item.confirmando}</b> cumplió con la acción reparadora pactada para la falta del día <b>${formatFechaFalta(item.fecha_falta)}</b>?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#198754',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, validar cumplimiento',
        cancelButtonText: 'Cancelar',
        reverseButtons: true
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await completeJustificacion(item.asistencia_id);
                showAlerta('¡Falta Justificada con éxito!', 'success');
                justificacionesStore.fetchPendientes();
            } catch (error) {
                console.error(error);
                showAlerta('No se pudo procesar la validación en el servidor.', 'error');
            }
        }
    });
};

const rechazarCumplimientoSwal = async (item) => {
    const seguro = await confirmar({
        titulo: '¿Marcar como No Cumplido?',
        texto: `¿Confirmas que el joven ${item.confirmando} NO cumplió con la acción pactada? La falta quedará como Injustificada definitivamente, saldrá de esta lista y se agregará la nota de incumplimiento.`,
        icono: 'warning',
        confirmarTexto: 'Sí, marcar como injustificada',
        cancelarTexto: 'Cancelar'
    });

    if (seguro) {
        try {
            await justificacionesStore.rechazarAcuerdo(item.asistencia_id);

            showAlerta('Falta archivada como injustificada definitivamente.', 'success');

            await justificacionesStore.fetchPendientes();
        } catch (error) {
            console.error(error);
            showErroresDeValidacion(error);
        }
    }
};
</script>

<template>
    <div class="container-fluid p-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="h3 text-gray-800 mb-1">Módulo de Justificaciones</h2>
                <p class="text-muted mb-0 small">Seguimiento y control de faltas injustificadas de confirmandos</p>
            </div>
        </div>

        <div class="card border-0 shadow-sm mb-4">
            <div class="card-body py-3">
                <div class="row g-2 align-items-center">
                    <div class="col-md-4">
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-white border-end-0 text-muted">
                                <i class="bi bi-search"></i>
                            </span>
                            <input type="text" class="form-control border-start-0 ps-0" v-model="filterQuery"
                                placeholder="Buscar por joven">
                        </div>
                    </div>

                    <div class="col-md-3">
                        <select class="form-select form-select-sm fw-medium text-secondary" v-model="grupoSeleccionado">
                            <option value=""> Todos los grupos</option>
                            <option v-for="grupo in listaGruposUnicos" :key="grupo" :value="grupo">
                                {{ grupo }}
                            </option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-3 bg-white p-2 rounded shadow-sm">
            <div class="btn-group" role="group" aria-label="Filtros de justificaciones">
                <button type="button" @click="filtroActual = 'TODOS'" class="btn px-4 fw-semibold"
                    :class="filtroActual === 'TODOS' ? 'btn-primary' : 'btn-outline-secondary'">
                    Todos
                </button>
                <button type="button" @click="filtroActual = 'INJUSTIFICADO'" class="btn px-4 fw-semibold"
                    :class="filtroActual === 'INJUSTIFICADO' ? 'btn-danger' : 'btn-outline-secondary'">
                    Injustificados
                </button>
                <button type="button" @click="filtroActual = 'PENDIENTE'" class="btn px-4 fw-semibold"
                    :class="filtroActual === 'PENDIENTE' ? 'btn-warning text-dark' : 'btn-outline-secondary'">
                    Pendientes
                </button>
                <button type="button" @click="filtroActual = 'JUSTIFICADO'" class="btn px-4 fw-semibold"
                    :class="filtroActual === 'JUSTIFICADO' ? 'btn-success' : 'btn-outline-secondary'">
                    Justificados
                </button>
            </div>

            <span class="badge bg-secondary fs-6 px-3 py-2 rounded-pill">
                Mostrando: {{ justificacionesFiltradas.length }} registros
            </span>
        </div>

        <div class="card border-0 shadow rounded-4 overflow-hidden">
            <div class="card-body p-0">
                <div v-if="loading" class="text-center py-5">
                    <div class="spinner-border text-primary"></div>
                    <p class="mt-2 text-muted">Buscando inasistencias en el servidor...</p>
                </div>

                <div v-else-if="filteredPendientes.length === 0" class="text-center py-5 text-muted bg-light">
                    <i class="bi bi-shield-check fs-1 mb-2 d-block text-success opacity-75"></i>
                    <p class="mb-0 fw-medium">¡Al día! No se registran faltas pendientes por justificar.</p>
                </div>

                <div v-else class="table-responsive">
                    <table class="table align-middle mb-0 text-nowrap">
                        <thead class="bg-light-gray">
                            <tr>
                                <th class="ps-4 py-2 text-center" style="width: 1%">#</th>
                                <th class="py-2">Confirmando</th>
                                <th class="py-2">Apoderado / Contacto</th>
                                <th class="py-2">Fecha de Falta</th>
                                <th class="py-2">Acción Reparadora / Acuerdo</th>
                                <th class="py-2 text-center">Estado</th>
                                <th class="text-end pe-4 py-2">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="justificacionesFiltradas.length === 0">
                                <td colspan="7" class="text-center py-4 text-muted fs-10">
                                    No hay registros en la categoría "{{ filtroActual }}".
                                </td>
                            </tr>

                            <tr v-for="(item, index) in justificacionesFiltradas" :key="item.asistencia_id"
                                class="hover-row" :class="getClaseAlertaFecha(item.fecha_falta)">
                                <td class="text-center text-muted fw-medium">{{ index + 1 }}</td>

                                <td>
                                    <span class="fw-bold text-dark fs-6">{{ item.confirmando }}</span>
                                    <div class="text-muted small">{{ item.grupo }}</div>
                                </td>

                                <td>
                                    <div class="text-secondary fw-semibold small-text lh-sm">
                                        {{ item.apoderado_nombre }}
                                    </div>
                                    <div class="text-muted mt-0.5 small d-flex align-items-center">
                                        <i class="bi bi-telephone me-1 opacity-75" style="font-size: 0.75rem;"></i>
                                        <span>{{ item.apoderado_celular }}</span>
                                    </div>
                                </td>

                                <td>
                                    <div class="text-dark fw-medium">{{ formatFechaFalta(item.fecha_falta) }}</div>
                                    <div class="text-muted small text-truncate" style="max-width: 180px;">
                                        {{ item.tema_reunion }}
                                    </div>
                                </td>

                                <td>
                                    <div v-if="item.estado_justificacion !== 'injustificado'">
                                        <span class="fw-bold text-dark small">Motivo: {{ item.motivo }}</span>
                                        <div class="text-muted text-wrap italic-text">"{{ item.descripcion }}"</div>
                                    </div>
                                    <span v-else class="text-muted opacity-50 fst-italic">Sin acuerdo registrado</span>
                                </td>

                                <td class="text-center">
                                    <span class="badge text-uppercase border" :class="{
                                        'bg-danger-subtle text-danger border-danger': item.estado_justificacion === 'injustificado',
                                        'bg-warning-subtle text-warning border-warning': item.estado_justificacion === 'pendiente',
                                        'bg-success-subtle text-success border-success': item.estado_justificacion === 'justificado'
                                    }">
                                        {{ item.estado_justificacion }}
                                    </span>
                                </td>

                                <td class="text-end pe-4">
                                    <div class="d-inline-flex gap-2">

                                        <template v-if="item.estado_justificacion === 'injustificado'">
                                            <button @click="abrirModalAcuerdo(item)"
                                                class="btn btn-sm btn-primary rounded-circle d-flex align-items-center justify-content-center"
                                                style="width: 32px; height: 32px;" title="Registrar Acuerdo">
                                                <Plus :size="16" />
                                            </button>
                                        </template>

                                        <template v-else-if="item.estado_justificacion === 'pendiente'">
                                            <button @click="abrirModalAcuerdo(item)"
                                                class="btn btn-sm btn-soft-warning rounded-circle d-flex align-items-center justify-content-center"
                                                style="width: 32px; height: 32px;" title="Editar acuerdo">
                                                <Pencil :size="14" />
                                            </button>

                                            <button @click="confirmarCumplimientoSwal(item)"
                                                class="btn btn-sm btn-success rounded-circle d-flex align-items-center justify-content-center"
                                                style="width: 32px; height: 32px;" title="Validar Cumplimiento">
                                                <Check :size="18" />
                                            </button>

                                            <button @click="rechazarCumplimientoSwal(item)"
                                                class="btn btn-sm btn-danger rounded-circle d-flex align-items-center justify-content-center"
                                                style="width: 32px; height: 32px;" title="Marcar como no cumplido">
                                                <X :size="18" />
                                            </button>
                                        </template>

                                        <template v-else-if="item.estado_justificacion === 'justificado'">
                                            <button @click="abrirModalAcuerdo(item)"
                                                class="btn btn-sm btn-soft-secondary rounded-circle d-flex align-items-center justify-content-center"
                                                style="width: 32px; height: 32px;" title="Editar campos">
                                                <Pencil :size="14" />
                                            </button>
                                            <span class="text-success small ms-1 d-flex align-items-center"
                                                title="Archivado" style="height: 32px;">
                                                <Check :size="18" class="fw-bold" />
                                            </span>
                                        </template>

                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div v-if="modalVisible" class="popover-backdrop" @click="cerrarModal"></div>

        <transition name="popover-anim">
            <div v-if="modalVisible" class="mini-dialog shadow-lg rounded-4 bg-white p-4" style="width: 380px;">
                <div class="text-center mb-3">
                    <h5 class="fw-bold text-dark mb-1">Acuerdo de Justificación</h5>
                    <small class="text-muted">Establece el compromiso de recuperación</small>
                </div>

                <div class="mb-3 small bg-light p-2.5 rounded-3 border">
                    <span class="text-muted text-uppercase fw-bold d-block" style="font-size: 0.6rem;">Joven:</span>
                    <span class="text-dark fw-bold">{{ form.confirmando }}</span>
                </div>

                <div class="mb-3">
                    <label class="form-label text-xs fw-bold text-muted text-uppercase">Motivo del Apoderado</label>
                    <select class="form-select form-select-sm" v-model="form.motivo">
                        <option value="">Seleccione un motivo...</option>
                        <option value="Salud / Enfermedad">Salud / Enfermedad</option>
                        <option value="Viaje Familiar u Obligatorio">Viaje Familiar u Obligatorio</option>
                        <option value="Cruce de Horario Escolar / Académico">Cruce de Horario Escolar / Académico
                        </option>
                        <option value="Problema de Fuerza Mayor">Problema de Fuerza Mayor</option>
                    </select>
                </div>

                <div class="mb-4">
                    <label class="form-label text-xs fw-bold text-muted text-uppercase">Acción Reparadora
                        Pactada</label>
                    <textarea class="form-control form-control-sm" rows="3" v-model="form.descripcion"
                        placeholder="Ej: El joven apoyará leyendo la primera lectura en la misa del domingo..."></textarea>
                </div>

                <div class="d-flex gap-2 justify-content-end">
                    <button type="button" class="btn btn-light btn-sm rounded-pill px-3" @click="cerrarModal"
                        :disabled="saving">
                        Cancelar
                    </button>
                    <button type="button" class="btn btn-primary btn-sm rounded-pill px-4" @click="guardarAcuerdo"
                        :disabled="saving">
                        <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                        Guardar Acuerdo
                    </button>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
.rounded-4 {
    border-radius: 1rem !important;
}

.bg-success-subtle {
    background-color: #d1e7dd !important;
    color: #0f5132 !important;
}

.bg-warning-subtle {
    background-color: #fff3cd !important;
    color: #664d03 !important;
}

.italic-text {
    font-style: italic;
}

.small-text {
    font-size: 0.82rem;
}

.popover-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.2);
    backdrop-filter: blur(2px);
    z-index: 1040;
}

.mini-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1050;
    border: none;
}

.popover-anim-enter-active {
    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.popover-anim-leave-active {
    transition: all 0.15s ease;
}

.popover-anim-enter-from,
.popover-anim-leave-to {
    opacity: 0;
    transform: translate(-50%, -40%) scale(0.9);
}

.text-xs {
    font-size: 0.72rem;
}

/* Estilos para botones circulares de acción soft */
.btn-soft-warning {
    background-color: #fff3cd !important;
    color: #664d03 !important;
    border: 1px solid #ffe69c !important;
}

.btn-soft-warning:hover {
    background-color: #ffda6a !important;
    color: #000000 !important;
}

.btn-soft-secondary {
    background-color: #f8f9fa !important;
    color: #495057 !important;
    border: 1px solid #dee2e6 !important;
}

.btn-soft-secondary:hover {
    background-color: #e9ecef !important;
    color: #212529 !important;
}

/* Efecto hover general de las filas */
.hover-row:hover {
    background-color: #f8fafc;
    transition: background-color 0.15s ease;
}

.fila-alerta-amarilla td {
    background-color: #fff9db !important;
    /* Amarillo pastel sutil */
    border-color: #ffe066 !important;
    /* Contraste de bordes internos */
    transition: background-color 0.15s ease;
}

/* Asegura que el efecto hover de la fila pinte todos sus td en sincronía */
.fila-alerta-amarilla:hover td {
    background-color: #fff3b3 !important;
    /* Amarillo un poco más oscuro al pasar el mouse */
}

/* Añade una barra indicadora en la primera columna */
.fila-alerta-amarilla td:first-child {
    border-left: 5px solid #f59e0b !important; /* Barra naranja/amarilla de advertencia */
}
</style>