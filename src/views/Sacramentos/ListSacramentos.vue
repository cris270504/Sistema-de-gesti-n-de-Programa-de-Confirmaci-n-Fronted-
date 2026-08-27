<script setup>
import { onMounted, onUnmounted, ref, nextTick, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useSacramentosStore } from '../../stores/sacramentos';
import { useRequisitosStore } from '../../stores/requisitos';
import { Modal } from 'bootstrap';
import { Pencil, Trash, Plus, Check, FileCheck, FolderOpen, BookMarked, Lock, Tag, Info } from 'lucide-vue-next';
import AppPage from '@/components/AppPage.vue';
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn';
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

let detachFocusReturn = () => {};

onMounted(async () => {
    await fetchAll();
    await requisitosStore.fetchAll();

    nextTick(() => {
        const el = document.getElementById('sacramentoModal');
        if (el) {
            modalInstance.value = new Modal(el);
            detachFocusReturn = attachModalFocusReturn(el);
        }
    });
});

onUnmounted(() => {
    detachFocusReturn();
    modalInstance.value?.dispose();
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
    <AppPage title="Sacramentos" subtitle="Configuración de rutas sacramentales" :loading="loading">
        <template #actions>
            <button class="btn-primary" @click="openModal(null)">
                <Plus :size="18" class="mr-1.5" /> <span class="text-sm">Nuevo sacramento</span>
            </button>
        </template>

        <div class="surface">
            <div class="table-wrap cards-sm">
                <table class="mb-0">
                    <thead>
                        <tr>
                            <th class="pl-6 w-[5%]">#</th>
                            <th class="w-[25%]">Sacramento</th>
                            <th>Requisitos Solicitados</th>
                            <th class="text-right pr-6 w-[15%]">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="sacramentos.length === 0">
                            <td colspan="4" class="!text-center py-16 text-gray-500">
                                <FolderOpen :size="48" class="!mb-2 opacity-25 block mx-auto"/>
                                No hay sacramentos registrados.
                            </td>
                        </tr>

                        <tr v-for="(sacramento, i) in sacramentos" :key="sacramento.id">
                            <td class="pl-6 font-semibold text-gray-500">{{ i + 1 }}</td>

                            <td>
                                <div class="flex items-center">
                                    <div class="bg-gray-100 rounded-md !p-2 mr-3 text-indigo-600 shrink-0">
                                        <FileCheck :size="18" />
                                    </div>
                                    <span class="font-bold text-gray-900">{{ sacramento.nombre }}</span>
                                </div>
                            </td>

                            <td>
                                <div v-if="sacramento.requisitos && sacramento.requisitos.length > 0" class="flex !flex-wrap !gap-2">
                                    <span v-for="req in sacramento.requisitos" :key="req.id"
                                          class="inline-flex items-center !bg-white !border border-gray-200 text-gray-600 text-xs font-medium px-2.5 !py-1 rounded-md">
                                        <Check class="h-4 w-4 text-green-600 mr-1 inline-block align-text-bottom" aria-hidden="true" /> {{ req.nombre }}
                                    </span>
                                </div>
                                <span v-else class="text-gray-400 italic text-sm !px-2">Sin requisitos</span>
                            </td>

                            <td class="text-right pr-6">
                                <div class="inline-flex !gap-2">
                                    <button class="btn-icon-edit" title="Editar" @click="openModal(sacramento)">
                                        <Pencil :size="18" />
                                    </button>
                                    <button class="btn-icon-delete" title="Eliminar" @click="remove(sacramento.id)">
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
                                <BookMarked class="h-5 w-5 me-2 text-white-50 d-inline-block align-text-bottom" aria-hidden="true" />
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
                                        <component :is="isEditing ? Lock : Tag" class="h-4 w-4" aria-hidden="true" />
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
                                <div class="form-text mt-2 small text-muted d-flex align-items-center gap-1"><Info class="h-4 w-4" aria-hidden="true" />Marca los documentos obligatorios.</div>
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
    </AppPage>
</template>

<style scoped>
/* Todo lo que sigue pertenece únicamente al modal de Bootstrap JS (creación/edición),
   que se deja intacto a propósito hasta el sub-bloque final de la Fase 8. El resto de
   la vista (header, tabla, badges, botones de acción) ya usa Tailwind directamente en
   el template, sin necesidad de estilos con scope aquí.
   OJO: el selector va prefijado con .modal-content para no chocar con la clase Tailwind
   global ".btn-primary" que ahora también usa el botón "Nuevo Sacramento" del header —
   como el scope de Vue solo agrega un atributo data-v-*, un selector ".btn-primary" a
   secas seguiría matcheando ese botón por nombre de clase igual. */
.modal-content .btn-primary { background-color: #2563eb; border-color: #2563eb; font-size: 0.9rem; }
.modal-content .btn-primary:hover { background-color: #1d4ed8; }

/* MODAL & CHECKLIST — el marco del modal (contenido, cabecera, cuerpo) lo define
   el estilo global unificado en src/assets/main.css. */

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