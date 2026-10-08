<script setup>
import AppButton from '@/components/AppButton.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import AppPage from '@/components/AppPage.vue'
import { ref, computed, onMounted, watch, nextTick, defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { CalendarHeart, Flame, ChevronRight } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useParroquiaStore } from '@/stores/parroquia'
import { useProgramacionesSacramentoStore } from '@/stores/programacionesSacramento'
import { ahoraEnZona } from '@/services/reunions'
import { sacramentoUi, formatearFechaCelebracion } from '@/lib/sacramentosUi'

const ProgramarSacramentoModal = defineAsyncComponent(() => import('@/components/Modals/ProgramarSacramentoModal.vue'))
const RegistrarSacramentosModal = defineAsyncComponent(() => import('@/components/Modals/RegistrarSacramentosModal.vue'))

const authStore = useAuthStore()
const parroquiaStore = useParroquiaStore()
const store = useProgramacionesSacramentoStore()
const { items, loading } = storeToRefs(store)
const route = useRoute()
const router = useRouter()

const programarRef = ref(null)
const registrarRef = ref(null)
const puedeProgramar = computed(() => authStore.can('programar sacramentos'))

const PESTANAS = [
  { id: 'programada', nombre: 'Próximas', vacio: 'No hay celebraciones por realizar.' },
  { id: 'realizada', nombre: 'Registradas', vacio: 'Aún no se registró ninguna celebración.' },
  { id: 'cancelada', nombre: 'Canceladas', vacio: 'No hay celebraciones canceladas.' },
]
const pestana = ref('programada')

const hoy = computed(() => ahoraEnZona(parroquiaStore.zonaHoraria).slice(0, 10))

const lista = computed(() => {
  const filas = items.value.filter((p) => p.estado === pestana.value)
  // Próximas: la más cercana primero. Registradas/canceladas: la más reciente primero.
  return pestana.value === 'programada' ? filas : [...filas].reverse()
})

const conteo = (id) => items.value.filter((p) => p.estado === id).length

function detalleFila(p) {
  const jovenes = p.total_jovenes === 1 ? '1 joven' : `${p.total_jovenes} jóvenes`
  if (p.estado === 'realizada') return `${p.total_recibieron} de ${jovenes} lo recibieron`
  return jovenes
}

const porRegistrar = (p) => p.estado === 'programada' && p.fecha.slice(0, 10) <= hoy.value

function dia(fecha) {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number)
  const f = new Date(y, m - 1, d)
  return { num: d, mes: f.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '') }
}

async function abrir(id) {
  await nextTick()
  registrarRef.value?.open(id)
}

// Al cerrar el detalle se limpia ?id para que recargar no lo reabra.
function alCerrarDetalle() {
  if (route.query.id) router.replace({ query: { ...route.query, id: undefined } })
}

function editar(id) {
  programarRef.value?.open({ programacionId: id })
}

onMounted(async () => {
  await store.fetchAll({ force: true })
})

// Llegada desde el calendario: /sacramentos-programados?id=12
watch(
  [() => route.query.id, loading, registrarRef],
  ([id, cargando, modal]) => {
    if (!id || cargando || !modal) return
    const p = store.byId(id)
    if (p) pestana.value = p.estado
    abrir(Number(id))
  },
  { immediate: true },
)
</script>

