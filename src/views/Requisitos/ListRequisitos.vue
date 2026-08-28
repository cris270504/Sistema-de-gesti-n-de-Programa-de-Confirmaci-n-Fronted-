<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { useRequisitosStore } from '../../stores/requisitos'; // Asegúrate de la ruta
import { Modal } from 'bootstrap';
import { showAlerta, confirmarEliminacion } from '@/funciones';
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn';
import { Pencil, Trash, Plus, FileText } from 'lucide-vue-next';
import AppPage from '@/components/AppPage.vue';

// --- Store ---
const requisitosStore = useRequisitosStore();
const { items: requisitos, loading, error } = storeToRefs(requisitosStore);
const { fetchAll, add, save, remove } = requisitosStore;

// --- Estado del Modal y Formulario ---
const modalInstance = ref(null);
const draft = ref({ id: null, nombre: '' });
const saving = ref(false);

// Computados para la UI del Modal
const isEditing = computed(() => !!draft.value.id);
const modalTitle = computed(() => isEditing.value ? 'Editar Requisito' : 'Nuevo Requisito');

// --- Ciclo de Vida ---
let detachFocusReturn = () => {};

onMounted(async () => {
  await fetchAll();

  // Inicializar el modal de Bootstrap
  nextTick(() => {
    const el = document.getElementById('requisitoModal');
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
const openModal = (requisito = null) => {
  if (requisito) {
    draft.value = { 
      id: requisito.id, 
      nombre: requisito.nombre 
    };
  } else {
    draft.value = { id: null, nombre: '' };
  }
  modalInstance.value?.show();
};

const handleSubmit = async () => {
  const nombre = draft.value.nombre.trim();
  
  if (!nombre) {
    return showAlerta('El nombre del requisito es obligatorio', 'warning');
  }

  saving.value = true;
  try {
    if (isEditing.value) {
      await save(draft.value.id, { nombre });
    } else {
      await add({ nombre });
    }
    modalInstance.value?.hide();
  } catch (e) {
    console.error(e);
  } finally {
    saving.value = false;
  }
};

const handleDelete = async (id, nombre) => {
  await remove(id);
};
</script>

<template>
  <AppPage title="Requisitos" subtitle="Documentos solicitados para los sacramentos" :loading="loading">
    <template #actions>
      <button class="btn-success" @click="openModal(null)">
        <Plus :size="18" class="mr-1.5" /> <span class="text-sm">Nuevo requisito</span>
      </button>
    </template>

    <div v-if="error" class="alert-error !mb-4">{{ error }}</div>

    <div class="surface table-wrap cards-sm cards-sm--hide-first">
      <table class="mb-0">
        <thead>
          <tr>
            <th class="pl-6 w-[5%]">#</th>
            <th>Nombre del requisito</th>
            <th class="!text-center w-[15%]">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="requisitos.length === 0">
            <td colspan="3" class="empty-state">No hay requisitos registrados.</td>
          </tr>
          <tr v-for="(req, i) in requisitos" :key="req.id">
            <td class="pl-6 font-semibold text-gray-500">{{ i + 1 }}</td>
            <td>
              <div class="flex items-center">
                <div class="bg-gray-100 rounded-md !p-2 mr-3 text-indigo-600">
                  <FileText :size="20" />
                </div>
                <span class="font-medium">{{ req.nombre }}</span>
              </div>
            </td>
            <td class="!text-center">
              <button class="btn-icon-edit mr-2" @click="openModal(req)" title="Editar">
                <Pencil :size="15" />
              </button>
              <button class="btn-icon-delete" @click="handleDelete(req.id, req.nombre)" title="Eliminar">
                <Trash :size="15" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="modal fade" id="requisitoModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg">
          <div class="modal-header">
            <h5 class="modal-title fw-bold">{{ modalTitle }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" :disabled="saving"></button>
          </div>
          
          <div class="modal-body p-4">
             <form @submit.prevent="handleSubmit">
                <div class="mb-3">
                    <label for="reqNombre" class="form-label fw-bold text-secondary">Nombre <span class="text-danger">*</span></label>
                    <input 
                        id="reqNombre" 
                        type="text" 
                        v-model="draft.nombre" 
                        class="form-control form-control-lg" 
                        placeholder="Ej: Partida de Bautismo" 
                        required 
                        :disabled="saving"
                        autofocus
                    >
                    <div class="form-text">Nombre descriptivo del documento o pago.</div>
                </div>

                <div class="d-flex justify-content-end gap-2 mt-4">
                    <button type="button" class="btn btn-light" data-bs-dismiss="modal" :disabled="saving">Cancelar</button>
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