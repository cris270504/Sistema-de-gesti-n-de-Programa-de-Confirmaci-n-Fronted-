<script setup>
import { ref, computed, onMounted } from 'vue'
import { Archive, Trash2, RotateCcw, Download, CalendarRange, History, TriangleAlert } from 'lucide-vue-next'
import AppButton from '@/components/AppButton.vue'
import { showAlerta, confirmar } from '@/funciones'
import { useParroquiaStore } from '@/stores/parroquia'
import { useRespaldo } from '@/composables/useRespaldo'
import { listCiclos, cerrarCiclo, reabrirUltimoCiclo, cicloReabrible, contarJovenesActuales } from '@/services/ciclos'

const parroquiaStore = useParroquiaStore()
const { trabajando: generandoRespaldo, paso: pasoRespaldo, descargado, descargar } = useRespaldo()

const ciclos = ref([])
const conteo = ref({ total: 0, en_preparacion: 0, confirmado: 0, retirado: 0 })
const cargando = ref(true)

async function cargar() {
  cargando.value = true
  try {
    ;[ciclos.value, conteo.value] = await Promise.all([listCiclos(), contarJovenesActuales()])
  } catch (e) {
    showAlerta(e?.message || 'No se pudieron cargar los ciclos.', 'error')
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

const reabrible = computed(() => cicloReabrible(ciclos.value))

// ── Diálogo de cierre ────────────────────────────────────────────────────
const abierto = ref(false)
const form = ref({ nombre: '', modo: '', confirmacion: '', inicio: '', fin: '' })
const cerrando = ref(false)

function nombreSugerido() {
  const inicio = parroquiaStore.configuracion?.programa_inicio
  return String(inicio ? new Date(`${inicio}T00:00:00`).getFullYear() : new Date().getFullYear())
}

function abrir() {
  form.value = { nombre: nombreSugerido(), modo: '', confirmacion: '', inicio: '', fin: '' }
  abierto.value = true
}

const confirmacionOk = computed(() =>
  !!form.value.nombre.trim()
  && form.value.confirmacion.trim().toLowerCase() === form.value.nombre.trim().toLowerCase())
const puedeCerrar = computed(() => !!form.value.modo && confirmacionOk.value && !cerrando.value && conteo.value.total > 0)

async function cerrar() {
  if (!puedeCerrar.value) return
  const eliminar = form.value.modo === 'eliminar'
  const ok = await confirmar({
    titulo: eliminar ? '¿Eliminar a todos los jóvenes?' : `¿Archivar a ${conteo.value.total} jóvenes?`,
    texto: eliminar
      ? `Se borran para siempre ${conteo.value.total} jóvenes, sus apoderados, asistencias, justificaciones, sacramentos y documentos. No se puede deshacer.${descargado.value ? '' : ' Todavía no descargaste el respaldo.'}`
      : 'Dejan de verse en listas, panel y alertas. Podrás consultarlos y reactivarlos desde «Confirmandos → Archivados», o deshacer este cierre.',
    icono: 'warning',
    confirmarTexto: eliminar ? 'Sí, eliminar' : 'Sí, cerrar el ciclo',
  })
  if (!ok) return
  cerrando.value = true
  try {
    const res = await cerrarCiclo({
      nombre: form.value.nombre.trim(),
      modo: form.value.modo,
      confirmacion: form.value.confirmacion,
      inicio: form.value.inicio,
      fin: form.value.fin,
    })
    abierto.value = false
    showAlerta(res.modo === 'eliminar'
      ? `Ciclo «${res.nombre}» cerrado: se eliminaron ${res.jovenes} jóvenes.`
      : `Ciclo «${res.nombre}» cerrado: ${res.jovenes} jóvenes archivados.`, 'success')
    if (form.value.inicio) parroquiaStore.fetchConfiguracion()
    await cargar()
  } catch (e) {
    showAlerta(e?.message || 'No se pudo cerrar el ciclo.', 'error')
  } finally {
    cerrando.value = false
  }
}

async function reabrir() {
  const c = reabrible.value
  if (!c) return
  const ok = await confirmar({
    titulo: `¿Reabrir el ciclo «${c.nombre}»?`,
    texto: `Los ${c.jovenes} jóvenes archivados en ese cierre vuelven a como estaban, con su grupo si todavía existe. Los que ya reactivaste no cambian.`,
    icono: 'question',
    confirmarTexto: 'Sí, reabrir',
  })
  if (!ok) return
  try {
    const res = await reabrirUltimoCiclo()
    showAlerta(`Ciclo «${res.nombre}» reabierto: ${res.jovenes} jóvenes recuperados.`, 'success')
    await cargar()
  } catch (e) {
    showAlerta(e?.message || 'No se pudo reabrir el ciclo.', 'error')
  }
}

const fmt = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
</script>

<template>
  <div class="ciclos">
    <!-- Cierre -->
    <section class="ciclos__card surface" aria-labelledby="ciclo-titulo">
      <header class="ciclos__head">
        <span class="ciclos__ico" aria-hidden="true"><CalendarRange :size="20" /></span>
        <div>
          <h3 id="ciclo-titulo" class="ciclos__titulo">Cerrar el ciclo</h3>
          <p class="ciclos__txt">
            Al terminar el año del programa, cierra el ciclo para empezar el siguiente con las listas limpias.
            Ningún joven pasa solo al ciclo nuevo.
          </p>
        </div>
      </header>

      <dl class="ciclos__conteo" aria-label="Jóvenes del ciclo actual">
        <div><dt>En el ciclo actual</dt><dd>{{ cargando ? '…' : conteo.total }}</dd></div>
        <div><dt>En preparación</dt><dd>{{ cargando ? '…' : conteo.en_preparacion }}</dd></div>
        <div><dt>Confirmados</dt><dd>{{ cargando ? '…' : conteo.confirmado }}</dd></div>
        <div><dt>Retirados</dt><dd>{{ cargando ? '…' : conteo.retirado }}</dd></div>
      </dl>

      <AppButton v-if="!abierto" :icon="Archive" :disabled="cargando || conteo.total === 0" @click="abrir">
        Cerrar ciclo…
      </AppButton>
      <p v-if="!abierto && !cargando && conteo.total === 0" class="ciclos__txt">No hay jóvenes en el ciclo actual.</p>

      <form v-if="abierto" class="cierre" @submit.prevent="cerrar">
        <fieldset class="cierre__modos">
          <legend class="cierre__legend">¿Qué hacer con los {{ conteo.total }} jóvenes?</legend>
          <label class="modo" :class="{ 'modo--on': form.modo === 'mantener' }">
            <input v-model="form.modo" type="radio" value="mantener" class="sr" />
            <span class="modo__ico" aria-hidden="true"><Archive :size="18" /></span>
            <span class="modo__txt">
              <b>Mantener datos (archivar)</b>
              Todos quedan archivados con su historial. Se consultan y reactivan desde
              «Confirmandos → Archivados», y este cierre se puede deshacer.
            </span>
          </label>
          <label class="modo modo--peligro" :class="{ 'modo--on': form.modo === 'eliminar' }">
            <input v-model="form.modo" type="radio" value="eliminar" class="sr" />
            <span class="modo__ico" aria-hidden="true"><Trash2 :size="18" /></span>
            <span class="modo__txt">
              <b>Eliminar datos (empezar limpio)</b>
              Se borran para siempre todos los jóvenes, sus apoderados, asistencias, justificaciones,
              sacramentos y documentos. No se puede deshacer.
            </span>
          </label>
        </fieldset>
        <p class="ciclos__txt">En los dos casos los grupos se conservan vacíos y las reuniones quedan como historial.</p>

        <div v-if="form.modo === 'eliminar'" class="cierre__respaldo" role="note">
          <TriangleAlert :size="16" aria-hidden="true" />
          <span>Te recomendamos descargar el respaldo antes de eliminar.
            <template v-if="descargado"> <b>Respaldo descargado.</b></template>
            <template v-else-if="pasoRespaldo"> {{ pasoRespaldo }}</template>
          </span>
          <AppButton variant="secondary" size="sm" type="button" :icon="Download" :loading="generandoRespaldo"
            @click="descargar">Descargar respaldo</AppButton>
        </div>

        <div class="cierre__grid">
          <label class="cierre__campo">
            <span>Nombre del ciclo que se cierra</span>
            <input v-model="form.nombre" type="text" maxlength="40" placeholder="Ej: 2026" />
          </label>
          <label class="cierre__campo">
            <span>Inicio del ciclo nuevo <span class="opc">(opcional)</span></span>
            <input v-model="form.inicio" type="date" />
          </label>
          <label class="cierre__campo">
            <span>Cierre del ciclo nuevo <span class="opc">(opcional)</span></span>
            <input v-model="form.fin" type="date" :min="form.inicio || undefined" :disabled="!form.inicio" />
          </label>
          <label class="cierre__campo">
            <span>Escribe <b>{{ form.nombre.trim() || 'el nombre' }}</b> para confirmar</span>
            <input v-model="form.confirmacion" type="text" maxlength="40" autocomplete="off" spellcheck="false" />
          </label>
        </div>

        <div class="cierre__acciones">
          <AppButton variant="secondary" type="button" :disabled="cerrando" @click="abierto = false">Cancelar</AppButton>
          <AppButton type="submit" :variant="form.modo === 'eliminar' ? 'danger' : 'primary'"
            :icon="form.modo === 'eliminar' ? Trash2 : Archive" :loading="cerrando" :disabled="!puedeCerrar">
            {{ form.modo === 'eliminar' ? 'Eliminar y cerrar el ciclo' : 'Archivar y cerrar el ciclo' }}
          </AppButton>
        </div>
      </form>
    </section>

    <!-- Ciclos cerrados -->
    <section class="ciclos__card surface" aria-labelledby="ciclos-cerrados">
      <header class="ciclos__head">
        <span class="ciclos__ico" aria-hidden="true"><History :size="20" /></span>
        <div>
          <h3 id="ciclos-cerrados" class="ciclos__titulo">Ciclos cerrados</h3>
          <p class="ciclos__txt">Los archivados de cada ciclo se ven en «Confirmandos → Archivados».</p>
        </div>
      </header>
      <p v-if="!cargando && ciclos.length === 0" class="ciclos__txt">Todavía no se cerró ningún ciclo.</p>
      <ul v-else class="lista">
        <li v-for="c in ciclos" :key="c.id" class="lista__item" :class="{ 'lista__item--off': c.reabierto_at }">
          <div class="lista__txt">
            <b>{{ c.nombre }}</b>
            <span>
              {{ c.modo === 'eliminar' ? `${c.jovenes} jóvenes eliminados` : `${c.jovenes} jóvenes archivados` }}
              · {{ fmt(c.cerrado_at) }}<template v-if="c.cerrado_por_nombre"> · {{ c.cerrado_por_nombre }}</template>
              <template v-if="c.reabierto_at"> · reabierto el {{ fmt(c.reabierto_at) }}</template>
            </span>
          </div>
          <AppButton v-if="reabrible && reabrible.id === c.id" variant="secondary" size="sm" :icon="RotateCcw"
            @click="reabrir">Reabrir</AppButton>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.ciclos { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 1.25rem; align-items: start; }
.ciclos__card { display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem; }
.ciclos__head { display: flex; gap: 0.85rem; align-items: flex-start; }
.ciclos__ico { display: grid; place-items: center; width: 44px; height: 44px; border-radius: var(--radius-lg); background: var(--accent-soft); color: var(--accent); flex-shrink: 0; }
.ciclos__titulo { margin: 0 0 0.25rem; font-size: var(--fs-base); font-weight: 700; color: var(--text); }
.ciclos__txt { margin: 0; font-size: var(--fs-sm); line-height: 1.5; color: var(--text-muted); }
.ciclos__conteo { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.5rem; margin: 0; }
.ciclos__conteo > div { padding: 0.6rem; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface-sunken); text-align: center; }
.ciclos__conteo dt { font-size: var(--fs-xs); font-weight: 500; color: var(--text-muted); }
.ciclos__conteo dd { margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text); font-variant-numeric: tabular-nums; }
.ciclos :deep(.app-btn) { min-height: 44px; }
.ciclos > .ciclos__card > :deep(.app-btn) { align-self: flex-start; }

