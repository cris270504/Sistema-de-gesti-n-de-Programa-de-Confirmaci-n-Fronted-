<script setup>
import AppSkeleton from '@/components/AppSkeleton.vue'
import AppButton from '@/components/AppButton.vue'
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
            <div class="modal-content">
                <div class="modal-header">
                  <span class="modal-header__icon" aria-hidden="true"><IdCard :size="18" /></span>
                  <div class="modal-header__text">
                    <h5 class="modal-title">Asignar catequistas</h5>
                  </div>
                  <button type="button" class="btn-close" @click="close" aria-label="Cerrar"></button>
                </div>
                <div class="modal-body p-0">
                    <div v-if="loadingUsers" class="p-3" role="status" aria-live="polite" aria-label="Cargando catequistas">
                        <AppSkeleton skeleton="lines" />
                    </div>
                    <div v-else class="divide-y divide-gray-100">
                        <label v-for="cat in availableCatechists" :key="cat.id" class="!py-3 !px-4 flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                            <input class="form-check-input !mr-3 fs-5" type="checkbox" :value="cat.id" v-model="selectedCatechistIds" :disabled="saving">
                            <div>
                                <div class="font-medium text-gray-800 dark:text-gray-100">{{ cat.name }}</div>
                                <div class="text-sm text-gray-500 dark:text-gray-400">{{ cat.email }}</div>
                            </div>
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <AppButton variant="secondary" @click="close">Cancelar</AppButton>
                    <AppButton @click="save" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar' }}</AppButton>
                </div>
            </div>
        </div>
    </div>
</template>