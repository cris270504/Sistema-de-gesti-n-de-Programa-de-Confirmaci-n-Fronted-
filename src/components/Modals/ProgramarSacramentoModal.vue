<script setup>
import AppButton from '@/components/AppButton.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { Modal } from 'bootstrap'
import { CalendarPlus, Search, Users, Check } from 'lucide-vue-next'
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn'
import { useSacramentosStore } from '@/stores/sacramentos'
import { useParroquiaStore } from '@/stores/parroquia'
import { useProgramacionesSacramentoStore } from '@/stores/programacionesSacramento'
import { getConteoElegibles, getElegibles, getProgramacionById, ORDEN_CLAVE } from '@/services/programacionesSacramento'
import { ahoraEnZona } from '@/services/reunions'
import { sacramentoUi, normalizarBusqueda } from '@/lib/sacramentosUi'
import { showAlerta } from '@/funciones'

const emit = defineEmits(['saved'])

const modalRef = ref(null)
let modal = null
let detachFocusReturn = () => {}

const sacramentosStore = useSacramentosStore()
const parroquiaStore = useParroquiaStore()
const programacionesStore = useProgramacionesSacramentoStore()
const { items: sacramentosRaw } = storeToRefs(sacramentosStore)

const PASOS = ['Sacramento', 'Jóvenes', 'Fecha y hora']

const paso = ref(1)
const editId = ref(null)
const sacramentoId = ref(null)
const conteos = ref({})
const elegibles = ref([])
const cargandoElegibles = ref(false)
// { [confirmando_id]: [ids de sacramentos anteriores incluidos] }
const seleccion = ref({})
const busqueda = ref('')
const grupoFiltro = ref('todos')
const fecha = ref('')
const hora = ref('09:00')
const saving = ref(false)

const sacramentos = computed(() =>
  sacramentosRaw.value
    .filter((s) => ORDEN_CLAVE[s.clave])
    .sort((a, b) => ORDEN_CLAVE[a.clave] - ORDEN_CLAVE[b.clave]))

const sacramento = computed(() => sacramentos.value.find((s) => s.id === sacramentoId.value) ?? null)
const personaPlural = computed(() => (parroquiaStore.personaLabelPlural || 'jóvenes').toLowerCase())

onMounted(() => {
  modal = new Modal(modalRef.value)
  detachFocusReturn = attachModalFocusReturn(modalRef.value)
})

onUnmounted(() => {
  detachFocusReturn()
  modal?.dispose()
})

function reset() {
  paso.value = 1
  editId.value = null
  sacramentoId.value = null
  elegibles.value = []
  seleccion.value = {}
  busqueda.value = ''
  grupoFiltro.value = 'todos'
  fecha.value = ahoraEnZona(parroquiaStore.zonaHoraria).slice(0, 10)
  hora.value = '09:00'
}

// open() → nueva celebración; open({ programacionId }) → editar una existente.
async function open({ programacionId = null } = {}) {
  reset()
  modal.show()
  sacramentosStore.fetchAll()

  if (programacionId) {
    try {
      const prog = await getProgramacionById(programacionId)
      editId.value = prog.id
      sacramentoId.value = prog.sacramento_id
      const [d, t = '09:00'] = prog.fecha.replace('T', ' ').split(' ')
      fecha.value = d
      hora.value = t.slice(0, 5)
      paso.value = 2
      await cargarElegibles()
    } catch (e) {
      showAlerta(e?.message || 'No se pudo abrir la celebración', 'error')
      modal.hide()
    }
    return
  }

  try {
    conteos.value = await getConteoElegibles()
  } catch {
    conteos.value = {}
  }
}

defineExpose({ open })

async function cargarElegibles() {
  cargandoElegibles.value = true
  try {
    elegibles.value = await getElegibles(sacramentoId.value, editId.value)
    // Al editar, vienen marcados los que ya estaban en la celebración.
    seleccion.value = Object.fromEntries(
      elegibles.value
        .filter((e) => e.seleccionado)
        .map((e) => [e.confirmando_id, e.anteriores.filter((a) => a.incluido).map((a) => a.id)]),
    )
  } catch (e) {
    elegibles.value = []
    showAlerta(e?.message || 'No se pudo cargar la lista de jóvenes', 'error')
  } finally {
    cargandoElegibles.value = false
  }
}

// ── Paso 2: selección ────────────────────────────────────────────────────
const grupos = computed(() => {
  const mapa = new Map()
  for (const e of elegibles.value) {
    if (e.grupo_id) mapa.set(e.grupo_id, e.grupo_nombre)
  }
  return [...mapa].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'))
})