.cierre { display: flex; flex-direction: column; gap: 1rem; padding-top: 1rem; border-top: 1px solid var(--line); }
.cierre__modos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; border: 0; padding: 0; margin: 0; }
.cierre__legend { float: none; width: auto; grid-column: 1 / -1; margin: 0 0 0.25rem; padding: 0; font-size: var(--fs-sm); font-weight: 700; color: var(--text); }
.modo { display: flex; gap: 0.75rem; padding: 0.9rem; border: 1.5px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); cursor: pointer; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.modo:hover { border-color: var(--line-strong); }
.modo--on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.modo--peligro.modo--on { border-color: var(--danger); box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 15%, transparent); }
.modo:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
.modo__ico { display: grid; place-items: center; width: 36px; height: 36px; border-radius: var(--radius-md); background: var(--accent-soft); color: var(--accent); flex-shrink: 0; }
.modo--peligro .modo__ico { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }
.modo__txt { display: flex; flex-direction: column; gap: 0.2rem; font-size: var(--fs-sm); line-height: 1.45; color: var(--text-muted); }
.modo__txt b { color: var(--text); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; padding: 0; margin: -1px; }
.cierre__respaldo { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; padding: 0.7rem 0.85rem; border-radius: var(--radius-md); border: 1px solid #f59e0b; background: #fffbeb; font-size: var(--fs-sm); color: var(--text); }
.cierre__respaldo svg { color: #b45309; flex-shrink: 0; }
.cierre__respaldo span { flex: 1 1 240px; }
.cierre__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
.cierre__campo { display: flex; flex-direction: column; gap: 0.3rem; margin: 0; font-size: var(--fs-sm); color: var(--text); }
.opc { color: var(--text-muted); }
.cierre__acciones { display: flex; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap; }

.lista { list-style: none; margin: 0; padding: 0; }
.lista__item { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.6rem 0; border-top: 1px solid var(--line); }
.lista__item--off { opacity: 0.6; }
.lista__txt { display: flex; flex-direction: column; min-width: 0; font-size: var(--fs-sm); color: var(--text-muted); }
.lista__txt b { color: var(--text); font-size: var(--fs-ui); }

@media (max-width: 991.98px) {
  .ciclos { grid-template-columns: 1fr; }
}
@media (max-width: 575.98px) {
  .ciclos__conteo { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cierre__modos, .cierre__grid { grid-template-columns: 1fr; }
}
:root[data-bs-theme="dark"] .cierre__respaldo { background: #3b2a0a; border-color: #b45309; }
</style>
