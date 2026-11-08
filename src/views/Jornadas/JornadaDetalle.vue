<script setup>
// Editor del cronograma por momentos de una jornada (portado de la app local
// C:\dev\CRONOGRAMAS). Reglas:
// - Las horas se encadenan sin huecos desde la hora de la reunión.
// - Momento clave: su hora fija toda la cadena (antes y después). Marcarlo toma
//   su hora actual; quitarlo, borrarlo o moverlo a "Sin hora" conserva el inicio.
// - Sin duración → "Sin hora definida"; pasarlo al cronograma pide duración.
// La base de datos aplica estas reglas (triggers); aquí solo se muestran.
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sortable from 'sortablejs'
import Swal from 'sweetalert2'
import {
  ArrowLeft, CalendarDays, Clock, Copy, FileDown, FileText, GripVertical, Inbox, Pencil, Plus, Star, Trash, X,
} from 'lucide-vue-next'
import AppPage from '@/components/AppPage.vue'
import AppButton from '@/components/AppButton.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import JornadaFormModal from './JornadaFormModal.vue'
import MomentoModal from './MomentoModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useParroquiaStore } from '@/stores/parroquia'
import { useReunionesStore } from '@/stores/reunions'
import { useCategoriasReunionStore } from '@/stores/categoriasReunion'
import { confirmar, confirmarEliminacion, showAlerta } from '@/funciones'
import {
  createMomento, deleteMomento, duplicarJornada, getJornada, getResponsablesPosibles,
  ordenar, setClave, setClaveHora, setDuracion, updateMomento,
} from '@/services/jornadas'
import { calcular, duracionTexto, fechaLarga, fmt12, partesFecha, rango, toHHMM, toMin } from '@/lib/cronograma'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const parroquiaStore = useParroquiaStore()
const reunionesStore = useReunionesStore()
const categoriasStore = useCategoriasReunionStore()

const loading = ref(true)
const busy = ref(false)
const noEncontrada = ref(false)
const errorCarga = ref('')
const reunion = ref(null)
const momentos = ref([])
const personas = ref([])

const formRef = ref(null)
const momentoRef = ref(null)
const listaCrono = ref(null)
const listaSin = ref(null)
let sortables = []

const puedeEditar = computed(() => authStore.can('editar cronograma'))
const puedeEliminar = computed(() => authStore.can('eliminar cronograma'))
const puedeDuplicar = computed(() => authStore.can('crear cronograma') && puedeEditar.value)

const c = computed(() => calcular(reunion.value?.fecha, momentos.value))
const clave = computed(() => c.value.filas.find((f) => f.esClave) ?? null)
const permiteCronograma = computed(() => !!reunion.value?.categoria?.permite_cronograma)
const fechaTexto = computed(() => fechaLarga(partesFecha(reunion.value?.fecha).fecha))

const nombrePorId = computed(() => new Map(personas.value.map((p) => [p.id, p.name])))
const nombresDe = (ids) => (ids ?? []).map((id) => nombrePorId.value.get(id)).filter(Boolean).join(', ')

async function cargar() {
  const id = Number(route.params.id)
  try {
    const datos = await getJornada(id)
    reunion.value = datos.reunion
    momentos.value = datos.momentos
    noEncontrada.value = false
    errorCarga.value = ''
  } catch (e) {
    // PGRST116 = .single() sin filas → de verdad no existe (o no es de tu parroquia).
    // Cualquier otro fallo (red, permisos) no debe decir "se eliminó".
    if (e?.code === 'PGRST116') {
      noEncontrada.value = true
    } else {
      errorCarga.value = e?.message || 'No se pudo cargar la jornada.'
    }
  }
}

// Ejecuta un cambio, recarga y avisa. Si falla, recarga igual (revierte la vista).
async function accion(fn, okMsg) {
  if (busy.value) return
  busy.value = true
  try {
    const r = await fn()
    if (r === false) return
    await cargar()
    if (okMsg) showAlerta(okMsg, 'success')
  } catch (e) {
    showAlerta(e?.message || 'No se pudo guardar el cambio', 'error')
    await cargar()
  } finally {
    busy.value = false
  }
}

// ── Momentos ─────────────────────────────────────────────────────────────────
async function nuevoMomento() {
  const datos = await momentoRef.value?.open()
  if (!datos) return
  await accion(() => createMomento(reunion.value.id, datos),
    datos.duracion_min ? 'Momento agregado al final del cronograma' : 'Agregado a "Sin hora definida"')
}

