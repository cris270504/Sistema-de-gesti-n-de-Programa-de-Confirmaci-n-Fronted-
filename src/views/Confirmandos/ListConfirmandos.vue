<script setup>
import { useConfirmandosStore } from '../../stores/confirmandos';
import { useGruposStore } from '../../stores/grupos'; // <--- 1. IMPORTAMOS EL STORE DE GRUPOS
import { storeToRefs } from 'pinia';
import { onMounted, ref, computed, nextTick } from 'vue';
import {
    Pencil, Trash, Plus, User, Phone, Calendar, Users,
    Wand2, Trash2, Save, Upload, Eye
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { Modal } from 'bootstrap';
import ConfirmandoModal from '../../components/Modals/confirmandoModal.vue';
import { showAlerta } from '@/funciones';
import PerfilConfirmandoModal from '../../components/Modals/PerfilConfirmandoModal.vue';

const perfilModalRef = ref(null);

// --- STORES ---
const confirmandosStore = useConfirmandosStore();
const gruposStore = useGruposStore(); // <--- 2. INSTANCIAMOS EL STORE
const authStore = useAuthStore();

const { items: confirmandos, loading, error } = storeToRefs(confirmandosStore);
const { fetchAll: fetchAllConfirmandos, remove: removeConfirmando } = confirmandosStore;

// --- ESTADOS LOCALES ---
const confirmandoSearchQuery = ref('');
const modalRef = ref(null); // Ref para el modal de Crear/Editar


// --- LÓGICA DE IMPORTACIÓN EXCEL ---
const fileInputRef = ref(null);
const isImporting = ref(false);


const importModalInstance = ref(null);

const initImportModal = () => {
    const el = document.getElementById('importFormatModal');
    if (el) importModalInstance.value = new Modal(el);
};

const abrirImportModal = () => {
    importModalInstance.value?.show();
};

const triggerImport = () => {
    fileInputRef.value.click();
};

const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedExtensions = ['xls', 'xlsx', 'csv'];
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
        showAlerta('Por favor, sube un archivo Excel (.xls, .xlsx) o CSV', 'warning');
        event.target.value = '';
        return;
    }

    // 2. OCULTAMOS EL MODAL INFORMATIVO ANTES DE EMPEZAR A CARGAR
    importModalInstance.value?.hide();

    const formData = new FormData();
    formData.append('archivo', file);

    isImporting.value = true;
    try {
        const response = await confirmandosStore.importarExcel(formData);
        showAlerta(response.message || 'Importación completada con éxito', 'success');
        recargarTabla();
    } catch (error) {
        let errorMsg = 'Error al importar el archivo.';
        if (error.response?.data?.errors) {
            const errores = Object.values(error.response.data.errors).flat();
            errorMsg = errores.join('\n');
        } else if (error.response?.data?.message) {
            errorMsg = error.response.data.message;
        }
        showAlerta(errorMsg, 'error');
    } finally {
        isImporting.value = false;
        event.target.value = '';
    }
};


// --- LÓGICA DE APODERADOS ---
const apoderadosModalInstance = ref(null);
const selectedApoderados = ref([]);
const selectedConfirmandoName = ref('');

// =======================================================================
// --- LÓGICA GENERADOR DE GRUPOS (Integrada con Store) ---
// =======================================================================
const generadorModalInstance = ref(null);
const loadingGenerador = ref(false);
const groupNames = ref(['']);
const stats = ref({ hombres: 0, mujeres: 0, total: 0 });
const periodoActual = '2026';

const initGeneradorModal = () => {
    const el = document.getElementById('generadorGruposModal');
    if (el) generadorModalInstance.value = new Modal(el);
};

const abrirGenerador = async () => {
    if (gruposStore.items.length === 0) {
        await gruposStore.fetchAll();
    }

    if (gruposStore.items.length > 0) {
        // Mapeamos solo los nombres
        groupNames.value = gruposStore.items.map(g => g.nombre);
    } else {
        // Si no existen grupos, dejamos uno por defecto para empezar
        groupNames.value = ['Grupo Nuevo 1'];
    }
    // Calculamos estadísticas visuales (solo frontend)
    const sinGrupo = confirmandos.value.filter(c => !c.grupo_id);
    stats.value = {
        total: sinGrupo.length,
        hombres: sinGrupo.filter(c => c.genero === 'm' || c.genero === 'M').length,
        mujeres: sinGrupo.filter(c => c.genero === 'f' || c.genero === 'F').length
    };

    generadorModalInstance.value?.show();
};

