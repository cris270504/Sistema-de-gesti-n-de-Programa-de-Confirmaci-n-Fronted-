<script setup>
import AppEmpty from '@/components/AppEmpty.vue'
import { ref, onMounted, onUnmounted } from 'vue';
import { Modal } from 'bootstrap';
import { ShieldCheck, Phone } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
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
            <div class="modal-content">
                <div class="modal-header">
                  <span class="modal-header__icon" aria-hidden="true"><ShieldCheck :size="18" /></span>
                  <div class="modal-header__text">
                    <h5 class="modal-title">Apoderados</h5>
                    <p class="modal-subtitle">Familiares de {{ viewData.nombreConfirmando }}</p>
                  </div>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>
                <div class="modal-body p-0">
                    <div class="divide-y divide-gray-100">
                        <div v-for="apo in viewData.apoderados" :key="apo.id" class="!p-3">
                            <strong class="block text-gray-800 dark:text-gray-100">{{ apo.apellidos }}, {{ apo.nombres }}</strong>
                            <span class="text-sm text-gray-500 dark:text-gray-400 flex items-center !gap-1 !mt-1">
                                <Phone :size="12" /> {{ apo.celular || 'Sin celular' }}
                            </span>
                        </div>
                        <AppEmpty v-if="viewData.apoderados.length === 0" compact :icon="ShieldCheck"
                            message="Este confirmando aún no tiene apoderados registrados." />
                    </div>
                </div>
                <div class="modal-footer">
                    <AppButton variant="ghost" data-bs-dismiss="modal">Cerrar</AppButton>
                </div>
            </div>
        </div>
    </div>
</template>