async function editarMomento(m) {
  const datos = await momentoRef.value?.open(m)
  if (!datos) return
  await accion(() => updateMomento(m, datos), 'Momento actualizado')
}

async function borrarMomento(m) {
  if (!(await confirmarEliminacion(m.nombre))) return
  await accion(() => deleteMomento(m.id), 'Momento eliminado')
}

async function alternarClave(f) {
  await accion(() => setClave(reunion.value.id, f.esClave ? null : f.id),
    f.esClave ? 'Momento clave quitado' : 'Momento clave fijado: cambia su hora y todo se ajusta')
}

async function quitarClave() {
  await accion(() => setClave(reunion.value.id, null), 'Momento clave quitado')
}

async function cambiarHoraClave(e) {
  const v = e.target.value
  if (!v || !clave.value) return
  await accion(() => setClaveHora(clave.value.id, v), `Cronograma ajustado al momento clave (${fmt12(toMin(v))})`)
  reunionesStore.fetchAll({ force: true })
}

// ── Arrastrar y soltar ───────────────────────────────────────────────────────
async function pedirDuracion(nombre) {
  const r = await Swal.fire({
    title: '¿Cuánto dura?',
    text: `Para programar "${nombre}" indica su duración en minutos.`,
    input: 'number',
    inputValue: 15,
    inputAttributes: { min: '1', max: '1440', step: '1', 'aria-label': 'Duración en minutos' },
    showCancelButton: true,
    confirmButtonText: 'Programar',
    cancelButtonText: 'Cancelar',
    inputValidator: (v) => (Number(v) >= 1 && Number(v) <= 1440 ? undefined : 'Entre 1 y 1440 minutos'),
  })
  return r.isConfirmed ? Number(r.value) : null
}

// Sortable mueve el nodo en el DOM; Vue debe seguir siendo dueño de la lista:
// se devuelve el nodo a su sitio y se aplica el cambio sobre el estado.
function revertirDom(evt) {
  const { from, to, item, oldIndex, newIndex } = evt
  const ref = from === to && oldIndex > newIndex ? from.children[oldIndex + 1] : from.children[oldIndex]
  from.insertBefore(item, ref ?? null)
}

async function alSoltar(evt) {
  if (evt.from === evt.to && evt.oldIndex === evt.newIndex) return
  revertirDom(evt)

  const crono = c.value.filas.map((f) => f.id)
  const sin = c.value.sinHora.map((m) => m.id)
  const origen = evt.from === listaCrono.value ? crono : sin
  const destino = evt.to === listaCrono.value ? crono : sin
  const [id] = origen.splice(evt.oldIndex, 1)
  destino.splice(evt.newIndex, 0, id)

  const m = momentos.value.find((x) => x.id === id)
  const aCronograma = evt.to === listaCrono.value && evt.from !== listaCrono.value
  const claveASinHora = m?.es_clave && evt.to !== listaCrono.value

  await accion(async () => {
    if (aCronograma && !m.duracion_min) {
      const dur = await pedirDuracion(m.nombre)
      if (!dur) return false // cancelado: nada cambia
      await setDuracion(id, dur)
    }
    await ordenar(reunion.value.id, crono, sin)
  }, claveASinHora ? 'Momento clave quitado: se conservó la hora de inicio' : null)
}

function montarSortables() {
  sortables.forEach((s) => s.destroy())
  sortables = []
  if (!puedeEditar.value || !listaCrono.value || !listaSin.value) return
  const opts = {
    group: 'momentos', handle: '.grip', animation: 150, emptyInsertThreshold: 24,
    ghostClass: 'fila--ghost', chosenClass: 'fila--elegida', onEnd: alSoltar,
  }
  sortables = [Sortable.create(listaCrono.value, opts), Sortable.create(listaSin.value, opts)]
}

// ── Jornada ──────────────────────────────────────────────────────────────────
function editarJornada() {
  formRef.value?.open(reunion.value, { horaFijadaPorClave: c.value.claveActiva })
}

async function alGuardarJornada() {
  await cargar()
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])

