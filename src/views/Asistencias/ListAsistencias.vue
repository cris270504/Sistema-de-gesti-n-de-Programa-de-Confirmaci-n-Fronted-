<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import { useAsistenciasStore } from '../../stores/asistencias';
import { useGruposStore } from '../../stores/grupos';
import { useAuthStore } from '../../stores/auth';
import { storeToRefs } from 'pinia';
import { showAlerta } from '@/funciones';
import { useRoute, useRouter } from 'vue-router';

const modelTypeMap = {
    'Confirmandos': 'App\\Models\\Confirmando',
    'Catequistas': 'App\\Models\\User',
    'Apoderados': 'App\\Models\\Apoderado'
};

const props = defineProps({
    defaultTipo: {
        type: String,
        default: 'Confirmandos'
    }
})

const asistenciasStore = useAsistenciasStore();
const gruposStore = useGruposStore();
const authStore = useAuthStore();
const { items: grupos } = storeToRefs(gruposStore);

const route = useRoute();
const currentMonth = ref(new Date().toISOString().slice(0, 7));
const tipoActual = ref(props.defaultTipo);
const filterGrupo = ref('');
const reuniones = ref([]);
const personas = ref([]);
const attendanceMap = ref({});
const changes = ref({});
const loading = ref(false);
const saving = ref(false);

const popover = ref({
    visible: false,
    x: 0, y: 0,
    personaId: null,
    reunionId: null,
    estado: null,
    nota: ''
});

const hasAssignedGroups = computed(() => {
    const user = authStore.user;
    if (!user) return false;

    return !!(user.grupo_id || (user.grupos && user.grupos.length > 0));
});

const canAccess = computed(() => {
    // 1. Si es Coordinador/Admin (puede ver todas), SIEMPRE accede
    if (authStore.can('ver todas las asistencias')) return true;

    // 2. Si es Catequista, solo accede si tiene grupos asignados
    return hasAssignedGroups.value;
});

// --- COMPUTEDS ---
const labelSingular = computed(() => {
    const mapa = { 'Confirmandos': 'Confirmando', 'Catequistas': 'Catequista', 'Apoderados': 'Apoderado' };
    return mapa[tipoActual.value] || 'Persona';
});

const filteredPersonas = computed(() => {
    let lista = personas.value || [];

    // 1. Si estamos viendo la lista de "Catequistas", filtramos por rol (esto está bien)
    if (tipoActual.value === 'Catequistas') {
        lista = lista.filter(p =>
            p.roles && p.roles.some(role => role.name === 'catequista' || role.name === 'coordinador')
        );
    }

    // 2. FILTRO DE SEGURIDAD PARA CATEQUISTAS (Confirmandos y Apoderados)
    // Si NO tengo permiso de ver todo (soy catequista)...
    if (!authStore.can('ver todas las asistencias')) {

        // A. Recopilamos mis grupos permitidos
        const misGruposIds = [];

        // Caso 1: Tengo un grupo directo
        if (authStore.user?.grupo_id) {
            misGruposIds.push(Number(authStore.user.grupo_id));
        }

        // Caso 2: Tengo una lista de grupos (relación muchos a muchos)
        if (authStore.user?.grupos && Array.isArray(authStore.user.grupos)) {
            authStore.user.grupos.forEach(g => misGruposIds.push(Number(g.id)));
        }

        // B. Seguridad: Si no tengo ningún grupo asignado, no debo ver a nadie.
        if (misGruposIds.length === 0) {
            return [];
        }

        // C. Aplicamos el filtro
        lista = lista.filter(p => {
            // Obtenemos el grupo de la persona (ya sea directo o calculado en loadMatrix)
            const idGrupoPersona = p.grupo_id || p.grupo?.id;

            // Verificamos si existe y si está en mi lista de permitidos
            return idGrupoPersona && misGruposIds.includes(Number(idGrupoPersona));
        });
    }

    // 3. Filtro por Dropdown (Solo para Coordinadores que pueden ver todo)
    if (filterGrupo.value) {
        lista = lista.filter(p => {
            const idGrupoPersona = p.grupo_id || p.grupo?.id;
            return idGrupoPersona && Number(idGrupoPersona) === Number(filterGrupo.value);
        });
    }

    return lista;
});

const stats = computed(() => {
    const counts = { asistio: 0, tardanza: 0, justificada: 0, injustificada: 0, totalRegistros: 0 };

    filteredPersonas.value.forEach(p => {
        reuniones.value.forEach(r => {
            const estado = attendanceMap.value[p.id]?.[r.id]?.estado;
            if (estado) {
                counts.totalRegistros++;
                if (estado === 'asistio') counts.asistio++;
                else if (estado === 'tardanza') counts.tardanza++;
                else if (estado === 'falta justificada') counts.justificada++;
                else if (estado === 'falta injustificada') counts.injustificada++;
            }
        });
    });

    const total = counts.asistio + counts.tardanza + counts.justificada + counts.injustificada;
    const porcentaje = total > 0 ? Math.round(((counts.asistio + counts.tardanza) / total) * 100) : 0;
    return { ...counts, total, porcentaje };
});

