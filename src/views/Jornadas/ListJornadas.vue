<script setup>
// Módulo "Jornadas": eventos cuya categoría permite cronograma por momentos.
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CalendarDays, ChevronRight, Clock, ListOrdered, Plus } from 'lucide-vue-next'
import AppPage from '@/components/AppPage.vue'
import AppButton from '@/components/AppButton.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import JornadaFormModal from './JornadaFormModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useCategoriasReunionStore } from '@/stores/categoriasReunion'
import { getJornadas } from '@/services/jornadas'
import { calcular, duracionTexto, fechaLarga, partesFecha, rango } from '@/lib/cronograma'
import { showAlerta } from '@/funciones'

const router = useRouter()
const authStore = useAuthStore()
const categoriasStore = useCategoriasReunionStore()

const loading = ref(true)
const jornadas = ref([])
const formRef = ref(null)

const puedeCrear = computed(() => authStore.can('crear cronograma'))

const tarjetas = computed(() => jornadas.value.map((j) => {
  const c = calcular(j.fecha, j.momentos ?? [])
  return {
    ...j,
    fechaTexto: fechaLarga(partesFecha(j.fecha).fecha, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    programados: c.filas.length,
    sinHora: c.sinHora.length,
    horario: c.filas.length ? rango(c.inicio, c.fin) : null,
    duracion: duracionTexto(c.total),
  }
}))

async function cargar() {
  loading.value = true
  try {
    jornadas.value = await getJornadas()
  } catch (e) {
    showAlerta(e?.message || 'No se pudieron cargar las jornadas', 'error')
  } finally {
    loading.value = false
  }
}

function alGuardar(reunion, { creada }) {
  if (creada && reunion?.id) router.push({ name: 'jornada', params: { id: reunion.id } })
  else cargar()
}

onMounted(async () => {
  await Promise.all([cargar(), categoriasStore.fetchAll()])
})
</script>

<template>
  <AppPage title="Jornadas" subtitle="Cronogramas por momentos de jornadas y retiros" :loading="loading" skeleton="cards">
    <template v-if="puedeCrear" #actions>
      <AppButton :icon="Plus" @click="formRef?.open()">Nueva jornada</AppButton>
    </template>

    <AppEmpty v-if="!tarjetas.length" :icon="ListOrdered"
      message="Aún no hay jornadas. Crea una o agenda en el calendario una reunión de categoría Jornada o Retiro.">
      <AppButton v-if="puedeCrear" :icon="Plus" @click="formRef?.open()">Nueva jornada</AppButton>
    </AppEmpty>

    <ul v-else class="grid-jornadas" role="list">
      <li v-for="j in tarjetas" :key="j.id">
        <RouterLink class="tarjeta" :to="{ name: 'jornada', params: { id: j.id } }">
          <div class="tarjeta__top">
            <span class="tarjeta__fecha"><CalendarDays :size="14" aria-hidden="true" /> {{ j.fechaTexto }}</span>
            <ChevronRight :size="16" aria-hidden="true" />
          </div>
          <span class="tarjeta__cat">{{ j.categoria?.nombre }}</span>
          <h2 class="tarjeta__nombre">{{ j.nombre_tema }}</h2>
          <template v-if="j.horario">
            <p class="tarjeta__horario"><Clock :size="14" aria-hidden="true" /> {{ j.horario }}</p>
            <p class="tarjeta__meta">
              <b>{{ j.duracion }}</b> · {{ j.programados }} momento{{ j.programados === 1 ? '' : 's' }}<template
                v-if="j.sinHora"> · {{ j.sinHora }} sin hora</template>
            </p>
          </template>
          <p v-else class="tarjeta__meta text-muted">
            Sin momentos programados<template v-if="j.sinHora"> · {{ j.sinHora }} sin hora</template>
          </p>
        </RouterLink>
      </li>
    </ul>

    <JornadaFormModal v-if="puedeCrear" ref="formRef" @guardado="alGuardar" />
  </AppPage>
</template>

<style scoped>
.grid-jornadas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tarjeta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  height: 100%;
  padding: 1rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text);
  text-decoration: none;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.tarjeta:hover { border-color: var(--accent); transform: translateY(-1px); }
.tarjeta:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.tarjeta__top { display: flex; justify-content: space-between; align-items: center; color: var(--text-muted); }
.tarjeta__fecha { display: inline-flex; align-items: center; gap: 0.35rem; font-size: var(--fs-ui); }
.tarjeta__cat {
  align-self: flex-start;
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 600;
}
.tarjeta__nombre { margin: 0; font-size: var(--fs-lg, 1.1rem); font-weight: 700; }
.tarjeta__horario { display: inline-flex; align-items: center; gap: 0.35rem; margin: 0; font-weight: 600; }
.tarjeta__meta { margin: 0; font-size: var(--fs-ui); }
@media (max-width: 767px) {
  .grid-jornadas { gap: 0.6rem; }
  .tarjeta { padding: 0.75rem 0.85rem; }
}
</style>
