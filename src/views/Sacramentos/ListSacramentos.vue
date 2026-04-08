<script setup>
import { onMounted, ref, nextTick, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useSacramentosStore } from '../../stores/sacramentos';
import { useRequisitosStore } from '../../stores/requisitos';
import { Modal } from 'bootstrap';
import { Pencil, Trash, Plus, Check, FileCheck, FolderOpen } from 'lucide-vue-next';
import { showAlerta } from '@/funciones';

// --- Stores ---
const sacramentosStore = useSacramentosStore();
const requisitosStore = useRequisitosStore();

const { items: sacramentos, loading, error } = storeToRefs(sacramentosStore);
const { items: availableRequisitos } = storeToRefs(requisitosStore);
const { fetchAll, remove, add, save } = sacramentosStore;

// --- Estado del Modal ---
const modalInstance = ref(null);
const draft = ref({ id: null, nombre: '', requisitos: [] }); 
const saving = ref(false);
const isEditing = computed(() => !!draft.value.id);
const modalTitle = computed(() => isEditing.value ? 'Editar Sacramento' : 'Nuevo Sacramento');

onMounted(async () => {
    await fetchAll();
    await requisitosStore.fetchAll();

    nextTick(() => {
        const el = document.getElementById('sacramentoModal');
        if (el) modalInstance.value = new Modal(el);
    });
});

// --- Métodos ---
const openModal = (sacramento = null) => {
    if (sacramento) {
        draft.value = {
            id: sacramento.id,
            nombre: sacramento.nombre,
            requisitos: sacramento.requisitos?.map(r => r.id) || []
        };
    } else {
        draft.value = { id: null, nombre: '', requisitos: [] };
    }
    modalInstance.value?.show();
};

const handleSubmit = async () => {
    // 1. Validaciones
    if (!draft.value.nombre.trim()) {
        return showAlerta('El nombre es obligatorio', 'warning');
    }

    // 2. Preparar Payload
    const payload = {
        nombre: draft.value.nombre,
        requisitos: draft.value.requisitos // Array de IDs [1, 2, 5]
    };

    saving.value = true;
    try {
        if (isEditing.value) {
            await save(draft.value.id, payload);
        } else {
            await add(payload);
        }

        // --- SOLUCIÓN AQUÍ ---
        // Recargamos la lista completa desde el servidor.
        // Esto asegura que traemos el objeto CON sus relaciones (requisitos) actualizadas
        // y confirma que lo que vemos en pantalla es lo que realmente hay en la BD.
        await fetchAll(); 

        modalInstance.value?.hide();
        showAlerta('Guardado exitosamente', 'success');

    } catch (e) {
        console.error("Error al guardar:", e);
        showAlerta('Ocurrió un error al guardar', 'error');
    } finally {
        saving.value = false;
    }
};
</script>