// --- WATCHERS Y LIFECYCLE ---
watch(currentMonth, () => {
    if (canAccess.value) loadMatrix();
});

watch(() => props.defaultTipo, (newTipo) => {
    if (!canAccess.value) return; // Bloqueo
    tipoActual.value = newTipo;
    personas.value = [];
    reuniones.value = [];
    attendanceMap.value = {};
    loadMatrix();
});

onMounted(async () => {
    await gruposStore.fetchAll();

    // BLOQUEO: Si no tiene acceso, no cargamos nada
    if (!canAccess.value) return;

    if (route.query.fecha) currentMonth.value = route.query.fecha;
    if (route.query.grupo) filterGrupo.value = Number(route.query.grupo);

    await loadMatrix();
});

function resetData() {
    personas.value = [];
    reuniones.value = [];
    attendanceMap.value = {};
    changes.value = {};
}

// --- CARGA DE DATOS (CORE) ---
async function loadMatrix() {
    if (!currentMonth.value) return;
    loading.value = true;
    try {
        const data = await asistenciasStore.fetchMatrix(tipoActual.value, currentMonth.value);

        if (data) {
            reuniones.value = data.reuniones;

            // --- A. PROCESAMIENTO DE PERSONAS ---
            let listaProcesada = [];

            if (tipoActual.value === 'Apoderados') {
                const groupedByChild = {};
                data.personas.forEach(apo => {
                    if (apo.confirmandos && apo.confirmandos.length > 0) {
                        apo.confirmandos.forEach(hijo => {
                            if (!groupedByChild[hijo.id]) {
                                groupedByChild[hijo.id] = {
                                    id: hijo.id,
                                    nombres: hijo.nombres,
                                    apellidos: hijo.apellidos,
                                    estado: hijo.estado,
                                    grupo_id: hijo.grupo_id || hijo.grupo?.id,
                                    grupo_nombre: hijo.grupo?.nombre || 'Sin Grupo',
                                    es_confirmando: true,
                                    mis_apoderados: []
                                };
                            }
                            groupedByChild[hijo.id].mis_apoderados.push(apo);
                        });
                    }
                });
                listaProcesada = Object.values(groupedByChild);
            } else {
                listaProcesada = data.personas.map(p => {
                    p.grupo_id = p.grupo_id || p.grupo?.id;
                    p.grupo_nombre = p.grupo?.nombre || 'Sin Grupo';
                    return p;
                });
            }
            personas.value = listaProcesada;

            const map = {};

            if (tipoActual.value === 'Apoderados') {
                personas.value.forEach(hijo => {
                    map[hijo.id] = {};

                    reuniones.value.forEach(reunion => {
                        const estadosEncontrados = hijo.mis_apoderados.map(apo => {
                            const registro = apo.asistencias?.find(a => a.reunion_id === reunion.id);
                            return registro ? registro.estado : null;
                        }).filter(e => e !== null); // Quitamos nulos

                        let estadoFinal = null;

                        if (estadosEncontrados.includes('asistio')) {
                            estadoFinal = 'asistio';
                        } else if (estadosEncontrados.includes('tardanza')) {
                            estadoFinal = 'tardanza';
                        } else if (estadosEncontrados.includes('falta justificada')) {
                            estadoFinal = 'falta justificada';
                        } else if (estadosEncontrados.includes('falta injustificada')) {
                            estadoFinal = 'falta injustificada';
                        }

                        map[hijo.id][reunion.id] = {
                            estado: estadoFinal,
                            nota: estadoFinal ? 'Registro familiar' : ''
                        };
                    });
                });
            } else {
                personas.value.forEach(p => {
                    map[p.id] = {};
                    if (p.asistencias) {
                        p.asistencias.forEach(a => {
                            map[p.id][a.reunion_id] = { estado: a.estado, nota: a.nota || a.observacion };
                        });
                    }
                });
            }

            attendanceMap.value = map;
            changes.value = {};
        }
    } catch (e) {
        console.error("Error cargando matriz:", e);
    } finally {
        loading.value = false;
    }
}

// --- INTERACCIÓN CON EL POPOVER ---
const openPopover = (event, personaId, reunionId) => {
    // Evitar reabrir si ya está abierto
    if (popover.value.visible && popover.value.personaId === personaId && popover.value.reunionId === reunionId) return;

    const currentData = attendanceMap.value[personaId]?.[reunionId] || { estado: null, nota: '' };

    popover.value = {
        visible: true,
        personaId,
        reunionId,
        estado: currentData.estado,
        nota: currentData.nota
    };

    nextTick(() => { document.getElementById('popoverInput')?.focus(); });
};

