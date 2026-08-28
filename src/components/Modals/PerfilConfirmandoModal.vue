<script setup>
import { ref } from 'vue';
import { useConfirmandosStore } from '@/stores/confirmandos'; // Ajusta la ruta de tu store
import { Phone, Users } from 'lucide-vue-next'; // Íconos que usamos en el diseño
import { showAlerta } from '@/funciones'; // Ajusta la ruta de tus alertas

const confirmandosStore = useConfirmandosStore();

const modalVisible = ref(false);
const cargando = ref(false);
const perfilActivo = ref(null);

// Esta función es la que llamarán las otras vistas
const abrir = async (id) => {
    if (!id) return;
    
    modalVisible.value = true;
    cargando.value = true;
    perfilActivo.value = null;

    try {
        const response = await confirmandosStore.fetchPerfilById(id);
        perfilActivo.value = response;
    } catch (error) {
        showAlerta('Error al cargar la ficha del confirmando', 'error');
        cerrar();
    } finally {
        cargando.value = false;
    }
};

const cerrar = () => {
    modalVisible.value = false;
    perfilActivo.value = null;
};

// Helper de fechas integrado al componente
const formatFechaFalta = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Exponemos la función 'abrir' para que los componentes padres puedan usarla
defineExpose({ abrir });
</script>

