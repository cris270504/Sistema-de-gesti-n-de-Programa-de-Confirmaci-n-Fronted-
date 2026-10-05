<script setup>
import AppEmpty from '@/components/AppEmpty.vue'
import AppButton from '@/components/AppButton.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useGruposStore } from '@/stores/grupos';
import { useConfirmandosStore } from '@/stores/confirmandos';
import { storeToRefs } from 'pinia';
import { Modal } from 'bootstrap';
import { showAlerta } from '@/funciones';
import { Search, Users } from 'lucide-vue-next';
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn';

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

let detachFocusReturn = () => {};
onMounted(() => {
    modalInstance.value = new Modal(modalRef.value);
    detachFocusReturn = attachModalFocusReturn(modalRef.value);
});

onUnmounted(() => {
    detachFocusReturn();
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
    } catch {
        // El store ya mostró el motivo real del error.
    } finally {
        saving.value = false;
    }
};
</script>

<template>
    <div class="modal fade" ref="modalRef" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                  <span class="modal-header__icon" aria-hidden="true"><Users :size="18" /></span>
                  <div class="modal-header__text">
                    <h5 class="modal-title">Asignar confirmandos</h5>
                  </div>
                  <button type="button" class="btn-close" @click="close" aria-label="Cerrar"></button>
                </div>
                <div class="!bg-gray-50 dark:!bg-slate-900 border-b !p-3">
                    <div class="input-group">
                        <span class="input-group-text !bg-white dark:!bg-slate-800 border-end-0"><Search :size="16" class="text-gray-400" /></span>
                        <input type="text" class="form-control border-start-0 shadow-none" v-model="searchQuery" placeholder="Buscar por nombre...">
                    </div>
                </div>
                <div class="modal-body p-0">
                    <table class="w-full">
                        <thead class="!bg-gray-50 dark:!bg-slate-900 sticky-top text-gray-500 dark:text-gray-400 text-xs" style="z-index: 1;">
                            <tr>
                                <th class="!pl-4 py-2 text-left" style="width: 50px;">
                                    <input class="form-check-input" type="checkbox" @change="toggleSelectAll">
                                </th>
                                <th class="py-2 text-left">Nombre</th>
                                <th class="py-2 text-left">Estado</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr v-for="conf in filteredConfirmandos" :key="conf.id" class="hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors" @click="toggleSelection(conf.id)">
                                <td class="!pl-4 py-2">
                                    <input class="form-check-input" type="checkbox" :value="conf.id" v-model="selectedConfirmandoIds" :disabled="saving"
                                        :aria-label="`Seleccionar a ${conf.apellidos}, ${conf.nombres}`" @click.stop>
                                </td>
                                <td class="py-2"><div class="font-bold text-gray-800 dark:text-gray-100">{{ conf.apellidos }}, {{ conf.nombres }}</div></td>
                                <td class="py-2 text-sm">
                                    <span v-if="conf.grupo_id" class="inline-flex items-center rounded-full !border-0 bg-green-50 text-green-700 !px-3 !py-1 text-xs font-medium">Inscrito</span>
                                    <span v-else class="inline-flex items-center rounded-full !border-0 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 !px-3 !py-1 text-xs font-medium">Sin asignar</span>
                                </td>
                            </tr>
                            <tr v-if="filteredConfirmandos.length === 0">
                                <td colspan="3"><AppEmpty compact :icon="Users" message="No hay confirmandos disponibles para asignar." /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <AppButton variant="secondary" @click="close">Cancelar</AppButton>
                    <AppButton @click="save" :disabled="saving">{{ saving ? 'Guardando...' : 'Confirmar Asignación' }}</AppButton>
                </div>
            </div>
        </div>
    </div>
</template>