const closePopover = () => {
    if (!popover.value.visible) return;

    const { personaId, reunionId, estado, nota } = popover.value;

    // --- 1. VALIDACIÓN DE SEGURIDAD ---
    // Si no tiene permiso de editar (ej. reunión pasada), simplemente cerramos y nos vamos.
    if (!canEditAttendance(personaId, reunionId)) {
        popover.value.visible = false;
        return;
    }

    if (tipoActual.value !== 'Apoderados') {

        // --- 2. VALIDACIÓN DE CAMBIO REAL ---
        // Obtenemos el valor original que está en memoria (AttendanceMap)
        // Ojo: Usamos el map directamente, no 'changes', para comparar con la "verdad"
        const originalData = attendanceMap.value[personaId]?.[reunionId] || { estado: null, nota: '' };

        const estadoOriginal = originalData.estado || null;
        const notaOriginal = (originalData.nota || '').trim();

        const estadoNuevo = estado || null;
        const notaNueva = (nota || '').trim();

        // Si NO hubo cambios reales (es decir, abriste y cerraste sin tocar, o pusiste lo mismo)
        if (estadoOriginal === estadoNuevo && notaOriginal === notaNueva) {

            // IMPORTANTE: Si existía un cambio pendiente pero lo dejaste igual al original,
            // lo borramos de la lista de cambios para que el contador baje.
            const key = `${personaId}-${reunionId}`;
            if (changes.value[key]) {
                delete changes.value[key];
            }

            popover.value.visible = false;
            return;
        }

        // --- 3. SI HUBO CAMBIOS, PROCEDEMOS ---

        // Actualizar visualmente la memoria
        if (!attendanceMap.value[personaId]) attendanceMap.value[personaId] = {};
        attendanceMap.value[personaId][reunionId] = { estado, nota };

        // Registrar en changes
        const key = `${personaId}-${reunionId}`;
        changes.value[key] = {
            asistente_id: personaId,
            asistente_type: modelTypeMap[tipoActual.value],
            reunion_id: reunionId,
            estado: estado,
            nota: nota
        };
    }

    popover.value.visible = false;
};

// --- HELPERS Y LÓGICA DE APODERADOS ---

const getNameOfPerson = (id) => {
    const p = personas.value.find(person => person.id === id);
    if (!p) return 'Desconocido';
    return p.apellidos ? `${p.apellidos}, ${p.nombres}` : p.name;
};

const getDateOfReunion = (id) => {
    const r = reuniones.value.find(reunion => reunion.id === id);
    return r ? `${r.nombre_tema} (${formatColDate(r.fecha)})` : '';
};

// Obtiene el objeto del hijo (fila actual)
const getHijoObj = (hijoId) => personas.value.find(p => p.id === hijoId);

// Devuelve los papás de ese hijo
const getApoderadosDeHijo = (hijoId) => {
    const hijo = getHijoObj(hijoId);
    return hijo ? hijo.mis_apoderados : [];
};

// Verifica el estado de un apoderado específico (para pintar los botones del modal)
const checkStatusApoderado = (apoderado, reunionId) => {
    const key = `${apoderado.id}-${reunionId}-apo`;

    // 1. Buscamos en cambios locales
    if (changes.value[key]) return changes.value[key].estado;

    // 2. Buscamos en BD
    const registro = apoderado.asistencias?.find(a => a.reunion_id === reunionId);
    return registro ? registro.estado : null;
};

// Setea el estado de un apoderado (A, T, J, F)
const setApoderadoStatus = (apoderado, reunionId, nuevoEstado) => {
    const estadoActual = checkStatusApoderado(apoderado, reunionId);
    // Toggle: Si clickeo lo mismo, se desmarca (null)
    const estadoFinal = (estadoActual === nuevoEstado) ? null : nuevoEstado;

    const key = `${apoderado.id}-${reunionId}-apo`;

    // Guardamos el cambio específico
    changes.value[key] = {
        asistente_id: apoderado.id,
        asistente_type: 'App\\Models\\Apoderado',
        reunion_id: reunionId,
        estado: estadoFinal,
        nota: ''
    };

    // Actualizamos el color de la celda padre
    updateFamilyStatusVisual(popover.value.personaId, reunionId);
};

// Calcula el color de la celda del confirmando basado en sus padres
const updateFamilyStatusVisual = (hijoId, reunionId) => {
    const apoderados = getApoderadosDeHijo(hijoId);
    let mejorEstado = null;
    let prioridad = 5; // 1=Mejor, 5=Peor

    for (const apo of apoderados) {
        const est = checkStatusApoderado(apo, reunionId);

        if (est === 'asistio') { mejorEstado = 'asistio'; prioridad = 1; break; }
        else if (est === 'tardanza' && prioridad > 2) { mejorEstado = 'tardanza'; prioridad = 2; }
        else if (est === 'falta justificada' && prioridad > 3) { mejorEstado = 'falta justificada'; prioridad = 3; }
        else if (est === 'falta injustificada' && prioridad > 4) { if (prioridad === 5) mejorEstado = 'falta injustificada'; }
    }

    if (!attendanceMap.value[hijoId]) attendanceMap.value[hijoId] = {};
    attendanceMap.value[hijoId][reunionId] = { estado: mejorEstado };
};