async function duplicar() {
  const p = partesFecha(reunion.value.fecha)
  const r = await Swal.fire({
    title: 'Duplicar jornada',
    html: `
      <p class="swal-dup__nota">Se copia el cronograma completo (momentos y responsables). No se copian asistencias.</p>
      <label class="swal-dup__lbl" for="dup-nombre">Nombre</label>
      <input id="dup-nombre" class="swal2-input swal-dup__inp" maxlength="255" value="${esc(`${reunion.value.nombre_tema} (copia)`)}">
      <div class="swal-dup__fila">
        <div><label class="swal-dup__lbl" for="dup-fecha">Fecha</label>
          <input id="dup-fecha" type="date" class="swal2-input swal-dup__inp" value="${esc(p.fecha)}"></div>
        <div><label class="swal-dup__lbl" for="dup-hora">Hora de inicio</label>
          <input id="dup-hora" type="time" class="swal2-input swal-dup__inp" value="${esc(toHHMM(c.value.inicio))}"></div>
      </div>`,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Duplicar',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const nombre = document.getElementById('dup-nombre').value.trim()
      const fecha = document.getElementById('dup-fecha').value
      const hora = document.getElementById('dup-hora').value
      if (!nombre || !fecha || !hora) {
        Swal.showValidationMessage('Nombre, fecha y hora son obligatorios')
        return false
      }
      if (fecha < new Date().toLocaleDateString('en-CA')) {
        Swal.showValidationMessage('La nueva fecha no puede estar en el pasado')
        return false
      }
      return { nombre, fecha: `${fecha} ${hora}` }
    },
  })
  if (!r.isConfirmed) return
  busy.value = true
  try {
    const nuevaId = await duplicarJornada(reunion.value.id, r.value.nombre, r.value.fecha)
    reunionesStore.fetchAll({ force: true })
    showAlerta('Jornada duplicada', 'success')
    await router.push({ name: 'jornada', params: { id: nuevaId } })
  } catch (e) {
    showAlerta(e?.message || 'No se pudo duplicar la jornada', 'error')
  } finally {
    busy.value = false
  }
}

async function eliminarJornada() {
  // remove() avisa si hay asistencias y pide confirmación; borra también los momentos (cascada).
  const ok = await reunionesStore.remove(reunion.value.id, reunion.value.nombre_tema)
  if (!ok) return
  categoriasStore.refrescarHayJornadas()
  router.push({ name: 'jornadas' })
}

const exportando = ref(null)
async function exportar(formato) {
  exportando.value = formato
  try {
    const { exportarCronograma } = await import('@/lib/exportCronograma')
    await exportarCronograma(formato, {
      reunion: reunion.value, c: c.value, nombresDe, color: parroquiaStore.colorEfectivo,
    })
  } catch (e) {
    console.error(e)
    showAlerta('No se pudo generar el archivo', 'error')
  } finally {
    exportando.value = null
  }
}

async function cambiarACategoriaConCronograma() {
  const ok = await confirmar({
    titulo: 'Esta reunión no tiene cronograma',
    texto: 'Su categoría no permite organizar momentos. Edítala y elige Jornada, Retiro u otra categoría con cronograma.',
    icono: 'info',
    confirmarTexto: 'Editar reunión',
  })
  if (ok) editarJornada()
}

watch([listaCrono, listaSin, puedeEditar], () => nextTick(montarSortables))

onMounted(async () => {
  await Promise.all([
    cargar(),
    categoriasStore.fetchAll(),
    getResponsablesPosibles().then((p) => { personas.value = p }).catch(() => { personas.value = [] }),
  ])
  loading.value = false
  await nextTick()
  montarSortables()
})

watch(() => route.params.id, async (id, anterior) => {
  if (id && id !== anterior) {
    loading.value = true
    await cargar()
    loading.value = false
  }
})

onUnmounted(() => sortables.forEach((s) => s.destroy()))
</script>