const filtrados = computed(() => {
  const q = normalizarBusqueda(busqueda.value)
  return elegibles.value.filter((e) => {
    if (grupoFiltro.value === 'sin_grupo' && e.grupo_id) return false
    if (grupoFiltro.value !== 'todos' && grupoFiltro.value !== 'sin_grupo' && e.grupo_id !== Number(grupoFiltro.value)) return false
    if (!q) return true
    return (e.nombre_busqueda ?? normalizarBusqueda(`${e.nombres} ${e.apellidos}`)).includes(q)
  })
})

const estaSeleccionado = (e) => Object.hasOwn(seleccion.value, e.confirmando_id)
const totalSeleccionados = computed(() => Object.keys(seleccion.value).length)
const todosFiltradosMarcados = computed(() =>
  filtrados.value.length > 0 && filtrados.value.every(estaSeleccionado))

function toggleJoven(e) {
  if (saving.value) return
  const copia = { ...seleccion.value }
  if (estaSeleccionado(e)) delete copia[e.confirmando_id]
  // "Incluir también …" arranca marcado: el caso habitual es recibirlos juntos.
  else copia[e.confirmando_id] = e.anteriores.map((a) => a.id)
  seleccion.value = copia
}

function toggleTodos() {
  const copia = { ...seleccion.value }
  if (todosFiltradosMarcados.value) {
    for (const e of filtrados.value) delete copia[e.confirmando_id]
  } else {
    for (const e of filtrados.value) {
      if (!Object.hasOwn(copia, e.confirmando_id)) copia[e.confirmando_id] = e.anteriores.map((a) => a.id)
    }
  }
  seleccion.value = copia
}

const incluyeAnterior = (e, a) => (seleccion.value[e.confirmando_id] ?? []).includes(a.id)

function toggleAnterior(e, a) {
  const actuales = seleccion.value[e.confirmando_id] ?? []
  seleccion.value = {
    ...seleccion.value,
    [e.confirmando_id]: actuales.includes(a.id) ? actuales.filter((id) => id !== a.id) : [...actuales, a.id],
  }
}

// ── Paso 3: resumen ──────────────────────────────────────────────────────
const resumenAnteriores = computed(() => {
  const cuenta = new Map()
  for (const e of elegibles.value) {
    for (const a of e.anteriores) {
      if (incluyeAnterior(e, a)) cuenta.set(a.nombre, (cuenta.get(a.nombre) ?? 0) + 1)
    }
  }
  return [...cuenta].map(([nombre, total]) => ({ nombre, total }))
})

const fechaHora = computed(() => (fecha.value && hora.value ? `${fecha.value} ${hora.value}` : ''))
const esFutura = computed(() =>
  fechaHora.value && fechaHora.value.replace(' ', 'T') > ahoraEnZona(parroquiaStore.zonaHoraria).slice(0, 16))

// ── Navegación ───────────────────────────────────────────────────────────
const puedeAvanzar = computed(() => {
  if (paso.value === 1) return !!sacramentoId.value
  if (paso.value === 2) return totalSeleccionados.value > 0
  return !!fechaHora.value && esFutura.value
})

async function elegirSacramento(s) {
  if (editId.value) return
  if (sacramentoId.value !== s.id) {
    sacramentoId.value = s.id
    seleccion.value = {}
    elegibles.value = []
  }
}

async function siguiente() {
  if (!puedeAvanzar.value) return
  if (paso.value === 1) {
    paso.value = 2
    if (elegibles.value.length === 0) await cargarElegibles()
  } else if (paso.value === 2) {
    paso.value = 3
  }
  await nextTick()
  modalRef.value?.querySelector('.modal-body')?.scrollTo?.({ top: 0 })
}

function atras() {
  if (paso.value > (editId.value ? 2 : 1)) paso.value -= 1
}

async function guardar() {
  if (saving.value) return
  if (!esFutura.value) {
    showAlerta('La fecha y la hora deben ser posteriores a este momento.', 'warning')
    return
  }
  saving.value = true
  try {
    const id = await programacionesStore.programar({
      id: editId.value,
      sacramentoId: sacramentoId.value,
      fecha: fechaHora.value,
      items: Object.entries(seleccion.value).map(([confirmando_id, anteriores]) => ({
        confirmando_id: Number(confirmando_id),
        sacramento_ids: [sacramentoId.value, ...anteriores],
      })),
    })
    emit('saved', id)
    modal.hide()
  } catch {
    // El store ya mostró el motivo.
  } finally {
    saving.value = false
  }
}