<template>
    <!-- TELEPORT evita que el modal rompa el diseño del componente padre -->
    <Teleport to="body">
        <div v-if="modalVisible" class="popover-backdrop" aria-hidden="true" @click="cerrar"></div>

        <transition name="popover-anim">
            <div v-if="modalVisible" class="mini-dialog shadow-lg rounded-4 bg-white p-0" role="dialog"
                aria-modal="true" aria-labelledby="perfilConfirmandoLabel" style="width: 700px; max-width: 95vw;">

                <!-- 1. SKELETON LOADER (ESTADO DE CARGA) -->
                <div v-if="cargando" class="placeholder-glow d-flex flex-column" style="height: 100%;" role="status"
                    aria-live="polite" aria-label="Cargando ficha del confirmando">
                    <div class="p-4 border-bottom bg-light rounded-top-4">
                        <span class="placeholder col-6 mb-2 rounded bg-secondary opacity-25" style="height: 28px; display: block;"></span>
                        <span class="placeholder col-3 rounded-pill bg-primary opacity-25" style="height: 20px; display: block;"></span>
                    </div>
                    <div class="p-4">
                        <span class="placeholder col-4 mb-3 rounded bg-secondary opacity-25" style="height: 12px; display: block;"></span>
                        <div class="row g-2 mb-4">
                            <div class="col-6 col-md-3" v-for="i in 4" :key="i">
                                <div class="border rounded-3 p-3 bg-light d-flex flex-column align-items-center">
                                    <span class="placeholder col-4 mb-2 rounded bg-secondary opacity-25" style="height: 24px; display: block;"></span>
                                    <span class="placeholder col-8 rounded bg-secondary opacity-25" style="height: 10px; display: block;"></span>
                                </div>
                            </div>
                        </div>
                        <div class="row mb-4">
                            <div class="col-md-6 mb-3 mb-md-0">
                                <span class="placeholder col-5 mb-2 rounded bg-secondary opacity-25" style="height: 12px; display: block;"></span>
                                <div class="bg-light p-3 rounded-3 border">
                                    <span class="placeholder col-8 mb-2 rounded bg-secondary opacity-25" style="height: 16px; display: block;"></span>
                                    <span class="placeholder col-6 rounded bg-secondary opacity-25" style="height: 12px; display: block;"></span>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <span class="placeholder col-5 mb-2 rounded bg-secondary opacity-25" style="height: 12px; display: block;"></span>
                                <div class="bg-light p-3 rounded-3 border h-100 d-flex align-items-center">
                                    <span class="placeholder col-7 rounded bg-secondary opacity-25" style="height: 16px; display: block;"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. CONTENIDO REAL (CUANDO YA CARGÓ LA DATA) -->
                <div v-else-if="perfilActivo" class="d-flex flex-column" style="max-height: 90vh;">
                    
                    <header class="p-4 border-bottom bg-light rounded-top-4 d-flex justify-content-between align-items-start">
                        <div>
                            <h4 id="perfilConfirmandoLabel" class="fw-bold text-dark mb-1">{{ perfilActivo.joven.nombres }} {{ perfilActivo.joven.apellidos }}</h4>
                            <span class="badge bg-primary rounded-pill">{{ perfilActivo.joven.grupo }}</span>
                        </div>
                        <button type="button" class="btn-close" aria-label="Cerrar" @click="cerrar"></button>
                    </header>

                    <section class="p-4 overflow-y-auto" aria-label="Detalle de asistencia y contacto">
                        <h6 class="text-uppercase text-muted fw-bold mb-3" style="font-size: 0.75rem;">Resumen de Asistencia General</h6>
                        
                        <div class="row g-2 mb-4">
                            <div class="col-6 col-md-3">
                                <div class="border rounded-3 p-2 text-center bg-success-subtle border-success">
                                    <div class="fs-4 fw-bold text-success">{{ perfilActivo.estadisticas.asistencias }}</div>
                                    <div class="small-text text-dark">Asistencias</div>
                                </div>
                            </div>
                            <div class="col-6 col-md-3">
                                <div class="border rounded-3 p-2 text-center bg-warning-subtle border-warning">
                                    <div class="fs-4 fw-bold text-warning">{{ perfilActivo.estadisticas.tardanzas }}</div>
                                    <div class="small-text text-dark">Tardanzas</div>
                                </div>
                            </div>
                            <div class="col-6 col-md-3">
                                <div class="border rounded-3 p-2 text-center bg-info-subtle border-info">
                                    <div class="fs-4 fw-bold text-info">{{ perfilActivo.estadisticas.justificadas }}</div>
                                    <div class="small-text text-dark">Justificadas</div>
                                </div>
                            </div>
                            <div class="col-6 col-md-3">
                                <div class="border rounded-3 p-2 text-center bg-danger-subtle border-danger">
                                    <div class="fs-4 fw-bold text-danger">{{ perfilActivo.estadisticas.injustificadas }}</div>
                                    <div class="small-text text-dark">Injustificadas</div>
                                </div>
                            </div>
                        </div>

                        <div class="row mb-4 perfil-fila">
                            <div class="col-md-6 mb-3 mb-md-0">
                                <h6 class="text-uppercase text-muted fw-bold mb-2" style="font-size: 0.75rem;">Contacto / Apoderado</h6>
                                <div v-if="perfilActivo.apoderado" class="bg-light p-3 rounded-3 border">
                                    <div class="fw-bold text-dark">{{ perfilActivo.apoderado.nombres }} {{ perfilActivo.apoderado.apellidos }}</div>
                                    <div class="text-muted small mt-1 d-flex align-items-center">
                                        <Phone :size="14" class="me-2" aria-hidden="true" /> {{ perfilActivo.apoderado.celular || 'No registrado' }}
                                    </div>
                                </div>
                                <div v-else class="bg-light p-3 rounded-3 border text-muted fst-italic small">
                                    No tiene apoderado registrado.
                                </div>
                            </div>

                            <div class="col-md-6">
                                <h6 class="text-uppercase text-muted fw-bold mb-2" style="font-size: 0.75rem;">Sacramentos Faltantes</h6>
                                <div class="bg-light p-3 rounded-3 border h-100 d-flex align-items-center">
                                    <span class="text-dark fw-medium">{{ perfilActivo.joven.sacramentos_faltantes }}</span>
                                </div>
                            </div>
                        </div>

                        <h6 id="historialAsistenciasLabel" class="text-uppercase text-muted fw-bold mb-2" style="font-size: 0.75rem;">Historial Completo de Asistencias</h6>
                        <div class="border rounded-3 overflow-x-auto cards-sm">
                            <table class="table table-sm table-hover mb-0" aria-labelledby="historialAsistenciasLabel">
                                <caption class="visually-hidden">Historial completo de asistencias del confirmando</caption>
                                <thead class="bg-light text-muted small">
                                    <tr>
                                        <th class="ps-3" scope="col">Fecha</th>
                                        <th scope="col">Tema de la Reunión</th>
                                        <th class="text-end pe-3" scope="col">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="perfilActivo.historial_asistencias.length === 0">
                                        <td colspan="3" class="text-center text-muted fst-italic py-3">No hay registros de asistencia.</td>
                                    </tr>
                                    <tr v-for="(registro, index) in perfilActivo.historial_asistencias" :key="index">
                                        <td class="ps-3 fw-medium small">{{ formatFechaFalta(registro.fecha) }}</td>
                                        <td class="small text-truncate" style="max-width: 200px;" :title="registro.tema">{{ registro.tema }}</td>
                                        <td class="text-end pe-3">
                                            <span class="badge text-uppercase" :class="{
                                                'bg-success text-white': registro.estado === 'asistio' || registro.estado === 'asistió',
                                                'bg-warning text-dark': registro.estado === 'tardanza',
                                                'bg-danger text-white': registro.estado === 'falta injustificada',
                                                'bg-info text-white': registro.estado === 'falta justificada',
                                                'bg-warning-subtle text-warning-emphasis border border-warning': registro.justificacion_estado === 'pendiente'
                                            }">
                                                {{ registro.justificacion_estado === 'pendiente' ? 'Pendiente' : (registro.estado === 'asistio' ? 'Asistió' : registro.estado) }}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>
        </transition>
    </Teleport>
