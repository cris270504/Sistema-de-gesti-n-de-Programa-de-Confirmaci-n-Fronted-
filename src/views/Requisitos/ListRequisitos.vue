<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { useRequisitosStore } from '../../stores/requisitos'; // Asegúrate de la ruta
import { Modal } from 'bootstrap';
import { showAlerta, confirmarEliminacion } from '@/funciones';
import { Pencil, Trash, Plus, FileText } from 'lucide-vue-next';

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
onMounted(async () => {
  await fetchAll();
  
  // Inicializar el modal de Bootstrap
  nextTick(() => {
    const el = document.getElementById('requisitoModal');
    if (el) modalInstance.value = new Modal(el);
  });
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
  <div class="container-fluid p-4">
    
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h2 class="h3 text-gray-800 mb-1">Gestión de Requisitos</h2>
        <p class="text-muted mb-0 small">Documentos solicitados para los sacramentos</p>
      </div>
      <button class="btn btn-success shadow-sm px-3 py-2 d-flex align-items-center" @click="openModal(null)">
         <Plus :size="20" class="me-1"/> 
         <span class="fw-bold fs-7 text-uppercase">Nuevo Confirmando</span>
      </button>

    </div>

    <div class="card shadow border-0">
      <div class="card-body p-0">
        
        <div v-if="loading" class="text-center p-5">
           <div class="spinner-border text-primary" role="status"></div>
           <p class="mt-2 text-muted">Cargando requisitos...</p>
        </div>

        <div v-else-if="error" class="alert alert-danger m-3">
           {{ error }}
        </div>

        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th class="ps-4" style="width: 5%;">#</th>
                <th>Nombre del Requisito</th>
                <th class="text-center" style="width: 15%;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="requisitos.length === 0">
                 <td colspan="3" class="text-center p-5 text-muted">
                   No hay requisitos registrados.
                 </td>
              </tr>

              <tr v-for="(req, i) in requisitos" :key="req.id">
                <td class="ps-4 fw-bold text-muted">{{ i + 1 }}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="bg-light rounded p-2 me-3 text-primary">
                            <FileText :size="20" />
                        </div>
                        <span class="fw-medium">{{ req.nombre }}</span>
                    </div>
                </td>
                <td class="text-center">
                  <button class="btn btn-sm btn-outline-warning me-2" @click="openModal(req)" title="Editar">
                    <Pencil :size="16" />
                  </button>
                  <button class="btn btn-sm btn-outline-danger" @click="handleDelete(req.id, req.nombre)" title="Eliminar">
                    <Trash :size="16" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="modal fade" id="requisitoModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title fw-bold">{{ modalTitle }}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" :disabled="saving"></button>
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

  </div>
</template>

<style scoped>
/* Pequeño ajuste para que el icono del archivo se vea centrado y bonito */
.bg-light {
    background-color: #f8f9fa !important;
}
</style>