// Setter simple para modo Confirmando/Catequista
const setStatus = (newStatus) => {
    if (popover.value.estado === newStatus) popover.value.estado = null; // Toggle
    else popover.value.estado = newStatus;
};

//SOLO EL ADMIN PUEDE EDITAR
const canEditAttendance = (personaId, reunionId) => {
    // 1. Si es Admin (tiene permiso de editar), SIEMPRE puede editar todo
    if (authStore.can('editar asistencias')) return true;

    // 2. SOLUCIÓN A TU PROBLEMA:
    // Verificamos si hay "cambios locales sin guardar" para esta persona/reunión.
    // Si la celda está en la lista de cambios, significa que la estamos editando AHORA,
    // así que permitimos seguir editando (corregir errores).

    if (tipoActual.value !== 'Apoderados') {
        const key = `${personaId}-${reunionId}`;
        // Si existe en 'changes', es editable (porque aún no se ha guardado en BD)
        if (changes.value[key]) return true;
    } else {
        // Lógica especial para Apoderados:
        // Si algún familiar de este confirmando tiene cambios pendientes, permitimos editar la familia.
        const hijo = getHijoObj(personaId);
        if (hijo && hijo.mis_apoderados.some(apo => changes.value[`${apo.id}-${reunionId}-apo`])) {
            return true;
        }
    }

    // 3. Si NO hay cambios locales, miramos si ya vino lleno desde la Base de Datos
    const currentStatus = attendanceMap.value[personaId]?.[reunionId]?.estado;

    // Si ya tiene estado (y no está en changes), significa que vino de la BD guardado. BLOQUEAR.
    if (currentStatus) {
        return false;
    }

    // 4. Si no hay nada en BD y no hay cambios, está libre para editar.
    return true;
};

