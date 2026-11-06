<script setup>
// Crear / editar un momento. Sin duración, el momento va a "Sin hora definida".
// Promesa: open() resuelve con los datos del formulario, o null si se cancela.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Modal } from 'bootstrap'
import { ListPlus, Search } from 'lucide-vue-next'
import AppButton from '@/components/AppButton.vue'
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn'
import { DURACIONES_RAPIDAS } from '@/lib/cronograma'

const props = defineProps({
  // [{ id, name }] catequistas y coordinadores activos.
  personas: { type: Array, default: () => [] },
})

const modalEl = ref(null)
let modal = null
let detachFocus = () => {}
let resolver = null
let resultado = null

const editando = ref(false)
const form = ref({ nombre: '', duracion_min: '', detalle: '', responsables: [] })
const filtro = ref('')

const personasFiltradas = computed(() => {
  const q = filtro.value.trim().toLowerCase()
  return q ? props.personas.filter((p) => p.name.toLowerCase().includes(q)) : props.personas
})

function open(momento = null) {
  editando.value = !!momento
  filtro.value = ''
  resultado = null
  form.value = {
    nombre: momento?.nombre ?? '',
    duracion_min: momento?.duracion_min ?? '',
    detalle: momento?.detalle ?? '',
    responsables: [...(momento?.responsables ?? [])],
  }
  modal?.show()
  return new Promise((resolve) => { resolver = resolve })
}

defineExpose({ open })

function enviar() {
  if (!form.value.nombre.trim()) return
  resultado = { ...form.value, nombre: form.value.nombre.trim() }
  modal?.hide()
}

function alCerrar() {
  resolver?.(resultado)
  resolver = null
}

onMounted(() => {
  if (!modalEl.value) return
  modal = new Modal(modalEl.value)
  detachFocus = attachModalFocusReturn(modalEl.value)
  modalEl.value.addEventListener('hidden.bs.modal', alCerrar)
  modalEl.value.addEventListener('shown.bs.modal', () => modalEl.value?.querySelector('#mm-nombre')?.focus())
})
onUnmounted(() => {
  modalEl.value?.removeEventListener('hidden.bs.modal', alCerrar)
  detachFocus()
  modal?.dispose()
})
</script>

<template>
  <div ref="modalEl" class="modal fade" tabindex="-1" aria-hidden="true" aria-labelledby="momentoTitulo">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-header__icon" aria-hidden="true"><ListPlus :size="18" /></span>
          <div class="modal-header__text">
            <h5 id="momentoTitulo" class="modal-title">{{ editando ? 'Editar momento' : 'Nuevo momento' }}</h5>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>
        <form class="mm-form" @submit.prevent="enviar">
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label" for="mm-nombre">Nombre <span class="text-danger">*</span></label>
              <input id="mm-nombre" v-model="form.nombre" class="form-control" maxlength="120" required
                autocomplete="off" placeholder="Ej. Catequesis 1">
            </div>
            <div class="mb-3">
              <label class="form-label" for="mm-duracion">Duración en minutos <span class="text-muted">(vacío = sin hora definida)</span></label>
              <input id="mm-duracion" v-model="form.duracion_min" type="number" min="1" max="1440" step="1"
                inputmode="numeric" class="form-control" placeholder="30">
              <div class="chips mt-2" role="group" aria-label="Duraciones rápidas">
                <button v-for="d in DURACIONES_RAPIDAS" :key="d" type="button" class="chip"
                  :class="{ 'chip--on': Number(form.duracion_min) === d }" @click="form.duracion_min = d">{{ d }}</button>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="mm-detalle">Detalle <span class="text-muted">(opcional)</span></label>
              <textarea id="mm-detalle" v-model="form.detalle" class="form-control" rows="3" maxlength="2000"></textarea>
            </div>
            <fieldset class="mb-1">
              <legend class="form-label fs-6">Responsables <span class="text-muted">(opcional, puedes elegir varios)</span></legend>
              <p v-if="!personas.length" class="text-muted small mb-0">No hay catequistas ni coordinadores activos.</p>
              <template v-else>
                <div v-if="personas.length > 8" class="buscar mb-2">
                  <Search :size="14" aria-hidden="true" />
                  <input v-model="filtro" type="search" class="form-control form-control-sm" placeholder="Buscar persona"
                    aria-label="Buscar responsable">
                </div>
                <div class="personas">
                  <label v-for="p in personasFiltradas" :key="p.id" class="persona">
                    <input v-model="form.responsables" type="checkbox" class="form-check-input" :value="p.id">
                    <span>{{ p.name }}</span>
                  </label>
                </div>
              </template>
            </fieldset>
            <p v-if="!editando" class="text-muted small mt-2 mb-0">
              {{ form.duracion_min ? 'Se agrega al final del cronograma.' : 'Se agrega a "Sin hora definida".' }}
            </p>
          </div>
          <div class="modal-footer">
            <AppButton variant="secondary" data-bs-dismiss="modal">Cancelar</AppButton>
            <AppButton type="submit">{{ editando ? 'Guardar' : 'Agregar' }}</AppButton>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* modal-dialog-scrollable espera .modal-body como hijo directo de .modal-content;
   el <form> intermedio debe actuar de columna flexible para que el cuerpo haga
   scroll y el pie (Cancelar / Agregar) quede siempre visible. */
.mm-form {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
.mm-form > .modal-body { overflow-y: auto; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chip {
  min-width: 2.75rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text);
  font-size: var(--fs-ui);
  font-weight: 600;
}
.chip:hover { background: var(--surface-sunken); }
.chip--on { background: var(--accent); border-color: var(--accent); color: #fff; }
.chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.buscar { position: relative; }
.buscar > svg { position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
.buscar input { padding-left: 1.9rem; }
.personas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 0.25rem 0.75rem;
  max-height: 14rem;
  overflow-y: auto;
  padding: 0.5rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}
.persona { display: flex; align-items: center; gap: 0.5rem; font-size: var(--fs-ui); cursor: pointer; }
.persona .form-check-input { margin: 0; flex-shrink: 0; }
</style>
