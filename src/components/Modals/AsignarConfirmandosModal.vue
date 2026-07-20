<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useGruposStore } from '@/stores/grupos';
import { useConfirmandosStore } from '@/stores/confirmandos';
import { storeToRefs } from 'pinia';
import { Modal } from 'bootstrap';
import { showAlerta } from '@/funciones';
import { Search } from 'lucide-vue-next';

const emit = defineEmits(['updated']);
const modalRef = ref(null);
const modalInstance = ref(null);

const gruposStore = useGruposStore();
const confirmandosStore = useConfirmandosStore();
const { items: allConfirmandos } = storeToRefs(confirmandosStore);

const grupoId = ref(null);
const selectedConfirmandoIds = ref([]);
const searchQuery = ref('');
const saving = ref(false);

onMounted(() => {
    modalInstance.value = new Modal(modalRef.value);
});

onUnmounted(() => {
    modalInstance.value?.dispose();
});

const open = (grupo) => {
    grupoId.value = grupo.id;
    searchQuery.value = '';
    
    // Mapeamos los seleccionados cuidando no incluir retirados
    selectedConfirmandoIds.value = grupo.confirmandos
        ?.filter(miembro => {
            const globalData = allConfirmandos.value.find(c => c.id === miembro.id);
            return globalData ? globalData.estado !== 'retirado' : true;
        })
        .map(c => c.id) || [];
        
    modalInstance.value.show();
};

const close = () => modalInstance.value.hide();

defineExpose({ open, close });

const availableConfirmandos = computed(() => {
    if (!allConfirmandos.value) return [];
    return allConfirmandos.value.filter(c => {
        if (c.estado === 'retirado') return false;
        // Solo disponibles si no tienen grupo o son de ESTE grupo
        return !c.grupo_id || Number(c.grupo_id) === Number(grupoId.value);
    });
});

const filteredConfirmandos = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return availableConfirmandos.value;
    return availableConfirmandos.value.filter(c => `${c.nombres} ${c.apellidos}`.toLowerCase().includes(q));
});

const toggleSelectAll = (e) => {
    const isChecked = e.target.checked;
    const filteredIds = filteredConfirmandos.value.map(c => c.id);
    if (isChecked) {
        selectedConfirmandoIds.value = Array.from(new Set([...selectedConfirmandoIds.value, ...filteredIds]));
    } else {
        selectedConfirmandoIds.value = selectedConfirmandoIds.value.filter(id => !filteredIds.includes(id));
    }
};

const toggleSelection = (confId) => {
    if(saving.value) return;
    const index = selectedConfirmandoIds.value.indexOf(confId);
    if (index > -1) selectedConfirmandoIds.value.splice(index, 1);
    else selectedConfirmandoIds.value.push(confId);
};

const save = async () => {
    if (saving.value) return;
    saving.value = true;
    try {
        await gruposStore.assignConfirmandos(grupoId.value, selectedConfirmandoIds.value);
        showAlerta('Confirmandos actualizados', 'success');
        emit('updated');
        close();
    } catch (e) {
        showAlerta('Error al guardar confirmandos', 'error');
    } finally {
        saving.value = false;
    }
};
</script>

