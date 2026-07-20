<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Modal } from 'bootstrap';
import { ShieldCheck, Phone } from 'lucide-vue-next';

const modalElement = ref(null);
let modalInstance = null;
const viewData = ref({ nombreConfirmando: '', apoderados: [] });

onMounted(() => {
    if (modalElement.value) {
        modalInstance = new Modal(modalElement.value);
    }
});

onUnmounted(() => {
    modalInstance?.dispose();
});

const open = (conf) => {
    viewData.value = { 
        nombreConfirmando: `${conf.nombres} ${conf.apellidos}`, 
        apoderados: conf.apoderados || [] 
    };
    modalInstance?.show();
};

defineExpose({ open });
</script>

<template>
    <div class="modal fade" id="apoderadosInfoModal" tabindex="-1" aria-hidden="true" ref="modalElement">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg rounded-4">
                <div class="modal-header bg-primary text-white border-0 py-3 rounded-top-4 d-flex justify-content-between align-items-center">
                    <h5 class="modal-title d-flex align-items-center gap-2 m-0 fs-6">
                        <ShieldCheck :size="18" /> Apoderados de {{ viewData.nombreConfirmando }}
                    </h5>
                    <button type="button" class="btn-close btn-close-white shadow-none" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-0">
                    <div class="list-group list-group-flush rounded-bottom-4">
                        <div v-for="apo in viewData.apoderados" :key="apo.id" class="list-group-item p-3">
                            <strong class="d-block text-dark">{{ apo.apellidos }}, {{ apo.nombres }}</strong>
                            <span class="small text-muted d-flex align-items-center gap-1 mt-1">
                                <Phone :size="12" /> {{ apo.celular || 'Sin celular' }}
                            </span>
                        </div>
                        <div v-if="viewData.apoderados.length === 0" class="p-4 text-center text-muted small">
                            No hay apoderados registrados.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>