<template>
  <AppPage :title="reunion?.nombre_tema || 'Jornada'" :subtitle="reunion?.categoria?.nombre || ''" :loading="loading" skeleton="form">
    <template #leading>
      <AppButton variant="ghost" size="sm" icon-only :icon="ArrowLeft" aria-label="Volver a Jornadas"
        :to="{ name: 'jornadas' }" />
    </template>

    <AppEmpty v-if="noEncontrada" :icon="Inbox" message="No encontramos esta jornada. Puede que se haya eliminado.">
      <AppButton :to="{ name: 'jornadas' }">Ver jornadas</AppButton>
    </AppEmpty>

    <AppEmpty v-else-if="errorCarga && !reunion" :icon="Inbox" :message="errorCarga">
      <AppButton @click="cargar">Reintentar</AppButton>
    </AppEmpty>

    <template v-else-if="reunion">
      <section class="cabecera surface" aria-label="Resumen de la jornada">
        <div class="cabecera__info">
          <div class="resumen">
            <span><CalendarDays :size="15" aria-hidden="true" /> {{ fechaTexto }}</span>
            <template v-if="c.filas.length">
              <span><Clock :size="15" aria-hidden="true" /> <b>{{ rango(c.inicio, c.fin) }}</b></span>
              <span>Duración <b>{{ duracionTexto(c.total) }}</b></span>
            </template>
            <span><b>{{ c.filas.length }}</b> programados</span>
            <span v-if="c.sinHora.length"><b>{{ c.sinHora.length }}</b> sin hora</span>
            <span class="text-muted">{{ reunion.tipo }}</span>
          </div>

          <div v-if="clave" class="control-clave" title="El momento clave fija la hora; todo lo demás se acomoda a su alrededor">
            <Star :size="16" class="ico-clave" aria-hidden="true" />
            <span>Momento clave: <b>{{ clave.nombre }}</b> a las</span>
            <input type="time" :value="toHHMM(clave.inicio)" aria-label="Hora del momento clave"
              :disabled="!puedeEditar || busy" @change="cambiarHoraClave">
            <AppButton v-if="puedeEditar" variant="ghost" size="sm" icon-only :icon="X" aria-label="Quitar momento clave"
              title="Quitar momento clave" :disabled="busy" @click="quitarClave" />
          </div>
          <p v-else-if="c.filas.length && puedeEditar" class="pista">
            Marca la <Star :size="14" aria-hidden="true" /> de un momento para fijarlo como momento clave.
          </p>
        </div>

        <div class="cabecera__acciones">
          <AppButton v-if="puedeEditar && permiteCronograma" :icon="Plus" :disabled="busy" @click="nuevoMomento">Nuevo momento</AppButton>
          <AppButton v-if="puedeEditar" variant="secondary" :icon="Pencil" :disabled="busy" @click="editarJornada">Editar</AppButton>
          <AppButton variant="secondary" :icon="FileText" :loading="exportando === 'docx'" @click="exportar('docx')">Word</AppButton>
          <AppButton variant="secondary" :icon="FileDown" :loading="exportando === 'pdf'" @click="exportar('pdf')">PDF</AppButton>
          <AppButton v-if="puedeDuplicar" variant="secondary" :icon="Copy" :disabled="busy" @click="duplicar">Duplicar</AppButton>
          <AppButton v-if="puedeEliminar" variant="soft-danger" :icon="Trash" :disabled="busy" @click="eliminarJornada">Eliminar</AppButton>
        </div>
      </section>

      <div v-if="!permiteCronograma" class="aviso" role="status">
        La categoría de esta reunión no permite cronograma; sus momentos no se pueden editar.
        <button v-if="puedeEditar" type="button" class="btn btn-link p-0 align-baseline" @click="cambiarACategoriaConCronograma">Cambiar categoría</button>
      </div>

      <section class="card-crono surface" aria-labelledby="h-crono" :aria-busy="busy">
        <header class="card-crono__head">
          <h2 id="h-crono"><Clock :size="16" aria-hidden="true" /> Cronograma</h2>
          <span v-if="puedeEditar" class="ayuda">Arrastra <GripVertical :size="13" aria-hidden="true" /> para reordenar</span>
        </header>
        <div class="encabezado" aria-hidden="true">
          <span></span><span>Hora</span><span>Momento</span><span>Detalle</span><span>Responsable</span><span>Dura</span><span></span>
        </div>
        <ul ref="listaCrono" class="lista" :class="{ 'lista--vacia': !c.filas.length }" role="list">
          <li v-for="f in c.filas" :key="f.id" class="fila" :class="{ 'fila--clave': f.esClave }" :data-id="f.id">
            <button v-if="puedeEditar" class="grip" type="button" :aria-label="`Arrastrar ${f.nombre}`" title="Arrastrar">
              <GripVertical :size="16" aria-hidden="true" />
            </button>
            <span v-else></span>
            <span class="hora">{{ rango(f.inicio, f.fin) }}</span>
            <span class="nombre">{{ f.nombre }}<span v-if="f.esClave" class="badge-clave"><Star :size="11" aria-hidden="true" /> Clave</span></span>
            <span class="detalle">{{ f.detalle }}</span>
            <span class="responsable"><span v-if="f.responsables?.length" class="lbl-movil">Responsable: </span>{{ nombresDe(f.responsables) }}</span>
            <span class="dur">{{ duracionTexto(f.duracion_min) }}</span>
            <span v-if="puedeEditar" class="acciones">
              <AppButton variant="ghost" size="sm" icon-only :icon="Star" :class="{ 'clave-on': f.esClave }"
                :aria-label="f.esClave ? 'Quitar como momento clave' : 'Marcar como momento clave'"
                :title="f.esClave ? 'Quitar como momento clave' : 'Marcar como momento clave'"
                :aria-pressed="f.esClave" :disabled="busy" @click="alternarClave(f)" />
              <AppButton variant="ghost" size="sm" icon-only :icon="Pencil" :aria-label="`Editar ${f.nombre}`" title="Editar"
                :disabled="busy" @click="editarMomento(f)" />
              <AppButton variant="ghost" size="sm" icon-only :icon="Trash" :aria-label="`Eliminar ${f.nombre}`" title="Eliminar"
                :disabled="busy" @click="borrarMomento(f)" />
            </span>
          </li>
        </ul>
        <p v-if="!c.filas.length" class="vacio">
          {{ puedeEditar ? 'Agrega un momento con duración o arrastra uno desde "Sin hora definida".' : 'Aún no hay momentos programados.' }}
        </p>
      </section>

      <section class="card-crono card-crono--sin surface" aria-labelledby="h-sin">
        <header class="card-crono__head">
          <h2 id="h-sin"><Inbox :size="16" aria-hidden="true" /> Sin hora definida</h2>
          <span v-if="puedeEditar" class="ayuda">Arrástralos al cronograma cuando sepas su lugar</span>
        </header>
        <ul ref="listaSin" class="lista lista--sin" :class="{ 'lista--vacia': !c.sinHora.length }" role="list">
          <li v-for="m in c.sinHora" :key="m.id" class="fila" :data-id="m.id">
            <button v-if="puedeEditar" class="grip" type="button" :aria-label="`Arrastrar ${m.nombre}`" title="Arrastrar">
              <GripVertical :size="16" aria-hidden="true" />
            </button>
            <span v-else></span>
            <span class="nombre">{{ m.nombre }}</span>
            <span class="detalle">{{ m.detalle }}</span>
            <span class="responsable"><span v-if="m.responsables?.length" class="lbl-movil">Responsable: </span>{{ nombresDe(m.responsables) }}</span>
            <span class="dur">{{ duracionTexto(m.duracion_min) }}</span>
            <span v-if="puedeEditar" class="acciones">
              <AppButton variant="ghost" size="sm" icon-only :icon="Pencil" :aria-label="`Editar ${m.nombre}`" title="Editar"
                :disabled="busy" @click="editarMomento(m)" />
              <AppButton variant="ghost" size="sm" icon-only :icon="Trash" :aria-label="`Eliminar ${m.nombre}`" title="Eliminar"
                :disabled="busy" @click="borrarMomento(m)" />
            </span>
          </li>
        </ul>
        <p v-if="!c.sinHora.length" class="vacio">Nada pendiente.</p>
      </section>
    </template>

    <JornadaFormModal v-if="puedeEditar" ref="formRef" @guardado="alGuardarJornada" />
    <MomentoModal v-if="puedeEditar" ref="momentoRef" :personas="personas" />
  </AppPage>
