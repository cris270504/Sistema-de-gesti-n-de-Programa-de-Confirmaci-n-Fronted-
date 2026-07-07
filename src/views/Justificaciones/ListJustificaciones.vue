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
import PerfilConfirmandoModal from '../../components/Modals/PerfilConfirmandoModal.vue';

const perfilModalRef = ref(null);
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
    descripcion: '',
    fecha_acuerdo: ''
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
        descripcion: item.descripcion || '',
        fecha_acuerdo: item.fecha_acuerdo ? String(item.fecha_acuerdo).substring(0, 10) : ''
    };
    modalVisible.value = true;
};

const cerrarModal = () => {
    modalVisible.value = false;
};

// Guardar acuerdo (Estado: Pendiente)
const guardarAcuerdo = async () => {
    if (!form.value.motivo || !form.value.descripcion || !form.value.fecha_acuerdo) {
        showAlerta('Por favor, completa todos los campos del acuerdo', 'warning');
        return;
    }
    saving.value = true;

    const exito = await justificacionesStore.registrarAcuerdo({
        asistencia_id: form.value.asistencia_id,
        motivo: form.value.motivo,
        descripcion: form.value.descripcion,
        fecha_acuerdo: form.value.fecha_acuerdo
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

// ➔ MODIFICADO: Ahora solo calcula la alerta si la pestaña activa es 'INJUSTIFICADO'
const getClaseAlertaFecha = (fechaFaltaStr) => {
    if (!fechaFaltaStr) return '';

    // Si el usuario está en "Todos", "Pendientes" o "Justificados", no pintamos nada de amarillo
    if (filtroActual.value !== 'INJUSTIFICADO') return '';

    const fechaFalta = new Date(fechaFaltaStr);
    const hoy = new Date();

    // Convertimos la diferencia a días absolutos limpios
    const diferenciaMilisegundos = hoy - fechaFalta;
    const diasTranscurridos = Math.floor(diferenciaMilisegundos / (1000 * 60 * 60 * 24));

    // Si pasaron 7 días o más, activamos la alerta amarilla de "Última semana"
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
        <!-- HEADER -->
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="h3 fw-bold text-gray-800 mb-1">Módulo de Justificaciones</h2>
                <p class="text-muted mb-0 small">Gestión, seguimiento y recuperación de faltas</p>
            </div>
        </div>

        <!-- BARRA DE BÚSQUEDA Y FILTROS -->
        <div class="card border-0 shadow-sm mb-4 rounded-4">
            <div class="card-body p-3">
                <div class="row g-3 align-items-center">
                    <div class="col-md-5">
                        <div class="input-group">
                            <span class="input-group-text bg-light border-end-0 text-muted px-3">
                                <i class="bi bi-search"></i>
                            </span>
                            <input type="text" class="form-control bg-light border-start-0 py-2 shadow-none" 
                                v-model="filterQuery" placeholder="Buscar por apellidos, nombres o grupo...">
                        </div>
                    </div>

                    <div class="col-md-3">
                        <select class="form-select bg-light border-0 py-2 text-secondary fw-medium shadow-none" v-model="grupoSeleccionado">
                            <option value="">Todos los grupos</option>
                            <option v-for="grupo in listaGruposUnicos" :key="grupo" :value="grupo">
                                {{ grupo }}
                            </option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <!-- TABS DE ESTADOS (PILLS MODERNOS) -->
        <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
            <div class="d-flex gap-2">
                <button type="button" @click="filtroActual = 'TODOS'" 
                    class="btn rounded-pill px-4 fw-medium transition-all"
                    :class="filtroActual === 'TODOS' ? 'btn-dark shadow-sm' : 'btn-light text-muted border'">
                    Todos
                </button>
                <button type="button" @click="filtroActual = 'INJUSTIFICADO'" 
                    class="btn rounded-pill px-4 fw-medium transition-all"
                    :class="filtroActual === 'INJUSTIFICADO' ? 'btn-danger shadow-sm' : 'btn-light text-danger border'">
                    Injustificados
                </button>
                <button type="button" @click="filtroActual = 'PENDIENTE'" 
                    class="btn rounded-pill px-4 fw-medium transition-all"
                    :class="filtroActual === 'PENDIENTE' ? 'btn-warning text-dark shadow-sm' : 'btn-light text-warning-emphasis border'">
                    Pendientes
                </button>
                <button type="button" @click="filtroActual = 'JUSTIFICADO'" 
                    class="btn rounded-pill px-4 fw-medium transition-all"
                    :class="filtroActual === 'JUSTIFICADO' ? 'btn-success shadow-sm' : 'btn-light text-success border'">
                    Justificados
                </button>
            </div>

            <span class="badge bg-secondary-subtle text-secondary fs-7 px-3 py-2 rounded-pill border">
                Mostrando {{ justificacionesFiltradas.length }} registros
            </span>
        </div>

        <!-- TABLA PRINCIPAL -->
        <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div class="card-body p-0">
                
                <!-- Estado Carga -->
                <div v-if="loading" class="text-center py-5">
                    <div class="spinner-border text-primary opacity-50 mb-3" style="width: 3rem; height: 3rem;"></div>
                    <p class="mt-2 text-muted fw-medium">Sincronizando inasistencias...</p>
                </div>

                <!-- Estado Vacío -->
                <div v-else-if="filteredPendientes.length === 0" class="text-center py-5 text-muted bg-light">
                    <Check :size="48" class="text-success opacity-50 mb-3 d-block mx-auto" stroke-width="1.5"/>
                    <h5 class="fw-bold text-dark mb-1">Todo al día</h5>
                    <p class="mb-0 small">No se registran faltas en esta categoría.</p>
                </div>

                <!-- Datos -->
                <div v-else class="table-responsive">
                    <table class="table table-hover align-middle mb-0 text-nowrap">
                        <thead class="bg-light text-uppercase text-secondary" style="font-size: 0.75rem; letter-spacing: 0.5px;">
                            <tr>
                                <th class="ps-4 py-3 text-center" style="width: 1%">#</th>
                                <th class="py-3">Confirmando</th>
                                <th class="py-3">Falta Registrada</th>
                                <th class="py-3">Acción Reparadora</th>
                                <th class="py-3">Fecha Acuerdo</th>
                                <th class="py-3 text-center">Estado</th>
                                <th class="text-end pe-4 py-3">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="justificacionesFiltradas.length === 0">
                                <td colspan="7" class="text-center py-5 text-muted fst-italic">
                                    No hay resultados para tu búsqueda en "{{ filtroActual }}".
                                </td>
                            </tr>

                            <tr v-for="(item, index) in justificacionesFiltradas" :key="item.asistencia_id"
                                class="hover-row transition-all" :class="getClaseAlertaFecha(item.fecha_falta)">
                                
                                <td class="text-center text-muted fw-medium ps-4">{{ index + 1 }}</td>

                                <td>
                                    <div class="fw-bold text-dark">{{ item.confirmando }}</div>
                                    <div class="text-muted mt-1" style="font-size: 0.8rem;">
                                        <span class="badge bg-light text-secondary border me-2">{{ item.grupo }}</span>
                                    </div>
                                    <div class="text-secondary mt-1 d-flex align-items-center" style="font-size: 0.75rem;">
                                        <User :size="12" class="me-1 opacity-75" /> {{ item.apoderado_nombre }} 
                                        <span class="mx-1">•</span> 
                                        <Phone :size="12" class="me-1 opacity-75" /> {{ item.apoderado_celular }}
                                    </div>
                                </td>

                                <td>
                                    <div class="text-dark fw-medium d-flex align-items-center">
                                        <Calendar :size="14" class="me-2 text-primary opacity-75"/> 
                                        {{ formatFechaFalta(item.fecha_falta) }}
                                    </div>
                                    <div class="text-muted small text-truncate mt-1 ms-4" style="max-width: 220px;" :title="item.tema_reunion">
                                        {{ item.tema_reunion }}
                                    </div>
                                </td>

                                <td>
                                    <div v-if="item.estado_justificacion !== 'injustificado'">
                                        <span class="fw-bold text-dark" style="font-size: 0.85rem;">{{ item.motivo }}</span>
                                        <div class="text-muted text-wrap fst-italic mt-1" style="font-size: 0.8rem; max-width: 250px;">
                                            "{{ item.descripcion }}"
                                        </div>
                                    </div>
                                    <span v-else class="badge bg-light text-muted border fw-normal">Sin tramitar</span>
                                </td>

                                <td>
                                    <div v-if="item.fecha_acuerdo" class="text-dark fw-medium d-flex align-items-center">
                                        <Calendar :size="14" class="me-2 text-warning opacity-75"/>
                                        {{ formatFechaFalta(item.fecha_acuerdo) }}
                                    </div>
                                    <span v-else class="text-muted opacity-25">---</span>
                                </td>

                                <td class="text-center">
                                    <span class="badge text-uppercase border rounded-pill px-3 py-2" :class="{
                                        'bg-danger-subtle text-danger border-danger': item.estado_justificacion === 'injustificado',
                                        'bg-warning-subtle text-warning-emphasis border-warning': item.estado_justificacion === 'pendiente',
                                        'bg-success-subtle text-success border-success': item.estado_justificacion === 'justificado'
                                    }">
                                        {{ item.estado_justificacion }}
                                    </span>
                                </td>

                                <td class="text-end pe-4">
                                    <div class="d-inline-flex gap-1">
                                        <!-- Botón Perfil -->
                                        <button @click="perfilModalRef.abrir(item.confirmando_id)"
                                            class="btn btn-sm btn-light text-secondary rounded-circle d-flex align-items-center justify-content-center"
                                            style="width: 32px; height: 32px;" title="Ver Ficha del Confirmando">
                                            <User :size="15" />
                                        </button>

                                        <!-- Acciones Injustificado -->
                                        <template v-if="item.estado_justificacion === 'injustificado'">
                                            <button @click="abrirModalAcuerdo(item)"
                                                class="btn btn-sm btn-primary rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                                                style="width: 32px; height: 32px;" title="Registrar Acuerdo">
                                                <Plus :size="16" stroke-width="2.5" />
                                            </button>
                                        </template>

                                        <!-- Acciones Pendiente -->
                                        <template v-else-if="item.estado_justificacion === 'pendiente'">
                                            <button @click="abrirModalAcuerdo(item)"
                                                class="btn btn-sm btn-soft-warning rounded-circle d-flex align-items-center justify-content-center"
                                                style="width: 32px; height: 32px;" title="Editar acuerdo">
                                                <Pencil :size="14" />
                                            </button>
                                            <button @click="confirmarCumplimientoSwal(item)"
                                                class="btn btn-sm btn-success rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                                                style="width: 32px; height: 32px;" title="Validar Cumplimiento">
                                                <Check :size="18" stroke-width="2.5" />
                                            </button>
                                            <button @click="rechazarCumplimientoSwal(item)"
                                                class="btn btn-sm btn-danger rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                                                style="width: 32px; height: 32px;" title="Marcar como no cumplido">
                                                <X :size="18" stroke-width="2.5" />
                                            </button>
                                        </template>

                                        <!-- Acciones Justificado -->
                                        <template v-else-if="item.estado_justificacion !== 'justificado'">
                                            <button @click="abrirModalAcuerdo(item)"
                                                class="btn btn-sm btn-light text-secondary rounded-circle d-flex align-items-center justify-content-center"
                                                style="width: 32px; height: 32px;" title="Ver detalles">
                                                <Pencil :size="14" />
                                            </button>
                                            <span class="text-success bg-success-subtle rounded-circle d-flex align-items-center justify-content-center ms-1"
                                                title="Completado" style="width: 32px; height: 32px;">
                                                <Check :size="16" stroke-width="3" />
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

        <!-- MODAL DE ACUERDO -->
        <div v-if="modalVisible" class="popover-backdrop" @click="cerrarModal"></div>
        <transition name="popover-anim">
            <div v-if="modalVisible" class="mini-dialog shadow-lg rounded-4 bg-white overflow-hidden" style="width: 420px;">
                
                <div class="bg-primary text-white p-4 text-center position-relative">
                    <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-3" @click="cerrarModal"></button>
                    <div class="bg-white bg-opacity-25 rounded-circle d-inline-flex p-3 mb-2">
                        <Pencil :size="24" class="text-white" />
                    </div>
                    <h5 class="fw-bold mb-0">Acuerdo de Justificación</h5>
                    <p class="text-white-50 small mb-0 mt-1">Establece el compromiso de recuperación</p>
                </div>

                <div class="p-4">
                    <div class="mb-4 bg-primary-subtle p-3 rounded-3 border border-primary-subtle d-flex align-items-center">
                        <User :size="20" class="text-primary me-3" />
                        <div>
                            <span class="text-primary text-uppercase fw-bold d-block" style="font-size: 0.65rem; letter-spacing: 0.5px;">Confirmando</span>
                            <span class="text-dark fw-bold">{{ form.confirmando }}</span>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label text-xs fw-bold text-muted text-uppercase mb-1">Motivo del Apoderado</label>
                        <select class="form-select bg-light border-0 shadow-none" v-model="form.motivo">
                            <option value="">Seleccione un motivo...</option>
                            <option value="Salud / Enfermedad">Salud / Enfermedad</option>
                            <option value="Viaje Familiar u Obligatorio">Viaje Familiar u Obligatorio</option>
                            <option value="Cruce de Horario Escolar / Académico">Cruce de Horario Escolar / Académico</option>
                            <option value="Problema de Fuerza Mayor">Problema de Fuerza Mayor</option>
                        </select>
                    </div>

                    <div class="mb-3">
                        <label class="form-label text-xs fw-bold text-muted text-uppercase mb-1">Fecha límite del Acuerdo</label>
                        <input type="date" class="form-control bg-light border-0 shadow-none" v-model="form.fecha_acuerdo">
                    </div>

                    <div class="mb-4">
                        <label class="form-label text-xs fw-bold text-muted text-uppercase mb-1">Acción Reparadora Pactada</label>
                        <textarea class="form-control bg-light border-0 shadow-none" rows="3" v-model="form.descripcion"
                            placeholder="Ej: El joven apoyará leyendo la primera lectura en la misa del domingo..."></textarea>
                    </div>

                    <div class="d-flex gap-2 justify-content-end pt-2 border-top">
                        <button type="button" class="btn btn-light fw-medium px-4 rounded-pill text-secondary" @click="cerrarModal" :disabled="saving">
                            Cancelar
                        </button>
                        <button type="button" class="btn btn-primary fw-medium px-4 rounded-pill shadow-sm" @click="guardarAcuerdo" :disabled="saving">
                            <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
                            Guardar Acuerdo
                        </button>
                    </div>
                </div>
            </div>
        </transition>
    </div>
    
    <!-- Componente Global -->
    <PerfilConfirmandoModal ref="perfilModalRef" />
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
    border-left: 5px solid #f59e0b !important;
    /* Barra naranja/amarilla de advertencia */
}
</style>