<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { Modal } from 'bootstrap';
import { FileText, CheckCircle, Clock } from 'lucide-vue-next';
import { useConfirmandosStore } from '@/stores/confirmandos';
import { useAuthStore } from '@/stores/auth';
import { showAlerta } from '@/funciones';

const authStore = useAuthStore();
const confirmandosStore = useConfirmandosStore();
const emit = defineEmits(['saved']);

const modalElement = ref(null);
let modalInstance = null;

const savingDocs = ref(false);
const docDraft = ref({
    confirmando_id: null,
    nombre: '',
    requisitos: [] // Aquí guardaremos los documentos
});

// Comprobamos si el usuario tiene permiso para modificar requisitos
const canEditRequisitos = computed(() => {
    return authStore.can('validar requisitos');
});

onMounted(() => {
    if (modalElement.value) {
        modalInstance = new Modal(modalElement.value);
    }
});

onUnmounted(() => {
    modalInstance?.dispose();
});

const open = (conf) => {
    // 1. Buscamos el confirmando directamente en el Store principal
    // Esto asegura que leamos el JSON completo que me mostraste, 
    // ignorando versiones "incompletas" que puedan venir de la vista de Grupos.
    const fullConf = confirmandosStore.items.find(c => c.id === conf.id) || conf;
    
    // 2. Imprimimos en consola para que puedas verificar que los datos llegan
    console.log(`Documentos de ${fullConf.nombres}:`, fullConf.requisitos);

    docDraft.value = {
        confirmando_id: fullConf.id,
        nombre: `${fullConf.nombres} ${fullConf.apellidos}`,
        // 3. Cargamos los requisitos del objeto completo
        requisitos: JSON.parse(JSON.stringify(fullConf.requisitos || []))
    };
    
    modalInstance?.show();
};

const hide = () => modalInstance?.hide();

const handleSave = async () => {
    savingDocs.value = true;
    try {
        // Formateamos exactamente como lo espera el $request de tu Backend
        const payload = docDraft.value.requisitos.map(r => ({
            id: r.id,
            estado: r.pivot.estado
        }));

        // Enviamos con la llave 'requisitos_actualizar'
        await confirmandosStore.save(docDraft.value.confirmando_id, {
            requisitos_actualizar: payload
        });

        emit('saved');
        hide();
        showAlerta('Documentos actualizados correctamente', 'success');
    } catch (e) {
        showAlerta('Error al guardar documentos', 'error');
    } finally {
        savingDocs.value = false;
    }
};

defineExpose({ open, hide });
</script>

<template>
    <div class="modal fade" id="requisitosModal" tabindex="-1" aria-hidden="true" ref="modalElement">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg rounded-4">
                <div class="modal-header bg-primary text-white border-0 py-3 rounded-top-4 d-flex justify-content-between align-items-center">
                    <h5 class="modal-title d-flex align-items-center gap-2 m-0 fs-6">
                        <FileText :size="18"/> Documentos de {{ docDraft.nombre }}
                    </h5>
                    <button type="button" class="btn-close btn-close-white shadow-none" @click="hide"></button>
                </div>
                
                <div class="modal-body p-0">
                    <div class="list-group list-group-flush">
                        <div v-for="req in docDraft.requisitos" :key="req.id" class="list-group-item p-3 d-flex justify-content-between align-items-center">
                            
                            <span :class="req.pivot.estado === 'entregado' ? 'text-success fw-bold' : 'text-dark'">
                                {{ req.nombre }}
                            </span>
                            
                            <!-- VISTA ADMIN: Muestra el Switch para activar/desactivar -->
                            <div class="form-check form-switch m-0" v-if="canEditRequisitos">
                                <input class="form-check-input shadow-none cursor-pointer" type="checkbox" role="switch"
                                    :checked="req.pivot.estado === 'entregado'" 
                                    @change="req.pivot.estado = req.pivot.estado === 'entregado' ? 'pendiente' : 'entregado'">
                            </div>
                            
                            <!-- VISTA CATEQUISTA: Muestra solo una etiqueta visual -->
                            <div v-else>
                                <span v-if="req.pivot.estado === 'entregado'" class="badge bg-success-subtle text-success border border-success-subtle d-flex align-items-center gap-1">
                                    <CheckCircle :size="12"/> Entregado
                                </span>
                                <span v-else class="badge bg-warning-subtle text-warning border border-warning-subtle d-flex align-items-center gap-1">
                                    <Clock :size="12"/> Pendiente
                                </span>
                            </div>

                        </div>
                        
                        <div v-if="docDraft.requisitos.length === 0" class="p-4 text-center text-muted small border-bottom-0">
                            <FileText :size="24" class="text-secondary mb-2 opacity-50"/>
                            <p class="mb-0">No hay documentos requeridos registrados para este confirmando.</p>
                        </div>
                    </div>
                </div>
                
                <!-- Solo mostramos el footer y el botón de guardar al Admin -->
                <div class="modal-footer border-0 bg-light rounded-bottom-4 justify-content-center" v-if="canEditRequisitos">
                    <button class="btn btn-primary rounded-pill px-5 fw-medium shadow-sm" @click="handleSave" :disabled="savingDocs">
                        <span v-if="savingDocs" class="spinner-border spinner-border-sm me-2"></span>
                        Guardar Registro
                    </button>
                </div>
                <!-- Para el catequista mostramos un footer simple de cierre -->
                <div class="modal-footer border-0 bg-light rounded-bottom-4" v-else>
                    <button class="btn btn-outline-secondary btn-sm rounded-pill px-4" @click="hide">Cerrar</button>
                </div>
            </div>
        </div>
    </div>
</template>