const addGroupInput = () => {
    groupNames.value.push(`Grupo Nuevo ${groupNames.value.length + 1}`);
};

const removeGroupInput = (index) => {
    if (groupNames.value.length > 1) {
        groupNames.value.splice(index, 1);
    }
};

const generarGruposApi = async () => {
    // Validaciones básicas
    if (groupNames.value.some(n => n.trim() === '')) {
        return showAlerta('Todos los grupos deben tener nombre', 'warning');
    }
    if (stats.value.total === 0) {
        return showAlerta('No hay confirmandos sin grupo para asignar.', 'warning');
    }

    loadingGenerador.value = true;
    try {
        // --- 3. LLAMADA AL STORE ---
        // El store se encarga de llamar a la API y manejar errores de validación
        const response = await gruposStore.generateGroups({
            nombres_grupos: groupNames.value,
            periodo: periodoActual
        });

        // Éxito
        showAlerta(response.message, 'success');
        generadorModalInstance.value?.hide();

        // Recargamos la tabla para ver los cambios
        await fetchAllConfirmandos();

    } catch (error) {
        console.error("Error en la vista:", error);
        // Nota: El store ya mostró la alerta de error, aquí solo capturamos para limpiar loading
    } finally {
        loadingGenerador.value = false;
    }
};

// Predicción visual
const prediccion = computed(() => {
    const numGrupos = groupNames.value.length;
    if (numGrupos === 0 || stats.value.total === 0) return null;
    return {
        hombres: Math.floor(stats.value.hombres / numGrupos),
        mujeres: Math.floor(stats.value.mujeres / numGrupos),
        total: Math.floor(stats.value.total / numGrupos)
    };
});
// =======================================================================

const formatGenero = (genero) => {
    if (!genero) return '---';

    const g = genero.toLowerCase();
    if (g === 'm') return 'MASCULINO';
    if (g === 'f') return 'FEMENINO';

    return 'SIN GÉNERO ASIGNADO'; // Por si hay algún otro valor raro
};

// --- CICLO DE VIDA ---
onMounted(() => {
    fetchAllConfirmandos();

    nextTick(() => {
        const elApo = document.getElementById('apoderadosModal');
        if (elApo) apoderadosModalInstance.value = new Modal(elApo);

        initGeneradorModal();

        // 3. INICIALIZAMOS EL NUEVO MODAL AQUÍ
        initImportModal();
    });
});

// --- FUNCIONES AUXILIARES ---
const abrirCrear = () => modalRef.value.open();
const abrirEditar = (id) => modalRef.value.open(id);
const recargarTabla = () => fetchAllConfirmandos();
const estadoFiltro = ref('en_preparacion');

const filteredConfirmandos = computed(() => {
    let lista = confirmandos.value;

    // 1. FILTRO POR ESTADO (A menos que seleccione "todos")
    if (estadoFiltro.value !== 'todos') {
        lista = lista.filter(c => c.estado === estadoFiltro.value);
    }

    // 2. FILTRO POR BÚSQUEDA DE TEXTO (El que ya tenías)
    const query = confirmandoSearchQuery.value.trim().toLowerCase();
    if (query) {
        lista = lista.filter(c => {
            const fullName = `${c.nombres} ${c.apellidos}`.toLowerCase();
            return fullName.includes(query);
        });
    }

    return lista;
});

const getBadgeEstado = (estado) => {
    const badges = {
        'en_preparacion': { text: 'En Preparación', class: 'bg-primary-subtle text-primary border-primary-subtle' },
        'confirmado': { text: 'Confirmado', class: 'bg-success-subtle text-success border-success-subtle' },
        'retirado': { text: 'Retirado', class: 'bg-danger-subtle text-danger border-danger-subtle' }
    };
    return badges[estado] || badges['en_preparacion'];
};

const formatFecha = (fechaString) => {
    if (!fechaString) return '---';
    const [year, month, day] = fechaString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
}

const getSacramentoFaltante = (confirmando) => {
    if (!confirmando.sacramentos?.length) return 'Sin datos';
    const pendiente = confirmando.sacramentos.find(s => s.pivot.estado === 'pendiente');
    return pendiente ? pendiente.nombre : 'Completado';
};

const openApoderadosModal = (confirmando) => {
    selectedConfirmandoName.value = `${confirmando.nombres} ${confirmando.apellidos}`;
    selectedApoderados.value = confirmando.apoderados || [];
    apoderadosModalInstance.value?.show();
};
</script>