// --- GUARDAR CAMBIOS ---
const saveChanges = async () => {
    if (Object.keys(changes.value).length === 0) return;

    const reunionesIncompletas = [];

    reuniones.value.forEach(r => {
        let completados = 0;
        const totalPersonas = filteredPersonas.value.length;

        filteredPersonas.value.forEach(p => {
            const estado = attendanceMap.value[p.id]?.[r.id]?.estado;
            if (estado) {
                completados++;
            }
        });

        if (completados > 0 && completados < totalPersonas) {
            reunionesIncompletas.push({
                nombre: r.nombre_tema,
                faltantes: totalPersonas - completados
            });
        }
    });

    if (reunionesIncompletas.length > 0) {
        const detalles = reunionesIncompletas
            .map(r => `• ${r.nombre} (Faltan ${r.faltantes})`)
            .join('\n');
        showAlerta(`No puedes guardar listas incompletas.\nPor favor termina de registrar a todos:\n\n${detalles}`, 'warning');
        return;
    }

    saving.value = true;
    try {
        const payload = Object.values(changes.value).filter(c =>
            c.estado !== undefined || (c.nota !== undefined && c.nota !== '')
        );

        // Agrupar por reunión para eficiencia
        const updatesByReunion = {};
        payload.forEach(p => {
            if (!updatesByReunion[p.reunion_id]) updatesByReunion[p.reunion_id] = [];
            updatesByReunion[p.reunion_id].push(p);
        });

        const promises = Object.entries(updatesByReunion).map(([rId, items]) =>
            asistenciasStore.saveBulk(rId, items)
        );

        await Promise.all(promises);

        // Recargamos para limpiar estados sucios y traer data fresca
        changes.value = {};
        await loadMatrix();

    } catch (e) {
        console.error(e);
        showAlerta('Error al guardar: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
        saving.value = false;
    }
};

const formatColDate = (dateStr) => {
    const date = new Date(dateStr);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
};
</script>

<template>
    <div class="container-fluid p-4 position-relative">

        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="h3 text-gray-800 mb-1">Matriz de Asistencia: {{ tipoActual }}</h2>
                <p class="text-muted mb-0 small">Gestión mensual de asistencia</p>
            </div>
            <button class="btn btn-primary shadow-sm px-4" @click="saveChanges"
                :disabled="Object.keys(changes).length === 0 || saving">
                <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-save me-2"></i>
                Guardar Cambios <span v-if="Object.keys(changes).length > 0" class="badge bg-white text-primary ms-2">{{
                    Object.keys(changes).length }}</span>
            </button>
        </div>

        <div class="row g-3 mb-4">
            <div class="col-md-3 col-6">
                <div class="card border-0 shadow-sm h-100 border-start border-4 border-success">
                    <div class="card-body p-3">
                        <div class="d-flex align-items-center">
                            <div class="flex-shrink-0 me-3">
                                <div class="bg-success-subtle text-success rounded-circle d-flex align-items-center justify-content-center"
                                    style="width: 48px; height: 48px;">
                                    <i class="bi bi-check-lg fs-4"></i>
                                </div>
                            </div>
                            <div>
                                <p class="text-muted mb-0 small fw-bold text-uppercase">Asistencias</p>
                                <h4 class="mb-0 fw-bold text-gray-800">{{ stats.asistio }}</h4>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-md-3 col-6">
                <div class="card border-0 shadow-sm h-100 border-start border-4 border-warning">
                    <div class="card-body p-3">
                        <div class="d-flex align-items-center">
                            <div class="flex-shrink-0 me-3">
                                <div class="bg-warning-subtle text-warning rounded-circle d-flex align-items-center justify-content-center"
                                    style="width: 48px; height: 48px;">
                                    <i class="bi bi-clock fs-4"></i>
                                </div>
                            </div>
                            <div>
                                <p class="text-muted mb-0 small fw-bold text-uppercase">Tardanzas</p>
                                <h4 class="mb-0 fw-bold text-gray-800">{{ stats.tardanza }}</h4>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-md-3 col-6">
                <div class="card border-0 shadow-sm h-100 border-start border-4 border-danger">
                    <div class="card-body p-3">
                        <div class="d-flex align-items-center">
                            <div class="flex-shrink-0 me-3">
                                <div class="bg-danger-subtle text-danger rounded-circle d-flex align-items-center justify-content-center"
                                    style="width: 48px; height: 48px;">
                                    <i class="bi bi-x-lg fs-4"></i>
                                </div>
                            </div>
                            <div>
                                <p class="text-muted mb-0 small fw-bold text-uppercase">Faltas (Totales)</p>
                                <h4 class="mb-0 fw-bold text-gray-800">{{ stats.justificada + stats.injustificada }}
                                </h4>
                                <small class="text-xs text-muted">
                                    <span class="text-info">{{ stats.justificada }} Just.</span> /
                                    <span class="text-danger">{{ stats.injustificada }} Injust.</span>
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-md-3 col-6">
                <div class="card border-0 shadow-sm h-100 border-start border-4 border-primary">
                    <div class="card-body p-3">
                        <div class="d-flex align-items-center">
                            <div class="flex-shrink-0 me-3">
                                <div class="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center"
                                    style="width: 48px; height: 48px;">
                                    <i class="bi bi-pie-chart fs-4"></i>
                                </div>
                            </div>
                            <div>
                                <p class="text-muted mb-0 small fw-bold text-uppercase">% Participación</p>
                                <h4 class="mb-0 fw-bold text-gray-800">{{ stats.porcentaje }}%</h4>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card border-0 shadow-sm mb-4 bg-white rounded-3">
            <div class="card-body py-3">
                <div class="row g-3 align-items-center">
                    <div class="col-md-3 col-sm-6">
                        <label class="form-label text-xs fw-bold text-uppercase text-muted">Mes</label>
                        <input type="month" class="form-control form-control-sm" v-model="currentMonth">
                    </div>
                    <div v-if="authStore.can('ver todas las asistencias')" class="col-md-4 col-sm-6">
                        <label class="form-label text-xs fw-bold text-uppercase text-muted">Grupo</label>
                        <select class="form-select form-select-sm" v-model="filterGrupo">
                            <option value="">Todos los grupos</option>
                            <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
                        </select>
                    </div>

                    <div class="col-md-5 d-flex justify-content-end gap-2 align-self-end">
                        <span class="badge bg-success-subtle text-success border border-success-subtle"><i
                                class="bi bi-check-lg"></i> A</span>
                        <span class="badge bg-warning-subtle text-warning border border-warning-subtle"><i
                                class="bi bi-clock"></i> T</span>
                        <span class="badge bg-info-subtle text-info border border-info-subtle"><i
                                class="bi bi-file-medical"></i> J</span>
                        <span class="badge bg-danger-subtle text-danger border border-danger-subtle"><i
                                class="bi bi-x-lg"></i> F</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="card border-0 shadow rounded-3 overflow-hidden">
            <div class="card-body p-0">
                <div v-if="loading" class="text-center py-5">
                    <div class="spinner-border text-primary"></div>
                    <p class="mt-2 text-muted">Cargando matriz...</p>
                </div>
                <div v-else-if="reuniones.length === 0" class="text-center py-5 text-muted bg-light">
                    <i class="bi bi-calendar-x fs-1 mb-3 d-block opacity-50"></i>
                    <p>No hay reuniones registradas en este mes.</p>
                </div>

                <div v-else class="table-responsive custom-scrollbar" style="max-height: 70vh;">
                    <table class="table table-bordered mb-0 text-center align-middle matrix-table">
                        <thead class="bg-light sticky-top" style="z-index: 10;">
                            <tr>
                                <th class="sticky-col start-0 bg-light text-start ps-4 py-3 shadow-sm-right"
                                    style="min-width: 280px; z-index: 20;">
                                    {{ labelSingular }}
                                </th>
                                <th v-for="r in reuniones" :key="r.id" class="py-2 px-1" style="min-width: 70px;">
                                    <div class="fw-bold text-dark text-wrap mb-1"
                                        style="font-size: 0.75rem; line-height: 1.2; max-height: 35px; overflow: hidden;"
                                        :title="r.nombre_tema">
                                        {{ r.nombre_tema }}
                                    </div>
                                    <div class="fw-bold text-dark" style="font-size: 0.9rem;">{{ formatColDate(r.fecha)
                                        }}</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="p in filteredPersonas" :key="p.id"
                                :class="{ 'bg-light opacity-75': p.estado === 'retirado' }">
                                <td class="text-start sticky-col bg-white ps-4 py-2 shadow-sm-right">
                                    <div class="d-flex align-items-center">
                                        <div>
                                            <div class="fw-medium text-dark">
                                                {{ p.apellidos ? `${p.apellidos}, ${p.nombres}` : p.name }}
                                                <span v-if="p.estado === 'retirado'" class="badge bg-danger ms-2"
                                                    style="font-size: 0.65rem;">RETIRADO</span>
                                            </div>

                                            <div class="small text-muted" v-if="!filterGrupo">
                                                {{ p.grupo_nombre || 'Sin Grupo' }}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                <td v-for="r in reuniones" :key="r.id"
                                    @click="p.estado !== 'retirado' ? openPopover($event, p.id, r.id) : null"
                                    class="cell-interactive p-1"
                                    :class="{ 'cursor-not-allowed': p.estado === 'retirado' }">
                                    <div class="cell-content d-flex align-items-center justify-content-center rounded position-relative"
                                        :class="{
                                            'bg-success-subtle text-success': attendanceMap[p.id]?.[r.id]?.estado === 'asistio',
                                            'bg-warning-subtle text-warning': attendanceMap[p.id]?.[r.id]?.estado === 'tardanza',
                                            'bg-info-subtle text-info': attendanceMap[p.id]?.[r.id]?.estado === 'falta justificada',
                                            'bg-danger-subtle text-danger': attendanceMap[p.id]?.[r.id]?.estado === 'falta injustificada',
                                            'bg-secondary-subtle text-muted': p.estado === 'retirado' && !attendanceMap[p.id]?.[r.id]?.estado,
                                            'cell-empty': !attendanceMap[p.id]?.[r.id]?.estado && p.estado !== 'retirado'
                                        }" style="height: 40px; width: 100%;">

                                        <i v-if="attendanceMap[p.id]?.[r.id]?.estado === 'asistio'"
                                            class="bi bi-check-lg fs-5"></i>
                                        <i v-else-if="attendanceMap[p.id]?.[r.id]?.estado === 'tardanza'"
                                            class="bi bi-clock fs-5"></i>
                                        <i v-else-if="attendanceMap[p.id]?.[r.id]?.estado === 'falta justificada'"
                                            class="bi bi-file-medical fs-5"></i>
                                        <i v-else-if="attendanceMap[p.id]?.[r.id]?.estado === 'falta injustificada'"
                                            class="bi bi-x-lg fs-5"></i>

                                        <span v-else-if="p.estado === 'retirado'" class="opacity-50">-</span>
                                        <span v-else class="opacity-25">&bull;</span>

                                        <div v-if="attendanceMap[p.id]?.[r.id]?.nota"
                                            class="position-absolute top-0 end-0 m-1 p-1 bg-primary rounded-circle border border-white"
                                            style="width: 8px; height: 8px;"></div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div v-if="popover.visible" class="popover-backdrop" @click="closePopover"></div>

        <transition name="popover-anim">
            <div v-if="popover.visible" class="mini-dialog shadow-lg rounded-4 bg-white p-4">

                <div class="text-center mb-3">
                    <h6 class="fw-bold text-dark mb-0">
                        {{ getNameOfPerson(popover.personaId) }}
                    </h6>
                    <small v-if="tipoActual === 'Apoderados'" class="text-primary d-block font-monospace"
                        style="font-size: 0.75rem;">
                        REUNIÓN DE APODERADOS
                    </small>
                    <small class="text-muted">{{ getDateOfReunion(popover.reunionId) }}</small>
                </div>

                <div v-if="!canEditAttendance(popover.personaId, popover.reunionId)"
                    class="alert alert-light border border-secondary-subtle text-center p-3 mb-3">
                    <div class="mb-2">
                        <i class="bi bi-lock-fill text-muted fs-2"></i>
                    </div>
                    <h6 class="fw-bold text-secondary mb-1">Registro Cerrado</h6>
                    <p class="small text-muted mb-0 lh-sm">
                        La asistencia ya fue registrada.<br>
                        Solo el coordinador puede editarla.
                    </p>
                    <div class="mt-2">
                        <span class="badge rounded-pill border px-3 py-2" :class="{
                            'bg-success-subtle text-success border-success': popover.estado === 'asistio',
                            'bg-warning-subtle text-warning border-warning': popover.estado === 'tardanza',
                            'bg-info-subtle text-info border-info': popover.estado === 'falta justificada',
                            'bg-danger-subtle text-danger border-danger': popover.estado === 'falta injustificada'
                        }">
                        </span>
                    </div>
                </div>

                <div v-else>

                    <div v-if="tipoActual !== 'Apoderados'" class="status-grid mb-3">
                        <button class="btn-status btn-status-success" :class="{ active: popover.estado === 'asistio' }"
                            @click="setStatus('asistio')">
                            <i class="bi bi-check-circle-fill icon-lg"></i>
                            <span>Asistió</span>
                        </button>

                        <button class="btn-status btn-status-warning" :class="{ active: popover.estado === 'tardanza' }"
                            @click="setStatus('tardanza')">
                            <i class="bi bi-clock-fill icon-lg"></i>
                            <span>Tardanza</span>
                        </button>

                        <button class="btn-status btn-status-info"
                            :class="{ active: popover.estado === 'falta justificada' }"
                            @click="setStatus('falta justificada')">
                            <i class="bi bi-file-medical-fill icon-lg"></i>
                            <span>Justificada</span>
                        </button>

                        <button class="btn-status btn-status-danger"
                            :class="{ active: popover.estado === 'falta injustificada' }"
                            @click="setStatus('falta injustificada')">
                            <i class="bi bi-x-circle-fill icon-lg"></i>
                            <span>Injustificada</span>
                        </button>
                    </div>

                    <div v-else class="mb-3">
                        <p class="small text-muted mb-2">Registro de asistencia por familiar:</p>

                        <div class="list-group">
                            <div v-for="apo in getApoderadosDeHijo(popover.personaId)" :key="apo.id"
                                class="list-group-item px-2 py-3">

                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="fw-medium text-dark small">{{ apo.nombres }} {{ apo.apellidos }}</span>
                                    <span class="badge bg-light text-secondary border">
                                        {{ apo.pivot?.tipo || 'Apoderado' }}
                                    </span>
                                </div>

                                <div class="d-flex gap-1 justify-content-center">
                                    <button type="button" class="btn btn-sm flex-grow-1"
                                        :class="checkStatusApoderado(apo, popover.reunionId) === 'asistio' ? 'btn-success' : 'btn-outline-success'"
                                        @click="setApoderadoStatus(apo, popover.reunionId, 'asistio')" title="Asistió">
                                        <i class="bi bi-check-lg"></i>
                                    </button>

                                    <button type="button" class="btn btn-sm flex-grow-1"
                                        :class="checkStatusApoderado(apo, popover.reunionId) === 'tardanza' ? 'btn-warning' : 'btn-outline-warning'"
                                        @click="setApoderadoStatus(apo, popover.reunionId, 'tardanza')"
                                        title="Tardanza">
                                        <i class="bi bi-clock"></i>
                                    </button>

                                    <button type="button" class="btn btn-sm flex-grow-1"
                                        :class="checkStatusApoderado(apo, popover.reunionId) === 'falta justificada' ? 'btn-info text-white' : 'btn-outline-info'"
                                        @click="setApoderadoStatus(apo, popover.reunionId, 'falta justificada')"
                                        title="Justificada">
                                        <i class="bi bi-file-medical"></i>
                                    </button>

                                    <button type="button" class="btn btn-sm flex-grow-1"
                                        :class="checkStatusApoderado(apo, popover.reunionId) === 'falta injustificada' ? 'btn-danger' : 'btn-outline-danger'"
                                        @click="setApoderadoStatus(apo, popover.reunionId, 'falta injustificada')"
                                        title="Falta">
                                        <i class="bi bi-x-lg"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div v-if="getApoderadosDeHijo(popover.personaId).length === 0"
                            class="alert alert-warning x-small mb-0 mt-2">
                            <i class="bi bi-exclamation-triangle me-1"></i> No tiene apoderados registrados.
                        </div>
                    </div>

                </div>
                <div class="input-group">
                    <span class="input-group-text bg-light border-end-0"><i class="bi bi-chat-text"></i></span>
                    <input id="popoverInput" v-model="popover.nota" class="form-control border-start-0"
                        placeholder="Nota..." autocomplete="off" @keydown.enter="closePopover"
                        :readonly="!canEditAttendance(popover.personaId, popover.reunionId)">
                </div>

                <div class="mt-3 text-center">
                    <button class="btn btn-light btn-sm rounded-pill px-4 text-muted"
                        @click="closePopover">Cerrar</button>
                </div>
            </div>
        </transition>

    </div>