<template>
  <AppPage title="Sacramentos programados" subtitle="Celebraciones y registro de quién recibió cada sacramento"
    :loading="loading">
    <template v-if="puedeProgramar" #actions>
      <AppButton :icon="Flame" @click="programarRef?.open()">Programar sacramento</AppButton>
    </template>

    <div class="sp-pestanas" role="tablist" aria-label="Estado de las celebraciones">
      <button v-for="t in PESTANAS" :key="t.id" type="button" role="tab" class="sp-pestana"
        :class="{ 'is-activa': pestana === t.id }" :aria-selected="pestana === t.id" @click="pestana = t.id">
        {{ t.nombre }}
        <span class="sp-pestana__n">{{ conteo(t.id) }}</span>
      </button>
    </div>

    <section class="surface" role="tabpanel">
      <AppEmpty v-if="lista.length === 0" :icon="CalendarHeart" :message="PESTANAS.find((t) => t.id === pestana).vacio">
        <AppButton v-if="puedeProgramar && pestana === 'programada'" :icon="Flame" @click="programarRef?.open()">
          Programar sacramento
        </AppButton>
      </AppEmpty>

      <ul v-else class="sp-lista">
        <li v-for="p in lista" :key="p.id">
          <button type="button" class="sp-fila" :style="{ '--sac': sacramentoUi(p.sacramento?.clave).color }"
            @click="abrir(p.id)">
            <span class="sp-fecha" aria-hidden="true">
              <span class="sp-fecha__num">{{ dia(p.fecha).num }}</span>
              <span class="sp-fecha__mes">{{ dia(p.fecha).mes }}</span>
            </span>
            <span class="sp-fila__icono" aria-hidden="true">
              <component :is="sacramentoUi(p.sacramento?.clave).icon" :size="20" :stroke-width="1.7" />
            </span>
            <span class="sp-fila__texto">
              <span class="sp-fila__titulo">{{ p.sacramento?.nombre }}</span>
              <span class="sp-fila__sub text-capitalize">{{ formatearFechaCelebracion(p.fecha) }}</span>
            </span>
            <span class="sp-fila__meta">
              <span v-if="porRegistrar(p)" class="sp-pendiente">Por registrar</span>
              <span class="sp-fila__jovenes">{{ detalleFila(p) }}</span>
            </span>
            <ChevronRight class="sp-fila__chev" :size="18" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>

    <RegistrarSacramentosModal ref="registrarRef" @editar="editar" @closed="alCerrarDetalle" />
    <ProgramarSacramentoModal v-if="puedeProgramar" ref="programarRef" />
  </AppPage>
</template>

<style scoped>
.sp-pestanas {
  display: inline-flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
  padding: 0.25rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  max-width: 100%;
  overflow-x: auto;
}
.sp-pestana {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.875rem;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--fs-ui);
  font-weight: var(--fw-medium);
  white-space: nowrap;
}
.sp-pestana:hover { color: var(--text); }
.sp-pestana:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-ring); }
.sp-pestana.is-activa { background: var(--accent-soft); color: var(--accent); }
.sp-pestana__n {
  min-width: 1.375rem;
  padding: 0 0.375rem;
  border-radius: var(--radius-pill);
  background: var(--surface-sunken);
  font-size: var(--fs-xs);
  text-align: center;
}

.sp-lista { margin: 0; padding: 0; list-style: none; }
.sp-lista li + li { border-top: 1px solid var(--line); }
.sp-fila {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  padding: 0.875rem 1.25rem;
  border: 0;
  border-left: 4px solid var(--sac);
  background: transparent;
  color: inherit;
  text-align: left;
  transition: background-color var(--dur-fast) var(--ease);
}
.sp-fila:hover { background: var(--surface-sunken); }
.sp-fila:focus-visible { outline: none; box-shadow: inset 0 0 0 3px var(--accent-ring); }
.sp-fecha {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 2.75rem;
  flex: none;
  line-height: 1.1;
}
.sp-fecha__num { font-size: var(--fs-xl); font-weight: var(--fw-semibold); color: var(--text); }
.sp-fecha__mes { font-size: var(--fs-xs); color: var(--text-muted); }
.sp-fila__icono { color: var(--sac); flex: none; }
.sp-fila__texto { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.sp-fila__titulo { font-weight: var(--fw-semibold); color: var(--text); }
.sp-fila__sub { font-size: var(--fs-sm); color: var(--text-muted); }
.sp-fila__meta { display: flex; flex-direction: column; align-items: flex-end; gap: 0.125rem; text-align: right; }
.sp-fila__jovenes { font-size: var(--fs-sm); color: var(--text-muted); }
.sp-pendiente {
  padding: 0.0625rem 0.5rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--warning) 18%, transparent);
  color: var(--text);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
}
.sp-fila__chev { color: var(--text-muted); flex: none; }

@media (max-width: 575.98px) {
  .sp-fila { flex-wrap: wrap; gap: 0.5rem 0.75rem; padding: 0.75rem 1rem; }
  .sp-fila__icono { display: none; }
  .sp-fila__meta { flex-direction: row; align-items: center; width: 100%; padding-left: 3.5rem; }
  .sp-fila__chev { display: none; }
}
</style>