<template>
    <div class="main-container">

        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="page-title">Confirmandos</h2>
                <p class="page-subtitle">Gestión de inscritos y sacramentos</p>
            </div>

            <div class="d-flex gap-2">
                <input type="file" ref="fileInputRef" class="d-none" accept=".xlsx, .xls, .csv"
                    @change="handleFileUpload">

                <button v-if="authStore.can('crear confirmandos')" @click="abrirImportModal" :disabled="isImporting"
                    class="btn btn-outline-success shadow-sm px-3 py-2 d-flex align-items-center">
                    <span v-if="isImporting" class="spinner-border spinner-border-sm me-2"></span>
                    <Upload v-else :size="18" class="me-2" />
                    <span class="fw-bold fs-7 text-uppercase">{{ isImporting ? 'Importando...' : 'Importar Excel'
                    }}</span>
                </button>

                <button v-if="authStore.can('crear grupos')" @click="abrirGenerador"
                    class="btn btn-outline-primary shadow-sm px-3 py-2 d-flex align-items-center">
                    <Wand2 :size="18" class="me-2" />
                    <span class="fw-bold fs-7 text-uppercase">Generar Grupos</span>
                </button>

                <div v-if="authStore.can('crear confirmandos')">
                    <button @click="abrirCrear" class="btn btn-primary shadow-sm px-3 py-2 d-flex align-items-center">
                        <Plus :size="18" class="me-2" stroke-width="2.5" />
                        <span class="fw-bold fs-7 text-uppercase">Nuevo Confirmando</span>
                    </button>
                </div>
            </div>
        </div>

        <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-secondary" role="status"></div>
        </div>
        <div v-else-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

        <div v-else class="card border-0 shadow-sm rounded-3 overflow-hidden">
            <div
                class="p-3 bg-light-gray border-bottom d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">

                <div class="input-group" style="max-width: 450px;">
                    <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                    <input type="text" class="form-control border-start-0 ps-0" v-model="confirmandoSearchQuery"
                        placeholder="Buscar por apellido o nombre..." :disabled="loading">
                </div>

                <div class="btn-group shadow-sm" role="group">
                    <input type="radio" class="btn-check" name="btnradio" id="btnradio1" value="en_preparacion"
                        v-model="estadoFiltro">
                    <label class="btn btn-outline-primary fw-medium" for="btnradio1">En Preparación</label>

                    <input type="radio" class="btn-check" name="btnradio" id="btnradio2" value="confirmado"
                        v-model="estadoFiltro">
                    <label class="btn btn-outline-success fw-medium" for="btnradio2">Confirmados</label>

                    <input type="radio" class="btn-check" name="btnradio" id="btnradio3" value="retirado"
                        v-model="estadoFiltro">
                    <label class="btn btn-outline-danger fw-medium" for="btnradio3">Retirados</label>

                    <input type="radio" class="btn-check" name="btnradio" id="btnradio4" value="todos"
                        v-model="estadoFiltro">
                    <label class="btn btn-outline-secondary fw-medium" for="btnradio4">Todos</label>
                </div>
            </div>


            <div class="table-responsive">
                <table class="table align-middle mb-0">
                    <thead class="bg-light-gray">
                        <tr>
                            <th class="ps-4 py-2 text-secondary text-uppercase fw-bold">#</th>
                            <th class="ps-4 py-2 text-secondary text-uppercase fw-bold">Confirmando</th>
                            <th class="ps-4 py-2 text-secondary text-uppercase fw-bold">Genero</th>
                            <th class="py-2 text-secondary text-uppercase fw-bold">Contacto</th>
                            <th class="py-2 text-center text-secondary text-uppercase fw-bold">Estado</th>
                            <th class="py-2 text-secondary text-uppercase fw-bold">Grupo</th>
                            <th class="py-2 text-secondary text-uppercase fw-bold">Sacramento</th>
                            <th class="text-end pe-4 py-2 text-secondary text-uppercase fw-bold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="!filteredConfirmandos || filteredConfirmandos.length === 0">
                            <td colspan="5" class="text-center py-5 text-muted fs-5">
                                {{ confirmandoSearchQuery ? 'No hay coincidencias.' : 'No hay confirmandos registrados.'
                                }}
                            </td>
                        </tr>

                        <tr v-for="(c, index) in filteredConfirmandos" :key="c.id" class="hover-row">
                            <td class="py-2 text-center text-muted fw-medium">{{ index + 1 }}</td>
                            <td class="py-2">
                                <div class="d-flex align-items-center">
                                    <div>
                                        <div class="fw-bold text-dark fs-6 lh-sm">{{ c.apellidos }}, {{ c.nombres }}
                                        </div>
                                        <div class="text-muted mt-1 small d-flex align-items-center">
                                            <Calendar :size="12" class="me-1" /> {{ formatFecha(c.fecha_nacimiento) }}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td class="py-2">
                                <div class="d-flex align-items-center text-secondary small-text">
                                    <span>{{ formatGenero(c.genero) }}</span>
                                </div>
                            </td>
                            <td class="py-2">
                                <div class="d-flex align-items-center text-secondary small-text">
                                    <Phone :size="14" class="me-2 opacity-75" />
                                    <span>{{ c.celular || '---' }}</span>
                                </div>
                            </td>
                            <td class="py-2 text-center">
                                <span class="badge border" :class="getBadgeEstado(c.estado).class">
                                    {{ getBadgeEstado(c.estado).text }}
                                </span>
                            </td>
                            <td class="py-2">
                                <router-link v-if="c.grupo && authStore.can('ver todos los grupos')"
                                    :to="{ name: 'miGrupo', params: { id: c.grupo.id } }"
                                    class="badge-soft-group btn-badge-interactive text-decoration-none"
                                    :style="{ borderColor: c.grupo.color }">
                                    <span class="dot-indicator"
                                        :style="{ backgroundColor: c.grupo.color || '#cbd5e1' }"></span>
                                    <span class="text-dark-subtle me-1">{{ c.grupo.nombre }}</span>
                                    <i class="bi bi-arrow-right-short text-muted"></i>
                                </router-link>

                                <span v-else-if="c.grupo" class="badge-soft-group"
                                    :style="{ borderColor: c.grupo.color, color: '#334155', cursor: 'default' }">
                                    <span class="dot-indicator"
                                        :style="{ backgroundColor: c.grupo.color || '#cbd5e1' }"></span>
                                    {{ c.grupo.nombre }}
                                </span>
                                <span v-else class="text-muted fst-italic small px-2">Sin grupo</span>
                            </td>
                            <td class="py-2">
                                <span class="badge-soft-blue">{{ getSacramentoFaltante(c) }}</span>
                            </td>
                            <td class="text-end pe-4 py-2">
                                <div class="d-inline-flex gap-2">
                                    <button @click="perfilModalRef.abrir(c.id)""
                                        class=" btn btn-sm btn-soft-suggest rounded-circle d-flex align-items-center
                                        justify-content-center me-1" style="width: 32px; height: 32px;"
                                        title="Ver Ficha Completa">
                                        <Eye :size="16" />
                                    </button>
                                    <button class="btn btn-action btn-soft-info" title="Ver Apoderados"
                                        @click="openApoderadosModal(c)">
                                        <Users :size="18" />
                                    </button>
                                    <button class="btn btn-action btn-soft-warning" title="Editar"
                                        @click="abrirEditar(c.id)">
                                        <Pencil :size="18" />
                                    </button>
                                    <button v-if="authStore.can('eliminar confirmandos')"
                                        class="btn btn-action btn-soft-danger" title="Eliminar"
                                        @click="removeConfirmando(c.id, c.apellidos + ' ' + c.nombres)">
                                        <Trash :size="18" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="modal fade" id="apoderadosModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                    <div class="modal-header-blue p-4">
                        <h5 class="modal-title fw-bold text-white mb-0">
                            <i class="bi bi-people-fill me-2 text-white-50"></i> Apoderados
                        </h5>
                        <p class="text-white-50 small mb-0 mt-1">Familiares de {{ selectedConfirmandoName }}</p>
                        <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-3"
                            data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4 bg-light-gray-body">
                        <div v-if="selectedApoderados.length === 0" class="text-center text-muted py-4">
                            <div class="mb-2">
                                <Users :size="48" class="opacity-25" />
                            </div>
                            <p class="mb-0 small">No hay apoderados registrados.</p>
                        </div>
                        <div v-else class="d-flex flex-column gap-3">
                            <div v-for="ap in selectedApoderados" :key="ap.id" class="card border-0 shadow-sm">
                                <div class="card-body p-3 d-flex justify-content-between align-items-center">
                                    <div>
                                        <div class="fw-bold text-dark">{{ ap.apellidos }} {{ ap.nombres }}</div>
                                        <div class="small text-muted d-flex align-items-center mt-1">
                                            <Phone :size="12" class="me-1" /> {{ ap.celular || 'Sin celular' }}
                                        </div>
                                    </div>
                                    <span class="badge bg-blue-subtle text-primary border border-blue-200">
                                        {{ ap.pivot?.tipo_apoderado_id === 1 ? 'Padre' : (ap.pivot?.tipo_apoderado_id
                                            === 2 ? 'Madre' : 'Tutor') }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer bg-white border-top-0 p-3">
                        <button type="button" class="btn btn-light w-100 fw-medium text-secondary"
                            data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal fade" id="generadorGruposModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg rounded-4">
                    <div class="modal-header bg-white border-bottom-0 pt-4 px-4">
                        <div>
                            <h5 class="fw-bold text-dark mb-1">Generador Automático de Grupos</h5>
                            <p class="text-muted small mb-0">Distribución equitativa por género y edad.</p>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>

                    <div class="modal-body px-4 py-2">
                        <div class="alert alert-light border d-flex justify-content-around mb-4 bg-light-gray-body">
                            <div class="text-center">
                                <h4 class="fw-bold text-primary mb-0">{{ stats.total }}</h4>
                                <small class="text-muted" style="font-size: 0.75rem;">Sin Grupo</small>
                            </div>
                            <div class="vr opacity-25"></div>
                            <div class="text-center">
                                <h5 class="fw-bold text-dark mb-0">{{ stats.hombres }}</h5>
                                <small class="text-muted" style="font-size: 0.75rem;">Hombres</small>
                            </div>
                            <div class="text-center">
                                <h5 class="fw-bold text-dark mb-0">{{ stats.mujeres }}</h5>
                                <small class="text-muted" style="font-size: 0.75rem;">Mujeres</small>
                            </div>
                        </div>

                        <label class="form-label fw-bold small text-uppercase text-secondary mb-2">Nombres de los
                            Grupos</label>
                        <div class="d-flex flex-column gap-2 mb-3" style="max-height: 200px; overflow-y: auto;">
                            <div v-for="(name, index) in groupNames" :key="index" class="d-flex gap-2">
                                <div class="input-group">
                                    <span class="input-group-text bg-white text-muted border-end-0">{{ index + 1
                                    }}</span>
                                    <input type="text" class="form-control border-start-0" v-model="groupNames[index]"
                                        placeholder="Nombre del grupo">
                                </div>
                                <button @click="removeGroupInput(index)" class="btn btn-outline-danger border-0"
                                    :disabled="groupNames.length === 1" title="Eliminar">
                                    <Trash2 :size="18" />
                                </button>
                            </div>
                        </div>

                        <button @click="addGroupInput"
                            class="btn btn-sm btn-light text-primary border w-100 mb-3 dashed-border">
                            <Plus :size="16" class="me-1" /> Agregar otro grupo
                        </button>

                        <div v-if="prediccion" class="bg-blue-subtle p-3 rounded-3 mb-2">
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <Users :size="16" class="text-primary" />
                                <span class="fw-bold text-primary small">Predicción por Grupo:</span>
                            </div>
                            <p class="mb-0 small text-dark lh-sm">
                                ~{{ prediccion.total }} confirmandos por grupo
                                <span class="text-muted">({{ prediccion.hombres }}H / {{ prediccion.mujeres }}M)</span>.
                            </p>
                        </div>
                    </div>

                    <div class="modal-footer border-top-0 px-4 pb-4">
                        <button type="button" class="btn btn-light text-secondary fw-medium"
                            data-bs-dismiss="modal">Cancelar</button>
                        <button @click="generarGruposApi" :disabled="loadingGenerador" class="btn btn-primary px-4">
                            <span v-if="loadingGenerador" class="spinner-border spinner-border-sm me-2"></span>
                            <Save v-else :size="18" class="me-2" />
                            Generar y Asignar
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <ConfirmandoModal ref="modalRef" @saved="recargarTabla" />

        <div class="modal fade" id="importFormatModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg rounded-4">
                    <div class="modal-header bg-success-subtle border-bottom-0 pt-4 px-4">
                        <div class="d-flex align-items-center">
                            <div
                                class="bg-success text-white rounded-circle p-2 me-3 d-flex align-items-center justify-content-center">
                                <Upload :size="24" />
                            </div>
                            <div>
                                <h5 class="fw-bold text-dark mb-1">Importar Confirmandos</h5>
                                <p class="text-muted small mb-0">Revisa el formato antes de subir tu Excel</p>
                            </div>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>

                    <div class="modal-body px-4 py-4">
                        <div class="alert alert-info border-0 bg-light-info small mb-4">
                            <i class="bi bi-info-circle-fill me-2 text-info"></i>
                            <strong>Regla importante:</strong> El sistema asume que las dos primeras palabras son los
                            apellidos.
                        </div>

                        <h6 class="fw-bold text-secondary text-uppercase fs-7 mb-3">Estructura Obligatoria (Fila 1 =
                            Títulos)</h6>

                        <div class="table-responsive border rounded-3 mb-3">
                            <table class="table table-sm table-bordered mb-0 text-center align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th class="text-success">Columna A</th>
                                        <th class="text-success">Columna B</th>
                                    </tr>
                                    <tr>
                                        <th>NOMBRES</th>
                                        <th>CELULAR <span class="text-muted fw-normal">(Opcional)</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td class="text-start px-3">Quispe Ramos Luis Alberto</td>
                                        <td>987654321</td>
                                    </tr>
                                    <tr>
                                        <td class="text-start px-3">Gonzales Maria Jose</td>
                                        <td class="text-muted fst-italic">En blanco</td>
                                    </tr>
                                    <tr>
                                        <td class="text-start px-3">Perez Juan</td>
                                        <td class="text-danger"><del>123</del> (Dará error)</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <ul class="text-muted small ps-3 mb-0">
                            <li class="mb-1">Si el celular no tiene <strong>9 dígitos numéricos</strong>, se ignorará y
                                se guardará sin celular.</li>
                            <li>No dejes nombres en blanco. Esas filas serán omitidas.</li>
                        </ul>
                    </div>

                    <div class="modal-footer border-top-0 px-4 pb-4 d-flex justify-content-between">
                        <button type="button" class="btn btn-light text-secondary fw-medium"
                            data-bs-dismiss="modal">Cancelar</button>

                        <button @click="triggerImport" class="btn btn-success px-4 d-flex align-items-center">
                            <Upload :size="18" class="me-2" />
                            Seleccionar Archivo y Subir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <PerfilConfirmandoModal ref="perfilModalRef" />
</template>

<style scoped>
/* ESTILOS GLOBALES */
.page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 0;
    letter-spacing: -0.5px;
}

