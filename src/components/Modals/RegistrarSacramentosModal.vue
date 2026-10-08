<script setup>
import AppButton from '@/components/AppButton.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Modal } from 'bootstrap'
import { ClipboardCheck, Pencil, Users, XCircle } from 'lucide-vue-next'
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn'
import { useAuthStore } from '@/stores/auth'
import { useParroquiaStore } from '@/stores/parroquia'
import { useProgramacionesSacramentoStore } from '@/stores/programacionesSacramento'
import { getProgramacionById } from '@/services/programacionesSacramento'
import { ahoraEnZona } from '@/services/reunions'
import { sacramentoUi, formatearFechaCelebracion } from '@/lib/sacramentosUi'
import { showAlerta } from '@/funciones'

const emit = defineEmits(['editar', 'closed'])

const modalRef = ref(null)
let modal = null
let detachFocusReturn = () => {}

const authStore = useAuthStore()
const parroquiaStore = useParroquiaStore()
const store = useProgramacionesSacramentoStore()

const prog = ref(null)
const cargando = ref(false)
const saving = ref(false)
// { 'confirmandoId-sacramentoId': boolean }
const marcas = ref({})

const clave = (cid, sid) => `${cid}-${sid}`

onMounted(() => {
  modal = new Modal(modalRef.value)
  detachFocusReturn = attachModalFocusReturn(modalRef.value)
  modalRef.value.addEventListener('hidden.bs.modal', () => emit('closed'))
})

onUnmounted(() => {
  detachFocusReturn()
  modal?.dispose()
})

async function open(id) {
  prog.value = null
  marcas.value = {}
  modal.show()
  cargando.value = true
  try {
    prog.value = await getProgramacionById(id)
    // Sin registrar: arranca marcado (lo habitual es que asistan todos y se
    // desmarque a quien faltó).
    marcas.value = Object.fromEntries(
      prog.value.jovenes.flatMap((j) =>
        j.sacramentos.map((s) => [clave(j.confirmando_id, s.id), s.recibio ?? true])),
    )
  } catch (e) {
    showAlerta(e?.message || 'No se pudo abrir la celebración', 'error')
    modal.hide()
  } finally {
    cargando.value = false
  }
}

defineExpose({ open })

const ui = computed(() => sacramentoUi(prog.value?.sacramento?.clave))
const hoy = computed(() => ahoraEnZona(parroquiaStore.zonaHoraria).slice(0, 10))
const yaLlegoLaFecha = computed(() => !!prog.value && prog.value.fecha.slice(0, 10) <= hoy.value)

const puedeRegistrar = computed(() =>
  authStore.can('registrar sacramentos') && prog.value && prog.value.estado !== 'cancelada')
const puedeGestionar = computed(() =>
  authStore.can('programar sacramentos') && prog.value?.estado === 'programada')

const todasMarcadas = computed(() => Object.values(marcas.value).every(Boolean))
function marcarTodas() {
  const valor = !todasMarcadas.value
  marcas.value = Object.fromEntries(Object.keys(marcas.value).map((k) => [k, valor]))
}

const totalRecibieron = computed(() => {
  if (!prog.value) return 0
  return prog.value.jovenes.filter((j) => marcas.value[clave(j.confirmando_id, prog.value.sacramento_id)]).length
})

const ESTADOS = {
  programada: 'Programada',
  realizada: 'Registrada',
  cancelada: 'Cancelada',
}

async function guardar() {
  if (saving.value || !yaLlegoLaFecha.value) return
  saving.value = true
  try {
    const items = prog.value.jovenes.flatMap((j) =>
      j.sacramentos.map((s) => ({
        confirmando_id: j.confirmando_id,
        sacramento_id: s.id,
        recibio: !!marcas.value[clave(j.confirmando_id, s.id)],
      })))
    await store.registrar(prog.value.id, items)
    modal.hide()
  } catch {
    // El store ya mostró el motivo.
  } finally {
    saving.value = false
  }
}

async function cancelarCelebracion() {
  const ok = await store.cancelar(prog.value.id)
  if (ok) modal.hide()
}

function editar() {
  const id = prog.value.id
  modal.hide()
  emit('editar', id)
}
</script>

