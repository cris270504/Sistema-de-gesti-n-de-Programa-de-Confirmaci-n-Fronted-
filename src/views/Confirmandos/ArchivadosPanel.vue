<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Archive, RotateCcw, Search } from 'lucide-vue-next'
import AppButton from '@/components/AppButton.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import { showAlerta, confirmar } from '@/funciones'
import { listCiclos, listArchivados, filtrarArchivados, reactivarConfirmandos } from '@/services/ciclos'

const emit = defineEmits(['reactivados'])

const ESTADO = { en_preparacion: 'En preparación', confirmado: 'Confirmado', retirado: 'Retirado' }

const ciclos = ref([])
const cicloId = ref(null)
const lista = ref([])
const busqueda = ref('')
const seleccion = ref(new Set())
const cargando = ref(false)
const reactivando = ref(false)

// Solo los ciclos que archivaron (mantener) y siguen cerrados.
const ciclosConArchivados = computed(() => ciclos.value.filter((c) => c.modo === 'mantener' && !c.reabierto_at))
const visibles = computed(() => filtrarArchivados(lista.value, busqueda.value))
const todosVisiblesMarcados = computed(() =>
  visibles.value.length > 0 && visibles.value.every((c) => seleccion.value.has(c.id)))

async function cargarCiclos() {
  try {
    ciclos.value = await listCiclos()
    cicloId.value = ciclosConArchivados.value[0]?.id ?? null
  } catch (e) {
    showAlerta(e?.message || 'No se pudieron cargar los ciclos.', 'error')
  }
}

async function cargarLista() {
  seleccion.value = new Set()
  lista.value = []
  if (!cicloId.value) return
  cargando.value = true
  try {
    lista.value = await listArchivados(cicloId.value)
  } catch (e) {
    showAlerta(e?.message || 'No se pudieron cargar los archivados.', 'error')
  } finally {
    cargando.value = false
  }
}

onMounted(async () => { await cargarCiclos(); await cargarLista() })
watch(cicloId, cargarLista)

function alternar(id) {
  const s = new Set(seleccion.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  seleccion.value = s
}
function alternarTodos() {
  const s = new Set(seleccion.value)
  if (todosVisiblesMarcados.value) visibles.value.forEach((c) => s.delete(c.id))
  else visibles.value.forEach((c) => s.add(c.id))
  seleccion.value = s
}

async function reactivar() {
  const ids = [...seleccion.value]
  if (!ids.length || reactivando.value) return
  const ok = await confirmar({
    titulo: `¿Reactivar a ${ids.length} ${ids.length === 1 ? 'joven' : 'jóvenes'}?`,
    texto: 'Vuelven al ciclo actual en preparación y sin grupo, con todo su historial. Después puedes asignarles grupo.',
    icono: 'question',
    confirmarTexto: 'Sí, reactivar',
  })
  if (!ok) return
  reactivando.value = true
  try {
    const res = await reactivarConfirmandos(ids)
    showAlerta(`${res.reactivados} ${res.reactivados === 1 ? 'joven reactivado' : 'jóvenes reactivados'}.`, 'success')
    await cargarLista()
    emit('reactivados')
  } catch (e) {
    showAlerta(e?.message || 'No se pudo reactivar.', 'error')
  } finally {
    reactivando.value = false
  }
}
</script>

<template>
  <section class="arch" aria-labelledby="arch-titulo">
    <header class="arch__barra">
      <h2 id="arch-titulo" class="arch__titulo"><Archive :size="16" aria-hidden="true" /> Archivados</h2>
      <label class="arch__campo">
        <span class="arch__sr">Ciclo</span>
        <select v-model="cicloId" class="form-select form-select-sm" :disabled="!ciclosConArchivados.length">
          <option v-for="c in ciclosConArchivados" :key="c.id" :value="c.id">Ciclo {{ c.nombre }} ({{ c.jovenes }})</option>
        </select>
      </label>
      <label class="arch__buscar">
        <span class="arch__sr">Buscar archivado</span>
        <Search :size="15" aria-hidden="true" />
        <input v-model="busqueda" type="search" placeholder="Buscar por nombre…" />
      </label>
      <AppButton :icon="RotateCcw" :loading="reactivando" :disabled="seleccion.size === 0" @click="reactivar">
        Reactivar{{ seleccion.size ? ` (${seleccion.size})` : '' }}
      </AppButton>
    </header>

    <AppEmpty v-if="!ciclosConArchivados.length" :icon="Archive"
      message="No hay jóvenes archivados. Se archivan al cerrar un ciclo en Configuración → Ciclos." />
    <p v-else-if="cargando" class="arch__estado" aria-live="polite">Cargando…</p>
    <AppEmpty v-else-if="visibles.length === 0" :icon="Search" message="Ningún archivado coincide con la búsqueda." />

    <div v-else class="table-responsive">
      <table class="table align-middle mb-0 arch__tabla">
        <thead>
          <tr>
            <th class="arch__check">
              <input type="checkbox" class="form-check-input" :checked="todosVisiblesMarcados"
                aria-label="Seleccionar todos los visibles" @change="alternarTodos" />
            </th>
            <th>Joven</th>
            <th>Estado al cerrar</th>
            <th>Celular</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in visibles" :key="c.id" :class="{ 'arch__fila--on': seleccion.has(c.id) }" @click="alternar(c.id)">
            <td class="arch__check" @click.stop>
              <input type="checkbox" class="form-check-input" :checked="seleccion.has(c.id)"
                :aria-label="`Seleccionar a ${c.apellidos}, ${c.nombres}`" @change="alternar(c.id)" />
            </td>
            <td class="fw-semibold">{{ c.apellidos }}, {{ c.nombres }}</td>
            <td>{{ ESTADO[c.estado] ?? c.estado }}</td>
            <td class="text-muted">{{ c.celular || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.arch__barra { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border-bottom: 1px solid var(--line); }
.arch__titulo { margin: 0 auto 0 0; display: inline-flex; align-items: center; gap: 0.4rem; font-size: var(--fs-base); font-weight: 700; color: var(--text); }
.arch__campo { margin: 0; min-width: 12rem; }
.arch__buscar { display: flex; align-items: center; gap: 0.4rem; margin: 0; padding: 0 0.7rem; min-height: 38px; border: 1px solid var(--line-strong); border-radius: var(--radius-md); background: var(--surface); color: var(--text-muted); flex: 0 1 240px; }
.arch__buscar input { border: 0 !important; box-shadow: none !important; padding: 0 !important; background: transparent; min-width: 0; flex: 1; }
.arch__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.arch__estado { margin: 0; padding: 1.5rem; text-align: center; color: var(--text-muted); }
.arch__tabla tbody tr { cursor: pointer; }
.arch__fila--on td { background: var(--accent-soft) !important; }
.arch__check { width: 3rem; padding-left: 1rem !important; }
.arch__check input { width: 1.15rem; height: 1.15rem; cursor: pointer; }
.arch :deep(.app-btn) { min-height: 40px; }
@media (max-width: 575.98px) {
  .arch__campo, .arch__buscar { flex: 1 1 100%; }
}
</style>