</template>

<style scoped>

.cursor-not-allowed {
    cursor: not-allowed !important;
}

/* Evita que las celdas de retirados resalten al pasar el mouse si ya tienes un hover */
tr.opacity-75:hover td {
    background-color: transparent !important;
}

/* --- ESTÉTICA GENERAL --- */
.custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background-color: #f1f5f9;
}

/* --- COLUMNA FIJA CON SOMBRA --- */
.sticky-col {
    position: sticky;
    left: 0;
    z-index: 2;
    border-right: 1px solid #e2e8f0 !important;
}

.shadow-sm-right {
    box-shadow: 4px 0 10px -5px rgba(0, 0, 0, 0.05);
}

/* --- CELDAS --- */
.matrix-table th,
.matrix-table td {
    border-color: #f1f5f9 !important;
}

.cell-interactive {
    cursor: pointer;
    user-select: none;
}

.cell-interactive:hover .cell-content {
    transform: scale(0.95);
    background-color: #f8fafc;
}

.cell-empty {
    background-color: transparent;
}

.cell-content {
    transition: all 0.15s ease-in-out;
}

/* Colores de fondo suaves para la tabla (Subtle) */
.bg-success-subtle {
    background-color: #d1e7dd !important;
}

.bg-warning-subtle {
    background-color: #fff3cd !important;
}