</template>

<style scoped>
/* Las clases de CSS se quedan aquí para no ensuciar otras vistas */
.popover-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.4); /* Un poco más oscuro para que la tabla de fondo se vea claramente difuminada */
    backdrop-filter: blur(4px); /* Aumentamos el difuminado del fondo */
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
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.popover-anim-leave-active {
    transition: all 0.2s ease;
}

.popover-anim-enter-from,
.popover-anim-leave-to {
    opacity: 0;
    transform: translate(-50%, -40%) scale(0.9);
}

/* En celular el modal es pantalla completa (regla global .mini-dialog): el
   contenido interno no debe tener su propio alto ni scroll, scrollea el modal. */
@media (max-width: 575.98px) {
    .mini-dialog > div {
        max-height: none !important;
        height: auto !important;
    }
    .mini-dialog header,
    .mini-dialog section {
        padding: 1rem !important;
    }
    .mini-dialog header {
        position: sticky;
        top: 0;
        z-index: 2;
    }
    .mini-dialog section {
        overflow: visible !important;
    }
}

/* En celular, mismo espacio entre todos los bloques de datos (Contacto,
   Sacramentos, Historial): la caja de Sacramentos ya no se estira (h-100). */
@media (max-width: 767px) {
    /* Gap uniforme de 1rem: entre las dos columnas (mb-3 de la primera) y
       después de la fila hacia el Historial (mb de la fila). */
    .perfil-fila { margin-bottom: 1rem !important; }
    .perfil-fila .h-100 { height: auto !important; }
}

/* Historial de asistencias en celular: fecha a la izquierda, estado a la
   derecha en la misma línea, y el tema debajo (ahorra espacio vertical). */
@media (max-width: 767px) {
    .cards-sm tr {
        display: grid !important;
        grid-template-columns: 1fr auto;
        column-gap: 0.5rem;
        align-items: start;
    }
    .cards-sm td:nth-child(1) {
        grid-column: 1;
        grid-row: 1;
        font-weight: 600;
    }
    .cards-sm td:nth-child(3) {
        grid-column: 2;
        grid-row: 1;
        text-align: right !important;
    }
    .cards-sm td:nth-child(2) {
        grid-column: 1 / -1;
        grid-row: 2;
        color: #64748b;
    }
}
</style>