<template>
    <div class="main-container">
        
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="page-title">Sacramentos</h2>
                <p class="page-subtitle">Configuración de rutas sacramentales</p>
            </div>
        </div>

        <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-secondary" role="status"></div>
        </div>

        <div v-else class="card border-0 shadow-sm rounded-3 overflow-hidden">
            <div class="table-responsive">
                <table class="table align-middle mb-0">
                    <thead class="bg-light-gray">
                        <tr>
                            <th class="ps-4 py-2 text-secondary text-uppercase fw-bold" style="width: 5%;">#</th>
                            <th class="py-2 text-secondary text-uppercase fw-bold" style="width: 25%;">Sacramento</th>
                            <th class="py-2 text-secondary text-uppercase fw-bold">Requisitos Solicitados</th>
                            <th class="text-end pe-4 py-2 text-secondary text-uppercase fw-bold" style="width: 15%;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="sacramentos.length === 0">
                            <td colspan="4" class="text-center p-5 text-muted fs-5">
                                <FolderOpen :size="48" class="mb-2 opacity-25 d-block mx-auto"/>
                                No hay sacramentos registrados.
                            </td>
                        </tr>

                        <tr v-for="(sacramento, i) in sacramentos" :key="sacramento.id" class="hover-row">
                            <td class="ps-4 py-3 text-muted fw-bold">{{ i + 1 }}</td>
                            
                            <td class="py-3">
                                <div class="d-flex align-items-center">
                                    <div class="icon-box me-3">
                                        <FileCheck :size="18" class="text-primary" />
                                    </div>
                                    <span class="fw-bold text-dark fs-6">{{ sacramento.nombre }}</span>
                                </div>
                            </td>

                            <td class="py-3">
                                <div v-if="sacramento.requisitos && sacramento.requisitos.length > 0" class="d-flex flex-wrap gap-2">
                                    <span v-for="req in sacramento.requisitos" :key="req.id" 
                                          class="badge-req">
                                        <i class="bi bi-check2 text-success me-1"></i> {{ req.nombre }}
                                    </span>
                                </div>
                                <span v-else class="text-muted fst-italic small px-2">Sin requisitos</span>
                            </td>

                            <td class="text-end pe-4 py-3">
                                <div class="d-inline-flex gap-2">
                                    <button class="btn btn-action btn-soft-primary" title="Editar" @click="openModal(sacramento)">
                                        <Pencil :size="18" />
                                    </button>
                                    <button class="btn btn-action btn-soft-danger" title="Eliminar" @click="remove(sacramento.id)">
                                        <Trash :size="18" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="modal fade" id="sacramentoModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    
                    <div class="modal-header">
                        <div>
                            <h5 class="modal-title fw-bold text-white">
                                <i class="bi bi-journal-bookmark-fill me-2 text-white-50"></i> 
                                {{ modalTitle }}
                            </h5>
                            <p class="text-white-50 small mb-0">Define los documentos necesarios.</p>
                        </div>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" :disabled="saving"></button>
                    </div>

                    <div class="modal-body">
                        <form @submit.prevent="handleSubmit">
                            
                            <div class="mb-4">
                                <label class="form-label fw-bold text-secondary small text-uppercase">
                                    Nombre del Sacramento <span v-if="!isEditing" class="text-danger">*</span>
                                </label>
                                <div class="input-group">
                                    <span class="input-group-text bg-blue-soft text-primary border-end-0">
                                        <i class="bi" :class="isEditing ? 'bi-lock-fill' : 'bi-tag-fill'"></i>
                                    </span>
                                    <input type="text" v-model="draft.nombre" 
                                           class="form-control border-start-0" 
                                           :class="{'bg-light': isEditing}"
                                           placeholder="Ej: Bautismo" 
                                           required 
                                           :disabled="saving || isEditing">
                                </div>
                                <div v-if="isEditing" class="form-text text-muted small">
                                    El nombre no se puede modificar una vez creado.
                                </div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label fw-bold text-secondary small text-uppercase mb-2">Seleccionar Requisitos</label>

                                <div class="requisitos-container border rounded bg-white p-2">
                                    <div v-if="availableRequisitos.length === 0" class="text-center text-muted py-4 small">
                                        No hay requisitos registrados en el sistema.
                                    </div>

                                    <div v-else class="d-flex flex-column gap-1">
                                        <label v-for="req in availableRequisitos" :key="req.id" 
                                               class="requisito-item d-flex align-items-center p-2 rounded cursor-pointer transition-all"
                                               :class="{ 'selected-item': draft.requisitos.includes(req.id) }">
                                            
                                            <div class="form-check mb-0 d-flex align-items-center w-100">
                                                <input type="checkbox" class="form-check-input me-3" :value="req.id" 
                                                       v-model="draft.requisitos" :disabled="saving"
                                                       style="width: 1.2em; height: 1.2em;">
                                                <span class="fw-medium flex-grow-1">{{ req.nombre }}</span>
                                                <Check v-if="draft.requisitos.includes(req.id)" :size="18" class="text-primary" />
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                <div class="form-text mt-2 small text-muted"><i class="bi bi-info-circle me-1"></i>Marca los documentos obligatorios.</div>
                            </div>

                            <div class="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
                                <button type="button" class="btn btn-outline-secondary border-0" data-bs-dismiss="modal" :disabled="saving">Cancelar</button>
                                <button type="submit" class="btn btn-primary px-4" :disabled="saving">
                                    <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                                    {{ saving ? 'Guardando...' : 'Guardar' }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>

    </div>
</template>

<style scoped>
/* GENERAL STYLES (Vibrant Compact) */
.page-title { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 0; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }

/* TABLE */
.bg-light-gray { background-color: #f8fafc; border-bottom: 1px solid #e5e7eb; }
.hover-row:hover td { background-color: #f9fafb; }
.icon-box { width: 36px; height: 36px; background-color: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; }

/* BADGES */
.badge-req {
    background-color: #ffffff;
    border: 1px solid #e5e7eb;
    color: #4b5563;
    padding: 0.35em 0.65em;
    font-size: 0.8rem;
    font-weight: 500;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
}

/* BUTTONS */
.btn-action { width: 36px; height: 36px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: none; transition: all 0.2s; }
.btn-soft-primary { background-color: #eff6ff; color: #2563eb; }
.btn-soft-primary:hover { background-color: #2563eb; color: white; }
.btn-soft-danger { background-color: #fef2f2; color: #ef4444; }
.btn-soft-danger:hover { background-color: #ef4444; color: white; }

.btn-primary { background-color: #2563eb; border-color: #2563eb; font-size: 0.9rem; }
.btn-primary:hover { background-color: #1d4ed8; }

/* MODAL & CHECKLIST */
.modal-content { border: none; border-radius: 1rem; overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,0.15); }
.modal-header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border-bottom: none; padding: 1.5rem 2rem; }
.text-white-50 { color: rgba(255, 255, 255, 0.75) !important; }
.modal-body { padding: 2rem; }

.bg-blue-soft { background-color: #eff6ff !important; color: #2563eb !important; border: 1px solid #cbd5e1; border-right: none; }
.form-control { border-left: none; border-color: #cbd5e1; }
.input-group:focus-within { box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15); border-radius: 0.375rem; }
.input-group:focus-within .form-control, .input-group:focus-within .bg-blue-soft { border-color: #2563eb; }

/* Requisitos Checklist */
.requisitos-container { max-height: 250px; overflow-y: auto; border-color: #e5e7eb !important; }
.requisito-item:hover { background-color: #f8fafc; }
.selected-item { background-color: #eff6ff !important; border: 1px solid #bfdbfe; color: #2563eb; }
.cursor-pointer { cursor: pointer; }
</style>