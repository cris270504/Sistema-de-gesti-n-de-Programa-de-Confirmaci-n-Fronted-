<script setup>
import { ref, computed, onMounted } from 'vue'
import { History, RefreshCw } from 'lucide-vue-next'
import AppButton from '@/components/AppButton.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import { getHistorialParroquia } from '@/services/parroquia'
import { describirCambio } from '@/lib/historialParroquia'

const filas = ref([])
const cargando = ref(false)
const error = ref('')

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    filas.value = await getHistorialParroquia({ limite: 150 })
  } catch (e) {
    error.value = e?.message || 'No se pudo cargar el historial.'
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

const vista = computed(() => filas.value.map((f) => ({ ...f, ...describirCambio(f) })))
const fmt = (iso) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <section class="hist surface" aria-labelledby="hist-titulo">
    <header class="hist__head">
      <History :size="17" aria-hidden="true" />
      <h3 id="hist-titulo" class="hist__titulo">Historial de cambios</h3>
      <p class="hist__hint">Quién cambió qué en la parroquia: configuración, usuarios, roles, grupos, reuniones y estados de los jóvenes.</p>
      <AppButton variant="secondary" size="sm" :icon="RefreshCw" :loading="cargando" @click="cargar">Actualizar</AppButton>
    </header>

    <p v-if="error" class="hist__error" role="alert">{{ error }}</p>
    <AppEmpty v-else-if="!cargando && vista.length === 0" :icon="History"
      message="Todavía no hay cambios registrados. Aparecerán aquí a partir de ahora." />
    <ol v-else class="hist__lista">
      <li v-for="f in vista" :key="f.id" class="hist__item" :class="`hist__item--${f.tono}`">
        <span class="hist__punto" aria-hidden="true"></span>
        <div class="hist__txt">
          <p class="hist__linea">{{ f.texto }} <b v-if="f.objetivo">{{ f.objetivo }}</b> <span v-if="f.extra">{{ f.extra }}</span></p>
          <span class="hist__meta">
            <time :datetime="f.created_at">{{ fmt(f.created_at) }}</time>
            <template v-if="f.actor_nombre"> · {{ f.actor_nombre }}</template>
          </span>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.hist { padding: 1.1rem 1.25rem; }
.hist__head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; margin-bottom: 0.75rem; color: var(--text-muted); }
.hist__titulo { margin: 0; font-size: var(--fs-base); font-weight: 700; color: var(--text); }
.hist__hint { margin: 0 auto 0 0; flex: 1 1 280px; font-size: var(--fs-sm); color: var(--text-muted); }
.hist__error { margin: 0; color: var(--danger); font-size: var(--fs-sm); }
.hist__lista { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 0 1.5rem; }
.hist__item { display: flex; gap: 0.6rem; padding: 0.55rem 0; border-top: 1px solid var(--line); }
.hist__punto { width: 8px; height: 8px; margin-top: 0.45rem; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
.hist__item--peligro .hist__punto { background: var(--danger); }
.hist__item--ok .hist__punto { background: #10b981; }
.hist__txt { min-width: 0; }
.hist__linea { margin: 0; font-size: var(--fs-sm); line-height: 1.45; color: var(--text-muted); overflow-wrap: anywhere; }
.hist__linea b { color: var(--text); font-weight: 600; }
.hist__meta { font-size: var(--fs-xs); color: var(--text-muted); }
</style>