.bg-info-subtle {
    background-color: #cff4fc !important;
}

.bg-danger-subtle {
    background-color: #f8d7da !important;
}

/* --- POPOVER --- */
.popover-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.2);
    /* Oscurece un poco el fondo */
    backdrop-filter: blur(2px);
    /* Efecto borroso moderno */
    z-index: 1040;
}

.mini-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    /* Centrado perfecto */
    z-index: 1050;
    width: 320px;
    /* Un poco más ancho */
    max-width: 90%;
    border: 1px solid rgba(0, 0, 0, 0.05);
}

.popover-menu {
    position: absolute;
    z-index: 1050;
    width: 280px;
    /* Un poco más ancho para el grid */
}

.popover-arrow {
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 12px;
    height: 12px;
    background: white;
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    border-left: 1px solid rgba(0, 0, 0, 0.05);
}

/* Animación Popover */
.popover-anim-enter-active {
    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.popover-anim-leave-active {
    transition: all 0.15s ease;
}

.popover-anim-enter-from {
    opacity: 0;
    transform: translate(-50%, -40%) scale(0.9);
}

.popover-anim-leave-to {
    opacity: 0;
    transform: translate(-50%, -40%) scale(0.9);
}


/* --- BOTONES DE ESTADO (GRID 2x2) --- */
.status-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
}

