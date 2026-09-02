<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useGruposStore } from '@/stores/grupos';
import { useUsersStore } from '@/stores/users';
import { storeToRefs } from 'pinia';
import { Modal } from 'bootstrap';
import { showAlerta } from '@/funciones';
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn';
import { IdCard } from 'lucide-vue-next';

const emit = defineEmits(['updated']);
const modalRef = ref(null);
const modalInstance = ref(null);

const gruposStore = useGruposStore();
const usersStore = useUsersStore();
const { items: allUsers, loading: loadingUsers } = storeToRefs(usersStore);

const grupoId = ref(null);
const selectedCatechistIds = ref([]);
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
    selectedCatechistIds.value = grupo.catequistas?.map(c => c.id) || [];
    modalInstance.value.show();
};

const close = () => modalInstance.value.hide();

defineExpose({ open, close });

// LÓGICA DE MUCHOS A MUCHOS
const availableCatechists = computed(() => {
    if (!allUsers.value) return [];
    // Ahora CUALQUIER usuario con rol catequista puede ser asignado, 
    // sin importar en cuántos grupos esté.
    return allUsers.value.filter(user => 
        user.roles?.some(role => role.name === 'catequista' || role.name === 'coordinador')
    );
});

const save = async () => {
    if (saving.value) return;
    saving.value = true;
    try {
        await gruposStore.assignCatequists(grupoId.value, selectedCatechistIds.value);
        showAlerta('Catequistas actualizados', 'success');
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
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content !border-0 !rounded-2xl !shadow-lg overflow-hidden">
                <div class="!p-6" style="background: linear-gradient(135deg, var(--color-primary) 0%, #1e293b 150%);">
                    <h5 class="modal-title font-bold text-white flex items-center"><IdCard class="h-5 w-5 !mr-2" aria-hidden="true" />Asignar Catequistas</h5>
                </div>
                <div class="modal-body p-0">
                    <div v-if="loadingUsers" class="!p-4 !text-center"><div class="spinner-border !text-primary"></div></div>
                    <div v-else class="divide-y divide-gray-100">
                        <label v-for="cat in availableCatechists" :key="cat.id" class="!py-3 !px-4 flex items-center cursor-pointer hover:bg-gray-50 transition-colors">
                            <input class="form-check-input !mr-3 fs-5" type="checkbox" :value="cat.id" v-model="selectedCatechistIds" :disabled="saving">
                            <div>
                                <div class="font-medium text-gray-800">{{ cat.name }}</div>
                                <div class="text-sm text-gray-500">{{ cat.email }}</div>
                            </div>
                        </label>
                    </div>
                </div>
                <div class="modal-footer bg-gray-50 border-t !gap-2">
                    <button class="btn-outline !rounded-full !px-4 text-sm" @click="close">Cancelar</button>
                    <button class="btn-primary !rounded-full !px-4 text-sm" @click="save" :disabled="saving">
                        {{ saving ? 'Guardando...' : 'Guardar' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>