</template>

<style scoped>
.surface {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.cabecera {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
}
.cabecera__info { display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; flex: 1 1 22rem; }
.cabecera__acciones { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: flex-start; }
.resumen { display: flex; flex-wrap: wrap; gap: 0.4rem 1.1rem; font-size: var(--fs-ui); color: var(--text); }
.resumen > span { display: inline-flex; align-items: center; gap: 0.35rem; }
.control-clave {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, #f59e0b 14%, var(--surface));
  font-size: var(--fs-ui);
}
.control-clave input {
  width: auto;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
}
.ico-clave { color: #d97706; }
.pista { margin: 0; font-size: var(--fs-ui); color: var(--text-muted); display: inline-flex; align-items: center; gap: 0.3rem; }
.aviso {
  margin-bottom: 1rem;
  padding: 0.6rem 0.9rem;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, #0ea5e9 12%, var(--surface));
  font-size: var(--fs-ui);
}

.card-crono { padding: 0.75rem 0 0.5rem; margin-bottom: 1rem; }
.card-crono__head {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem;
  padding: 0 1.1rem 0.5rem;
}
.card-crono__head h2 { display: inline-flex; align-items: center; gap: 0.4rem; margin: 0; font-size: var(--fs-base, 1rem); font-weight: 700; }
.ayuda { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.8rem; color: var(--text-muted); }

/* Filas en grilla: grip | hora | momento | detalle | responsable | dura | acciones */
.encabezado, .fila {
  display: grid;
  grid-template-columns: 2rem 9.5rem minmax(9rem, 1.3fr) minmax(8rem, 1.3fr) minmax(7rem, 1fr) 5rem 6.5rem;
  gap: 0.75rem;
  align-items: center;
  padding: 0.5rem 1.1rem;
}
.lista--sin .fila { grid-template-columns: 2rem minmax(9rem, 1.3fr) minmax(8rem, 1.3fr) minmax(7rem, 1fr) 5rem 6.5rem; }
.encabezado {
  padding-top: 0.35rem; padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--line);
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted);
}
.lista { margin: 0; padding: 0; list-style: none; min-height: 2.75rem; }
.lista--vacia { min-height: 2.75rem; }
.fila { border-bottom: 1px solid var(--line); font-size: var(--fs-ui); background: var(--surface); }
.fila:last-child { border-bottom: 0; }
.fila--clave { background: color-mix(in srgb, #f59e0b 12%, var(--surface)); }
.fila--ghost { opacity: 0.45; }
.fila--elegida { box-shadow: var(--shadow-md); }
.grip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 2rem; height: 2rem; padding: 0;
  border: 0; border-radius: var(--radius-sm); background: transparent;
  color: var(--text-muted); cursor: grab; touch-action: none;
}
.grip:hover { background: var(--surface-sunken); color: var(--text); }
.grip:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.hora { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.nombre { font-weight: 600; overflow-wrap: anywhere; }
.detalle, .responsable { color: var(--text-muted); overflow-wrap: anywhere; white-space: pre-line; }
.dur { color: var(--text-muted); white-space: nowrap; }
.acciones { display: flex; justify-content: flex-end; gap: 0.1rem; }
.acciones :deep(.clave-on) { color: #d97706; }
.badge-clave {
  display: inline-flex; align-items: center; gap: 0.2rem; margin-left: 0.4rem;
  padding: 0.05rem 0.4rem; border-radius: var(--radius-pill);
  background: #f59e0b; color: #1f2937; font-size: 0.7rem; font-weight: 700; vertical-align: middle;
}
.lbl-movil { display: none; }
.vacio { margin: 0; padding: 0.4rem 1.1rem 0.6rem; font-size: var(--fs-ui); color: var(--text-muted); }
.card-crono--sin { border-style: dashed; }

@media (max-width: 991px) {
  .encabezado { display: none; }
  .fila, .lista--sin .fila {
    grid-template-columns: 2rem 1fr auto;
    grid-template-areas: 'grip hora acciones' 'grip nombre acciones' 'grip detalle detalle' 'grip resp resp' 'grip dur dur';
    gap: 0.1rem 0.6rem;
    padding: 0.55rem 0.75rem;
  }
  .lista--sin .fila { grid-template-areas: 'grip nombre acciones' 'grip detalle detalle' 'grip resp resp' 'grip dur dur'; }
  .grip { grid-area: grip; align-self: start; }
  .hora { grid-area: hora; }
  .nombre { grid-area: nombre; }
  .detalle { grid-area: detalle; }
  .responsable { grid-area: resp; }
  .dur { grid-area: dur; font-size: 0.8rem; }
  .acciones { grid-area: acciones; align-self: start; }
  .lbl-movil { display: inline; font-weight: 600; }
  .detalle:empty, .responsable:empty, .dur:empty { display: none; }
  .cabecera { padding: 0.75rem; }
  .card-crono__head { padding: 0 0.75rem 0.4rem; }
}
</style>

<style>
/* Diálogo de duplicar (SweetAlert vive fuera del componente). */
.swal-dup__nota { margin: 0 0 0.75rem; font-size: 0.9rem; }
.swal-dup__lbl { display: block; margin: 0.5rem 0 0.2rem; text-align: left; font-size: 0.85rem; font-weight: 600; }
.swal-dup__inp { width: 100%; margin: 0 !important; box-sizing: border-box; }
.swal-dup__fila { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
</style>
