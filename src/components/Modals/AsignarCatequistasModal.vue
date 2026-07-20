<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useGruposStore } from '@/stores/grupos';
import { useUsersStore } from '@/stores/users';
import { storeToRefs } from 'pinia';
import { Modal } from 'bootstrap';
import { showAlerta } from '@/funciones';

const emit = defineEmits(['updated']);
const modalRef = ref(null);
const modalInstance = ref(null);

const gruposStore = useGruposStore();
const usersStore = useUsersStore();
const { items: allUsers, loading: loadingUsers } = storeToRefs(usersStore);

const grupoId = ref(null);
const selectedCatechistIds = ref([]);
const saving = ref(false);

onMounted(() => {
    modalInstance.value = new Modal(modalRef.value);
});

onUnmounted(() => {
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
    } catch (e) {
        showAlerta('Error al guardar catequistas', 'error');
    } finally {
        saving.value = false;
    }
};
</script>

<template>
    <div class="modal fade" ref="modalRef" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content border-0">
                <div class="modal-header-theme">
                    <h5 class="modal-title fw-bold text-white"><i class="bi bi-person-badge me-2"></i>Asignar Catequistas</h5>
                </div>
                <div class="modal-body p-0">
                    <div v-if="loadingUsers" class="p-4 text-center"><div class="spinner-border text-theme"></div></div>
                    <div v-else class="list-group list-group-flush">
                        <label v-for="cat in availableCatechists" :key="cat.id" class="list-group-item list-group-item-action py-3 px-4 d-flex align-items-center cursor-pointer border-0">
                            <input class="form-check-input me-3 fs-5" type="checkbox" :value="cat.id" v-model="selectedCatechistIds" :disabled="saving">
                            <div>
                                <div class="fw-medium text-dark">{{ cat.name }}</div>
                                <div class="small text-muted">{{ cat.email }}</div>
                            </div>
                        </label>
                    </div>
                </div>
                <div class="modal-footer bg-light-subtle border-top">
                    <button class="btn btn-sm btn-theme rounded-pill px-4" @click="close">Cancelar</button>
                    <button class="btn btn-sm btn-theme rounded-pill px-4" @click="save" :disabled="saving">
                        {{ saving ? 'Guardando...' : 'Guardar' }}
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