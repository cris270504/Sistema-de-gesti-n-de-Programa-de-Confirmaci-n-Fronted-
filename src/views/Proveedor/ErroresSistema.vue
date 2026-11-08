<script setup>
// Panel del proveedor: errores del frontend (frontend_error_logs) agrupados por
// mensaje, filtrables por parroquia y rango de fechas.
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshCw, Bug } from 'lucide-vue-next'
import AppButton from '@/components/AppButton.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import { listErroresSistema, agruparErrores, LIMITE_ERRORES } from '@/services/erroresSistema'

const props = defineProps({
  parroquias: { type: Array, default: () => [] },
})

const parroquiaId = ref('')
const dias = ref(7)
const cargando = ref(false)
const errorCarga = ref('')
const filas = ref([])

const nombreParroquia = computed(() => {
  const m = new Map(props.parroquias.map((p) => [p.id, p.nombre]))
  return (id) => m.get(id) ?? `#${id}`
})
const grupos = computed(() => agruparErrores(filas.value))
const truncado = computed(() => filas.value.length >= LIMITE_ERRORES)

const fmtFecha = (iso) => new Date(iso).toLocaleString('es-PE', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
})

async function cargar() {
  cargando.value = true
  errorCarga.value = ''
  try {
    filas.value = await listErroresSistema({ parroquiaId: parroquiaId.value || null, desdeDias: dias.value })
  } catch (e) {
    errorCarga.value = e?.message || 'No se pudieron cargar los errores.'
  } finally {
    cargando.value = false
  }
}

watch([parroquiaId, dias], cargar)
onMounted(cargar)
</script>

<template>
  <section class="err" aria-labelledby="err-titulo">
    <header class="err__head">
      <h2 id="err-titulo" class="err__titulo"><Bug :size="16" aria-hidden="true" /> Errores del sistema</h2>
      <div class="err__filtros">
        <label class="err__campo">
          <span class="visually-hidden">Parroquia</span>
          <select v-model="parroquiaId" aria-label="Filtrar por parroquia">
            <option value="">Todas las parroquias</option>
            <option v-for="p in parroquias" :key="p.id" :value="p.id">{{ p.nombre }}</option>
          </select>
        </label>
        <label class="err__campo">
          <span class="visually-hidden">Rango</span>
          <select v-model.number="dias" aria-label="Rango de fechas">
            <option :value="1">Últimas 24 h</option>
            <option :value="7">Últimos 7 días</option>
            <option :value="30">Últimos 30 días</option>
          </select>
        </label>
        <AppButton variant="soft" icon-only :loading="cargando" title="Actualizar" aria-label="Actualizar errores"
          @click="cargar"><RefreshCw :size="16" /></AppButton>
      </div>
    </header>

    <p class="err__nota">
      Se registran los errores no controlados de la app (fallos de código, no validaciones).
      <template v-if="truncado"> Se muestran los {{ LIMITE_ERRORES }} más recientes.</template>
    </p>

    <AppEmpty v-if="errorCarga" :icon="Bug" :message="errorCarga">
      <AppButton @click="cargar">Reintentar</AppButton>
    </AppEmpty>
    <AppEmpty v-else-if="!cargando && grupos.length === 0" :icon="Bug"
      message="Sin errores en este periodo." />

    <ul v-else class="err__lista">
      <li v-for="g in grupos" :key="g.message" class="err__item">
        <details>
          <summary class="err__resumen">
            <span class="err__veces" :title="`${g.veces} veces`">{{ g.veces }}×</span>
            <span class="err__msg">{{ g.message || '(sin mensaje)' }}</span>
            <span class="err__meta">
              {{ fmtFecha(g.ultimo) }} ·
              {{ g.parroquias.map(nombreParroquia).join(', ') || '—' }} ·
              {{ g.usuarios }} usuario{{ g.usuarios === 1 ? '' : 's' }}
            </span>
          </summary>
          <dl class="err__detalle">
            <dt>Primera vez</dt><dd>{{ fmtFecha(g.primero) }}</dd>
            <dt>URL</dt><dd class="err__mono">{{ g.ejemplo.url || '—' }}</dd>
            <dt>Navegador</dt><dd class="err__mono">{{ g.ejemplo.user_agent || '—' }}</dd>
            <dt>Stack</dt><dd><pre class="err__stack">{{ g.ejemplo.stack || '—' }}</pre></dd>
          </dl>
        </details>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.err { display: flex; flex-direction: column; gap: 0.75rem; }
.err__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
.err__titulo { display: flex; align-items: center; gap: 0.4rem; font-size: var(--fs-base); font-weight: 700; color: var(--text); margin: 0; }
.err__filtros { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.err__campo select {
  min-height: 36px; padding: 0.3rem 0.6rem; border-radius: var(--radius-md);
  border: 1px solid var(--line); background: var(--surface, transparent); color: var(--text);
  font-size: var(--fs-sm); max-width: 100%;
}
.err__nota { font-size: var(--fs-xs); color: var(--text-muted); margin: 0; }
.err__lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.err__item { border: 1px solid var(--line); border-radius: var(--radius-md); overflow: hidden; }
.err__resumen {
  display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 0.6rem; padding: 0.6rem 0.8rem;
  cursor: pointer; list-style: none;
}
.err__resumen::-webkit-details-marker { display: none; }
.err__veces {
  grid-row: span 2; align-self: start; min-width: 2.6rem; text-align: center; padding: 0.1rem 0.4rem;
  border-radius: 999px; background: color-mix(in srgb, #dc2626 14%, transparent); color: var(--text);
  font-weight: 700; font-size: var(--fs-xs);
}
.err__msg { font-weight: 600; color: var(--text); font-size: var(--fs-sm); overflow-wrap: anywhere; }
.err__meta { font-size: var(--fs-xs); color: var(--text-muted); }
.err__detalle { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 0.8rem; margin: 0; padding: 0.6rem 0.8rem 0.8rem; border-top: 1px solid var(--line); font-size: var(--fs-xs); }
.err__detalle dt { color: var(--text-muted); font-weight: 600; }
.err__detalle dd { margin: 0; color: var(--text); min-width: 0; }
.err__mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
.err__stack { margin: 0; max-height: 220px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11px; }
@media (max-width: 480px) {
  .err__detalle { grid-template-columns: 1fr; }
}
</style>
