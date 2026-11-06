<script setup>
// Crear / editar la reunión de una jornada (la misma fila de reunions que se ve
// en el calendario). Al crear, la reunión aparece en el calendario.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Modal } from 'bootstrap'
import { CalendarPlus } from 'lucide-vue-next'
import AppButton from '@/components/AppButton.vue'
import { showAlerta } from '@/funciones'
import { useReunionesStore } from '@/stores/reunions'
import { useParroquiaStore } from '@/stores/parroquia'
import { useCategoriasReunionStore } from '@/stores/categoriasReunion'
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn'
import { partesFecha } from '@/lib/cronograma'

const emit = defineEmits(['guardado'])

const reunionesStore = useReunionesStore()
const parroquiaStore = useParroquiaStore()
const categoriasStore = useCategoriasReunionStore()

const modalEl = ref(null)
let modal = null
let detachFocus = () => {}

const editando = ref(false)
const bloquearHora = ref(false)
const saving = ref(false)
const form = ref({ id: null, nombre_tema: '', fecha: '', hora: '08:00', tipo: '', categoria_id: null, descripcion: '' })

const tipos = computed(() => parroquiaStore.tiposReunion)
const categorias = computed(() => categoriasStore.activas.filter((c) => c.permite_cronograma))

function open(reunion = null, { horaFijadaPorClave = false } = {}) {
  editando.value = !!reunion
  bloquearHora.value = !!reunion && horaFijadaPorClave
  const p = reunion ? partesFecha(reunion.fecha) : { fecha: new Date().toLocaleDateString('en-CA'), hora: '08:00' }
  form.value = {
    id: reunion?.id ?? null,
    nombre_tema: reunion?.nombre_tema ?? '',
    fecha: p.fecha,
    hora: p.hora,
    tipo: reunion?.tipo ?? tipos.value[0] ?? 'Confirmandos',
    categoria_id: reunion?.categoria_id ?? categorias.value[0]?.id ?? null,
    descripcion: reunion?.descripcion ?? '',
  }
  modal?.show()
}

defineExpose({ open })

async function guardar() {
  if (saving.value) return
  const f = form.value
  if (!f.nombre_tema.trim() || !f.fecha || !f.hora) {
    showAlerta('Nombre, fecha y hora son obligatorios', 'warning')
    return
  }
  if (!f.categoria_id) {
    showAlerta('Elige una categoría con cronograma (por ejemplo, Jornada o Retiro).', 'warning')
    return
  }
  // Misma regla que el calendario: no se agenda en fechas pasadas (editar sí).
  if (!editando.value && f.fecha < new Date().toLocaleDateString('en-CA')) {
    showAlerta('No puedes agendar actividades en fechas pasadas.', 'warning')
    return
  }

  const payload = {
    nombre_tema: f.nombre_tema.trim(),
    fecha: `${f.fecha} ${f.hora}`,
    descripcion: f.descripcion?.trim() || null,
    tipo: tipos.value.length === 1 ? tipos.value[0] : f.tipo,
    categoria_id: f.categoria_id,
  }
  saving.value = true
  try {
    const guardada = editando.value
      ? await reunionesStore.save(f.id, payload)
      : await reunionesStore.add(payload)
    modal?.hide()
    categoriasStore.refrescarHayJornadas()
    emit('guardado', guardada, { creada: !editando.value })
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (!modalEl.value) return
  modal = new Modal(modalEl.value)
  detachFocus = attachModalFocusReturn(modalEl.value)
})
onUnmounted(() => {
  detachFocus()
  modal?.dispose()
})
</script>

<template>
  <div ref="modalEl" class="modal fade" tabindex="-1" aria-hidden="true" aria-labelledby="jornadaFormTitulo" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-header__icon" aria-hidden="true"><CalendarPlus :size="18" /></span>
          <div class="modal-header__text">
            <h5 id="jornadaFormTitulo" class="modal-title">{{ editando ? 'Editar jornada' : 'Nueva jornada' }}</h5>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="guardar">
            <div class="mb-3">
              <label class="form-label" for="jf-nombre">Nombre <span class="text-danger">*</span></label>
              <input id="jf-nombre" v-model="form.nombre_tema" type="text" class="form-control" maxlength="255"
                placeholder="Ej. Retiro de confirmación" required :disabled="saving">
            </div>
            <div class="row">
              <div class="col-6 mb-3">
                <label class="form-label" for="jf-fecha">Fecha <span class="text-danger">*</span></label>
                <input id="jf-fecha" v-model="form.fecha" type="date" class="form-control" required :disabled="saving">
              </div>
              <div class="col-6 mb-3">
                <label class="form-label" for="jf-hora">Hora de inicio <span class="text-danger">*</span></label>
                <input id="jf-hora" v-model="form.hora" type="time" class="form-control" required
                  :disabled="saving || bloquearHora" :aria-describedby="bloquearHora ? 'jf-nota-clave' : undefined">
              </div>
            </div>
            <p v-if="bloquearHora" id="jf-nota-clave" class="nota-clave">
              La hora de inicio la define el momento clave. Cambia su hora en el cronograma o quítalo para editar el inicio.
            </p>
            <div class="row">
              <div class="col-sm-6 mb-3">
                <label class="form-label" for="jf-categoria">Categoría</label>
                <select id="jf-categoria" v-model="form.categoria_id" class="form-select" :disabled="saving">
                  <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nombre }}</option>
                </select>
              </div>
              <div v-if="tipos.length > 1" class="col-sm-6 mb-3">
                <label class="form-label" for="jf-tipo">Asistentes</label>
                <select id="jf-tipo" v-model="form.tipo" class="form-select" :disabled="saving">
                  <option v-for="t in tipos" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="jf-desc">Descripción</label>
              <textarea id="jf-desc" v-model="form.descripcion" class="form-control" rows="2" :disabled="saving"></textarea>
            </div>
            <div class="d-flex justify-content-end gap-2">
              <AppButton variant="secondary" data-bs-dismiss="modal" :disabled="saving">Cancelar</AppButton>
              <AppButton type="submit" :loading="saving">{{ editando ? 'Guardar' : 'Crear' }}</AppButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nota-clave {
  margin: -0.25rem 0 1rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, #f59e0b 14%, var(--surface));
  color: var(--text);
  font-size: var(--fs-ui);
}
</style>