<template>
  <div class="modal fade" ref="modalRef" tabindex="-1" aria-hidden="true" aria-labelledby="registrarSacTitulo">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg modal-fullscreen-sm-down">
      <div class="modal-content" :style="{ '--sac': ui.color }">
        <div class="modal-header">
          <span class="modal-header__icon rs-icono" aria-hidden="true">
            <component :is="ui.icon" :size="18" />
          </span>
          <div class="modal-header__text">
            <h5 id="registrarSacTitulo" class="modal-title">{{ prog?.sacramento?.nombre ?? 'Celebración' }}</h5>
            <p v-if="prog" class="modal-subtitle mb-0 text-capitalize">{{ formatearFechaCelebracion(prog.fecha) }}</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar" :disabled="saving"></button>
        </div>

        <div class="modal-body">
          <div v-if="cargando" class="rs-cargando" role="status">Cargando celebración…</div>

          <template v-else-if="prog">
            <div class="rs-cabecera">
              <span class="rs-estado" :class="`rs-estado--${prog.estado}`">{{ ESTADOS[prog.estado] }}</span>
              <span class="rs-cuenta">
                {{ prog.total_jovenes }} {{ prog.total_jovenes === 1 ? 'joven' : 'jóvenes' }}
                <template v-if="puedeRegistrar && yaLlegoLaFecha">
                  ({{ totalRecibieron }} {{ totalRecibieron === 1 ? 'recibió' : 'recibieron' }} {{ prog.sacramento?.nombre }})
                </template>
              </span>
              <AppButton v-if="puedeRegistrar && yaLlegoLaFecha && prog.jovenes.length" variant="ghost" size="sm"
                class="ms-auto" @click="marcarTodas">
                {{ todasMarcadas ? 'Desmarcar todos' : 'Marcar todos' }}
              </AppButton>
            </div>

            <p v-if="puedeRegistrar && !yaLlegoLaFecha" class="rs-nota">
              Podrás registrar quién recibió el sacramento desde el
              {{ formatearFechaCelebracion(prog.fecha, { conHora: false }) }}.
            </p>

            <AppEmpty v-if="prog.jovenes.length === 0" compact :icon="Users"
              message="Esta celebración no tiene jóvenes." />

            <ul v-else class="rs-lista">
              <li v-for="j in prog.jovenes" :key="j.confirmando_id" class="rs-joven">
                <div class="rs-joven__datos">
                  <span class="rs-joven__nombre">
                    {{ j.confirmando ? `${j.confirmando.apellidos}, ${j.confirmando.nombres}` : 'Joven de otro grupo' }}
                  </span>
                  <span class="rs-joven__grupo">
                    {{ j.confirmando?.grupo?.nombre || 'Sin grupo' }}
                    <template v-if="j.confirmando?.estado === 'retirado'"> (retirado)</template>
                  </span>
                </div>
                <div class="rs-joven__sacramentos">
                  <template v-for="s in j.sacramentos" :key="s.id">
                    <label v-if="puedeRegistrar && yaLlegoLaFecha" class="rs-check"
                      :style="{ '--sac': sacramentoUi(s.clave).color }">
                      <input v-model="marcas[clave(j.confirmando_id, s.id)]" class="form-check-input" type="checkbox"
                        :disabled="saving">
                      Recibió {{ s.nombre }}
                    </label>
                    <span v-else class="rs-chip" :class="{ 'is-si': s.recibio === true, 'is-no': s.recibio === false }"
                      :style="{ '--sac': sacramentoUi(s.clave).color }">
                      {{ s.nombre }}<template v-if="s.recibio === true">: recibió</template><template
                        v-else-if="s.recibio === false">: no recibió</template>
                    </span>
                  </template>
                </div>
              </li>
            </ul>
          </template>
        </div>

        <div v-if="prog" class="modal-footer">
          <div v-if="puedeGestionar" class="d-flex gap-2 me-auto">
            <AppButton variant="soft-danger" size="sm" :icon="XCircle" :disabled="saving" @click="cancelarCelebracion">
              Cancelar celebración
            </AppButton>
            <AppButton variant="soft" size="sm" :icon="Pencil" :disabled="saving" @click="editar">Editar</AppButton>
          </div>
          <AppButton variant="secondary" data-bs-dismiss="modal" :disabled="saving">Cerrar</AppButton>
          <AppButton v-if="puedeRegistrar" :icon="ClipboardCheck" :loading="saving"
            :disabled="!yaLlegoLaFecha || prog.jovenes.length === 0" @click="guardar">
            {{ prog.estado === 'realizada' ? 'Guardar corrección' : 'Guardar registro' }}
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rs-icono :deep(svg) { color: var(--sac) !important; }
.rs-cargando { padding: 2rem 0; text-align: center; color: var(--text-muted); }
.rs-cabecera { display: flex; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
.rs-estado {
  padding: 0.125rem 0.625rem;
  border-radius: var(--radius-pill);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  background: var(--surface-sunken);
  color: var(--text-muted);
}
.rs-estado--programada { background: var(--accent-soft); color: var(--accent); }
.rs-estado--realizada { background: color-mix(in srgb, var(--success) 14%, transparent); color: var(--success); }
.rs-cuenta { font-size: var(--fs-ui); color: var(--text-muted); }
.rs-nota {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  background: var(--surface-sunken);
  font-size: var(--fs-ui);
  color: var(--text-muted);
}
.rs-lista { margin: 0; padding: 0; list-style: none; border: 1px solid var(--line); border-radius: var(--radius-md); }
.rs-joven {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.75rem;
}
.rs-joven + .rs-joven { border-top: 1px solid var(--line); }
.rs-joven__datos { display: flex; flex-direction: column; min-width: 0; }
.rs-joven__nombre { font-weight: var(--fw-medium); color: var(--text); }
.rs-joven__grupo { font-size: var(--fs-sm); color: var(--text-muted); }
.rs-joven__sacramentos { display: flex; flex-wrap: wrap; gap: 0.375rem 1rem; }
.rs-check { display: flex; align-items: center; gap: 0.5rem; font-size: var(--fs-ui); color: var(--text); cursor: pointer; }
.rs-check .form-check-input:checked { background-color: var(--sac); border-color: var(--sac); }
.rs-chip {
  padding: 0.125rem 0.625rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-pill);
  font-size: var(--fs-sm);
  color: var(--text-muted);
}
.rs-chip.is-si { border-color: var(--sac); color: var(--sac); }
.rs-chip.is-no { text-decoration: line-through; }
</style>