/* Estilo Base del Botón */
.btn-status {
    display: flex;
    flex-direction: column;
    /* Icono arriba, texto abajo */
    align-items: center;
    justify-content: center;
    padding: 0.75rem 0.5rem;
    border: 1px solid transparent;
    border-radius: 8px;
    background-color: #f8f9fa;
    color: #6c757d;
    transition: all 0.2s ease;
    font-size: 0.8rem;
    font-weight: 600;
    height: auto;
    /* Importante: deja que el contenido defina la altura */
}

.icon-lg {
    font-size: 1.4rem;
    margin-bottom: 0.25rem;
    transition: transform 0.2s;
}

.btn-status:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

/* Variantes de Color (Sólido al activar) */
.btn-status-success:hover {
    background-color: #d1e7dd;
    color: #198754;
}

.btn-status-success.active {
    background-color: #198754;
    color: white;
    box-shadow: 0 4px 10px rgba(25, 135, 84, 0.3);
}

.btn-status-warning:hover {
    background-color: #fff3cd;
    color: #ffc107;
}

.btn-status-warning.active {
    background-color: #ffc107;
    color: #000;
    box-shadow: 0 4px 10px rgba(255, 193, 7, 0.3);
}

.btn-status-info:hover {
    background-color: #cff4fc;
    color: #0dcaf0;
}

.btn-status-info.active {
    background-color: #0dcaf0;
    color: #000;
    box-shadow: 0 4px 10px rgba(13, 202, 240, 0.3);
}

.btn-status-danger:hover {
    background-color: #f8d7da;
    color: #dc3545;
}

.btn-status-danger.active {
    background-color: #dc3545;
    color: white;
    box-shadow: 0 4px 10px rgba(220, 53, 69, 0.3);
}

/* Animación icono al activar */
.btn-status.active .icon-lg {
    transform: scale(1.1);
}

.border-start {
    border-left-width: 4px !important;
}

/* Colores de fondo para los iconos circulares */
.bg-success-subtle {
    background-color: #d1e7dd !important;
}

.bg-warning-subtle {
    background-color: #fff3cd !important;
}

.bg-danger-subtle {
    background-color: #f8d7da !important;
}

.bg-primary-subtle {
    background-color: #cfe2ff !important;
}

.text-xs {
    font-size: 0.75rem;
}
</style>