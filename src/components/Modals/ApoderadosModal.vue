<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Modal } from 'bootstrap';
import { ShieldCheck, Phone } from 'lucide-vue-next';
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn';

const modalElement = ref(null);
let modalInstance = null;
let detachFocusReturn = () => {};
const viewData = ref({ nombreConfirmando: '', apoderados: [] });

onMounted(() => {
    if (modalElement.value) {
        modalInstance = new Modal(modalElement.value);
        detachFocusReturn = attachModalFocusReturn(modalElement.value);
    }
});

onUnmounted(() => {
    detachFocusReturn();
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
                <div class="modal-header bg-primary text-white border-0 py-3 rounded-top-4 flex justify-between items-center">
                    <h5 class="modal-title flex items-center !gap-2 !m-0 fs-6">
                        <ShieldCheck :size="18" /> Apoderados de {{ viewData.nombreConfirmando }}
                    </h5>
                    <button type="button" class="btn-close btn-close-white shadow-none" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-0">
                    <div class="divide-y divide-gray-100">
                        <div v-for="apo in viewData.apoderados" :key="apo.id" class="!p-3">
                            <strong class="block text-gray-800">{{ apo.apellidos }}, {{ apo.nombres }}</strong>
                            <span class="text-sm text-gray-500 flex items-center !gap-1 !mt-1">
                                <Phone :size="12" /> {{ apo.celular || 'Sin celular' }}
                            </span>
                        </div>
                        <div v-if="viewData.apoderados.length === 0" class="!p-4 !text-center text-gray-500 text-sm">
                            No hay apoderados registrados.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>