.page-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
}

.icon-box {
    width: 36px;
    height: 36px;
    background-color: #f3f4f6;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e7eb;
}

.bg-light-gray {
    background-color: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
}

.bg-light-gray th {
    font-size: 0.75rem;
    letter-spacing: 0.5px;
}

.hover-row:hover td {
    background-color: #f9fafb;
}

.hover-row td {
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    font-size: 0.95rem;
}

/* BADGES */
.badge-soft-group {
    background-color: #ffffff;
    border: 1px solid;
    padding: 0.25em 0.65em;
    font-size: 0.8rem;
    font-weight: 600;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.dot-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
}

.badge-soft-blue {
    background-color: #eff6ff;
    color: #2563eb;
    border: 1px solid #bfdbfe;
    padding: 0.25em 0.65em;
    font-size: 0.8rem;
    font-weight: 600;
    border-radius: 6px;
}

/* BOTONES */
.btn-action {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    transition: all 0.2s;
}

.btn-soft-info {
    background-color: #ecfeff;
    color: #06b6d4;
}

.btn-soft-info:hover {
    background-color: #06b6d4;
    color: white;
    transform: translateY(-2px);
}

.btn-soft-warning {
    background-color: #fffbeb;
    color: #d97706;
}

.btn-soft-warning:hover {
    background-color: #d97706;
    color: white;
    transform: translateY(-2px);
}

.btn-soft-danger {
    background-color: #fef2f2;
    color: #ef4444;
}

.btn-soft-danger:hover {
    background-color: #ef4444;
    color: white;
    transform: translateY(-2px);
}

.btn-primary {
    background-color: #2563eb;
    border-color: #2563eb;
    font-size: 0.9rem;
}

.btn-primary:hover {
    background-color: #1d4ed8;
}

/* MODALS */
.modal-header-blue {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    position: relative;
}

.bg-light-gray-body {
    background-color: #f8fafc;
}

.bg-blue-subtle {
    background-color: #e0e7ff;
}

.border-blue-200 {
    border-color: #c7d2fe !important;
}

.dashed-border {
    border-style: dashed !important;
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

/* Caja central flotante */
.mini-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1050;
    border: none;
}

/* Animaciones de aparición */
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
</style>