<template>
    <div class="modal fade" ref="modalRef" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
            <div class="modal-content border-0">
                <div class="modal-header-theme">
                    <h5 class="modal-title fw-bold text-white"><i class="bi bi-people-fill me-2"></i>Asignar Confirmandos</h5>
                    <button type="button" class="btn-close btn-close-white" @click="close"></button>
                </div>
                <div class="bg-light border-bottom p-3">
                    <div class="input-group">
                        <span class="input-group-text bg-white border-end-0"><Search :size="16" class="text-muted" /></span>
                        <input type="text" class="form-control border-start-0 shadow-none" v-model="searchQuery" placeholder="Buscar por nombre...">
                    </div>
                </div>
                <div class="modal-body p-0">
                    <table class="table align-middle mb-0">
                        <thead class="bg-light sticky-top text-muted small text-uppercase" style="z-index: 1;">
                            <tr>
                                <th class="ps-4 py-2" style="width: 50px;">
                                    <input class="form-check-input" type="checkbox" @change="toggleSelectAll">
                                </th>
                                <th class="py-2">Nombre</th>
                                <th class="py-2">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="conf in filteredConfirmandos" :key="conf.id" class="hover-bg-light cursor-pointer" @click="toggleSelection(conf.id)">
                                <td class="ps-4">
                                    <input class="form-check-input" type="checkbox" :value="conf.id" v-model="selectedConfirmandoIds" :disabled="saving" @click.stop>
                                </td>
                                <td><div class="fw-bold text-dark">{{ conf.apellidos }}, {{ conf.nombres }}</div></td>
                                <td class="small">
                                    <span v-if="conf.grupo_id" class="badge bg-success-subtle text-success border-0 px-3 py-1">Inscrito</span>
                                    <span v-else class="badge bg-secondary-subtle text-muted border-0 px-3 py-1">Sin asignar</span>
                                </td>
                            </tr>
                            <tr v-if="filteredConfirmandos.length === 0">
                                <td colspan="3" class="text-center py-4 text-muted small">No hay confirmandos disponibles.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer bg-light-subtle border-top">
                    <button class="btn btn-secondary border-0" @click="close">Cancelar</button>
                    <button class="btn btn-success rounded-pill px-4" @click="save" :disabled="saving">
                        {{ saving ? 'Guardando...' : 'Confirmar Asignación' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.main-container {
    --theme-color: v-bind(groupColor);
    --theme-soft: color-mix(in srgb, var(--theme-color), white 93%);
    --theme-hover: color-mix(in srgb, var(--theme-color), black 12%);
}

.text-theme {
    color: var(--theme-color) !important;
}

.page-title {
    font-size: 1.4rem;
    font-weight: 800;
    color: #1e293b;
    margin: 0;
}

.page-subtitle {
    font-size: 0.825rem;
    color: #64748b;
}

.btn-theme {
    background-color: var(--theme-color);
    border-color: var(--theme-color);
    color: white;
}

.btn-theme:hover {
    background-color: var(--theme-hover);
    border-color: var(--theme-hover);
    color: white;
}

.bg-theme-soft {
    background-color: var(--theme-soft) !important;
}

.modal-header-theme {
    background: linear-gradient(135deg, var(--theme-color) 0%, #1e293b 150%);
    color: white;
    padding: 1.5rem 2rem;
    border-bottom: none;
    position: relative;
}

.modal-content {
    border-radius: 1.2rem !important;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.rounded-4 {
    border-radius: 1rem !important;
}

.hover-row {
    transition: background-color 0.2s ease;
}

.hover-row:hover td {
    background-color: #f8fafc;
}

.hover-bg-light:hover {
    background-color: #f1f5f9;
}

.cursor-pointer {
    cursor: pointer;
}

.btn-action {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    transition: all 0.2s ease;
}

.btn-soft-warning {
    background-color: #fef3c7;
    color: #d97706;
}

.btn-soft-warning:hover {
    background-color: #d97706;
    color: white;
}

.btn-soft-theme {
    background-color: var(--theme-soft);
    color: var(--theme-color);
}

.btn-soft-theme:hover {
    background-color: var(--theme-color);
    color: white;
}

.row-critica {
    background-color: rgba(239, 68, 68, 0.04) !important;
}

.row-preventiva {
    background-color: rgba(245, 158, 11, 0.04) !important;
}

.badge-alert-glow {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 50px;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.5px;
}

.badge-alert-glow.critico {
    background-color: #fecaca;
    color: #ef4444;
}

.badge-alert-glow.preventivo {
    background-color: #fef3c7;
    color: #d97706;
}
</style>