const textoConteo = (s) => {
  const n = conteos.value[s.id]
  if (n === undefined) return ''
  if (n === 0) return 'Nadie lo tiene pendiente'
  return n === 1 ? '1 lo tiene pendiente' : `${n} lo tienen pendiente`
}
</script>

<template>
  <div class="modal fade" ref="modalRef" tabindex="-1" aria-hidden="true" aria-labelledby="programarSacramentoTitulo"
    data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg modal-fullscreen-sm-down">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-header__icon" aria-hidden="true"><CalendarPlus :size="18" /></span>
          <div class="modal-header__text">
            <h5 id="programarSacramentoTitulo" class="modal-title">
              {{ editId ? 'Editar celebración' : 'Programar sacramento' }}
            </h5>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar" :disabled="saving"></button>
        </div>

        <!-- El relleno va en el contenedor: main.css fuerza padding/margin 0 en todo <ol>. -->
        <div class="ps-pasos">
          <ol class="ps-pasos__lista" aria-label="Pasos">
            <li v-for="(nombre, i) in PASOS" :key="nombre" class="ps-paso"
              :class="{ 'is-actual': paso === i + 1, 'is-hecho': paso > i + 1 }"
              :aria-current="paso === i + 1 ? 'step' : undefined">
              <span class="ps-paso__num" aria-hidden="true">
                <Check v-if="paso > i + 1" :size="12" :stroke-width="3" />
                <template v-else>{{ i + 1 }}</template>
              </span>
              <span class="ps-paso__nombre">{{ nombre }}</span>
            </li>
          </ol>
        </div>

        <div class="modal-body">
          <!-- Paso 1: sacramento -->
          <fieldset v-if="paso === 1" class="ps-sacramentos">
            <legend class="ps-legend">¿Qué sacramento se celebrará?</legend>
            <label v-for="s in sacramentos" :key="s.id" class="ps-sac"
              :class="{ 'is-elegido': sacramentoId === s.id }"
              :style="{ '--sac': sacramentoUi(s.clave).color }">
              <input type="radio" name="sacramento" class="visually-hidden" :value="s.id"
                :checked="sacramentoId === s.id" @change="elegirSacramento(s)">
              <span class="ps-sac__icono" aria-hidden="true">
                <component :is="sacramentoUi(s.clave).icon" :size="30" :stroke-width="1.6" />
              </span>
              <span class="ps-sac__nombre">{{ s.nombre }}</span>
              <span class="ps-sac__conteo">{{ textoConteo(s) }}</span>
            </label>
            <AppEmpty v-if="sacramentos.length === 0" compact :icon="CalendarPlus"
              message="Esta parroquia aún no tiene Bautismo, Primera Comunión ni Confirmación en su ruta sacramental." />
          </fieldset>

          <!-- Paso 2: jóvenes -->
          <div v-else-if="paso === 2">
            <p class="ps-contexto" :style="{ '--sac': sacramentoUi(sacramento?.clave).color }">
              <component :is="sacramentoUi(sacramento?.clave).icon" :size="16" aria-hidden="true" />
              Activos que tienen pendiente <strong>{{ sacramento?.nombre }}</strong>
            </p>

            <div class="ps-filtros">
              <div class="input-group">
                <span class="input-group-text"><Search :size="16" aria-hidden="true" /></span>
                <input v-model="busqueda" type="search" class="form-control" placeholder="Buscar por nombre"
                  aria-label="Buscar por nombre">
              </div>
              <select v-if="grupos.length > 0" v-model="grupoFiltro" class="form-select ps-filtros__grupo"
                aria-label="Filtrar por grupo">
                <option value="todos">Todos los grupos</option>
                <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
                <option value="sin_grupo">Sin grupo</option>
              </select>
            </div>

            <div v-if="cargandoElegibles" class="ps-cargando" role="status">Cargando lista…</div>

            <AppEmpty v-else-if="elegibles.length === 0" compact :icon="Users"
              :message="`Nadie tiene pendiente ${sacramento?.nombre ?? 'este sacramento'}.`" />

            <template v-else>
              <label class="ps-todos">
                <input class="form-check-input" type="checkbox" :checked="todosFiltradosMarcados"
                  :disabled="filtrados.length === 0" @change="toggleTodos">
                Seleccionar {{ busqueda || grupoFiltro !== 'todos' ? 'los filtrados' : 'todos' }} ({{ filtrados.length }})
              </label>

              <ul class="ps-lista">
                <li v-for="e in filtrados" :key="e.confirmando_id" class="ps-joven"
                  :class="{ 'is-elegido': estaSeleccionado(e) }">
                  <label class="ps-joven__fila">
                    <input class="form-check-input" type="checkbox" :checked="estaSeleccionado(e)"
                      :disabled="saving" @change="toggleJoven(e)">
                    <span class="ps-joven__nombre">{{ e.apellidos }}, {{ e.nombres }}</span>
                    <span class="ps-joven__grupo">{{ e.grupo_nombre || 'Sin grupo' }}</span>
                  </label>

                  <template v-if="e.anteriores.length">
                    <div v-if="estaSeleccionado(e)" class="ps-joven__anteriores">
                      <label v-for="a in e.anteriores" :key="a.id" class="ps-anterior"
                        :style="{ '--sac': sacramentoUi(a.clave).color }">
                        <input class="form-check-input" type="checkbox" :checked="incluyeAnterior(e, a)"
                          :disabled="saving" @change="toggleAnterior(e, a)">
                        Incluir también {{ a.nombre }}
                        <span class="ps-anterior__nota">(le falta)</span>
                      </label>
                    </div>
                    <p v-else class="ps-joven__falta">
                      Le falta {{ e.anteriores.map((a) => a.nombre).join(' y ') }}
                    </p>
                  </template>
                </li>
                <li v-if="filtrados.length === 0" class="ps-sin-resultados">Nadie coincide con la búsqueda.</li>
              </ul>
            </template>
          </div>

          <!-- Paso 3: fecha y hora -->
          <div v-else>
            <div class="row g-3">
              <div class="col-sm-6">
                <label for="psFecha" class="form-label">Fecha</label>
                <input id="psFecha" v-model="fecha" type="date" class="form-control" required :disabled="saving">
              </div>
              <div class="col-sm-6">
                <label for="psHora" class="form-label">Hora</label>
                <input id="psHora" v-model="hora" type="time" class="form-control" required :disabled="saving">
              </div>
            </div>
            <p v-if="fechaHora && !esFutura" class="ps-aviso" role="alert">
              Elige una fecha y hora posteriores a este momento.
            </p>

            <section class="ps-resumen" :style="{ '--sac': sacramentoUi(sacramento?.clave).color }"
              aria-label="Resumen">
              <span class="ps-resumen__icono" aria-hidden="true">
                <component :is="sacramentoUi(sacramento?.clave).icon" :size="22" :stroke-width="1.7" />
              </span>
              <div>
                <p class="ps-resumen__titulo">{{ sacramento?.nombre }}</p>
                <p class="ps-resumen__detalle">
                  {{ totalSeleccionados }} {{ totalSeleccionados === 1 ? 'joven' : personaPlural }}
                  <template v-for="r in resumenAnteriores" :key="r.nombre">
                    <br>{{ r.total }} también {{ r.total === 1 ? 'recibe' : 'reciben' }} {{ r.nombre }}
                  </template>
                </p>
              </div>
            </section>
          </div>
        </div>

        <div class="modal-footer">
          <span v-if="paso >= 2 && totalSeleccionados > 0" class="modal-footer__note">
            {{ totalSeleccionados }} {{ totalSeleccionados === 1 ? 'seleccionado' : 'seleccionados' }}
          </span>
          <AppButton v-if="paso > (editId ? 2 : 1)" variant="secondary" :disabled="saving" @click="atras">Atrás</AppButton>
          <AppButton v-else variant="secondary" data-bs-dismiss="modal" :disabled="saving">Cancelar</AppButton>
          <AppButton v-if="paso < 3" :disabled="!puedeAvanzar" @click="siguiente">Siguiente</AppButton>
          <AppButton v-else :loading="saving" :disabled="!puedeAvanzar" @click="guardar">
            {{ editId ? 'Guardar cambios' : 'Programar sacramento' }}
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Pasos ─────────────────────────────────────────────────────────────── */
.ps-pasos {
  display: flex;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--line);
  background: var(--surface-sunken);
}
.ps-pasos__lista {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  max-width: 36rem;
}
.ps-paso {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  color: var(--text-muted);
  font-size: var(--fs-sm);
}
/* El último paso no lleva conector: sin flex:1 no deja un hueco a la derecha. */
.ps-paso:last-child { flex: none; }
.ps-paso:not(:last-child)::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--line-strong);
}
.ps-paso__num {
  display: inline-grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  flex: none;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-strong);
  font-weight: var(--fw-semibold);
  font-size: var(--fs-xs);
}
.ps-paso.is-actual { color: var(--text); font-weight: var(--fw-semibold); }
.ps-paso.is-actual .ps-paso__num,
.ps-paso.is-hecho .ps-paso__num {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

/* ── Paso 1: las tres fichas ──────────────────────────────────────────── */
.ps-sacramentos {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.875rem;
  margin: 0;
  padding: 0;
  border: 0;
}
.ps-legend {
  grid-column: 1 / -1;
  float: none;
  margin-bottom: 0.25rem;
  font-size: var(--fs-base);
  font-weight: var(--fw-semibold);
  color: var(--text);
}
.ps-sac {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
  min-height: 9.5rem;
  padding: 1.125rem 1rem 1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  cursor: pointer;
  overflow: hidden;
  transition: border-color var(--dur) var(--ease), background-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
/* Franja del color litúrgico: se llena al elegir la ficha. */
.ps-sac::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  background: var(--sac);
  transform-origin: left;
  transform: scaleX(0.18);
  transition: transform var(--dur) var(--ease);
}
.ps-sac:hover { border-color: var(--line-strong); }
.ps-sac:has(input:focus-visible) { box-shadow: 0 0 0 3px var(--accent-ring); }
.ps-sac.is-elegido {
  border-color: var(--sac);
  background: color-mix(in srgb, var(--sac) 7%, var(--surface));
}
.ps-sac.is-elegido::before { transform: scaleX(1); }
.ps-sac__icono { color: var(--sac); margin-bottom: auto; }
.ps-sac__nombre {
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  line-height: 1.2;
  color: var(--text);
}
.ps-sac__conteo { font-size: var(--fs-sm); color: var(--text-muted); }

/* ── Paso 2 ───────────────────────────────────────────────────────────── */
.ps-contexto {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.875rem;
  color: var(--text-muted);
  font-size: var(--fs-ui);
}
.ps-contexto svg { color: var(--sac) !important; }
.ps-contexto strong { color: var(--text); }
.ps-filtros { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
.ps-filtros__grupo { max-width: 14rem; }
.ps-cargando { padding: 2rem 0; text-align: center; color: var(--text-muted); }
.ps-todos {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  font-size: var(--fs-sm);
  color: var(--text-muted);
  cursor: pointer;
}
.ps-lista {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}
.ps-joven + .ps-joven { border-top: 1px solid var(--line); }
.ps-joven.is-elegido { background: var(--accent-soft); }
.ps-joven__fila {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem;
  cursor: pointer;
}
.ps-joven__nombre { flex: 1; min-width: 0; font-weight: var(--fw-medium); color: var(--text); }
.ps-joven__grupo { font-size: var(--fs-sm); color: var(--text-muted); text-align: right; }
.ps-joven__anteriores { display: grid; gap: 0.25rem; padding: 0 0.75rem 0.625rem 2.375rem; }
.ps-anterior {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--fs-sm);
  color: var(--text);
  cursor: pointer;
}
.ps-anterior .form-check-input:checked { background-color: var(--sac); border-color: var(--sac); }
.ps-anterior__nota { color: var(--text-muted); }
.ps-joven__falta { margin: 0; padding: 0 0.75rem 0.625rem 2.375rem; font-size: var(--fs-sm); color: var(--text-muted); }
.ps-sin-resultados { padding: 1rem; text-align: center; color: var(--text-muted); font-size: var(--fs-ui); }

/* ── Paso 3 ───────────────────────────────────────────────────────────── */
.ps-aviso { margin: 0.5rem 0 0; font-size: var(--fs-sm); color: var(--danger); }
.ps-resumen {
  display: flex;
  gap: 0.875rem;
  margin-top: 1.5rem;
  padding: 1rem;
  border-left: 4px solid var(--sac);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--sac) 6%, var(--surface));
}
.ps-resumen__icono { color: var(--sac); }
.ps-resumen__titulo { margin: 0; font-weight: var(--fw-semibold); color: var(--text); }
.ps-resumen__detalle { margin: 0.125rem 0 0; font-size: var(--fs-ui); color: var(--text-muted); }

@media (max-width: 575.98px) {
  .ps-pasos { padding: 0.625rem 1rem; }
  .ps-paso__nombre { display: none; }
  .ps-paso.is-actual .ps-paso__nombre { display: inline; }
  .ps-sacramentos { grid-template-columns: 1fr; }
  .ps-sac { min-height: 0; flex-direction: row; flex-wrap: wrap; align-items: center; column-gap: 0.875rem; }
  .ps-sac__icono { margin-bottom: 0; }
  .ps-sac__conteo { flex-basis: 100%; padding-left: calc(30px + 0.875rem); margin-top: -0.25rem; }
  .ps-filtros { flex-direction: column; }
  .ps-filtros__grupo { max-width: none; }
}

@media (prefers-reduced-motion: reduce) {
  .ps-sac, .ps-sac::before { transition: none; }
}
</style>
