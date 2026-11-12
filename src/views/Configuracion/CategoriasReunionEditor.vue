<script setup>
// Categorías de reunión de la parroquia (Reunión, Jornada, Retiro…). Cada una
// define si permite cronograma por momentos. Se guarda al momento, aparte del
// botón "Guardar" de Configuración (son filas propias, no parte de la config).
import { computed, onMounted, ref } from 'vue'
import { Plus, Trash } from 'lucide-vue-next'
import AppButton from '@/components/AppButton.vue'
import { confirmarEliminacion, showAlerta } from '@/funciones'
import { createCategoria, deleteCategoria, updateCategoria } from '@/services/jornadas'
import { useCategoriasReunionStore } from '@/stores/categoriasReunion'
import { useParroquiaStore } from '@/stores/parroquia'
import { useAuthStore } from '@/stores/auth'

const categoriasStore = useCategoriasReunionStore()
const parroquiaStore = useParroquiaStore()
const authStore = useAuthStore()

const nueva = ref({ nombre: '', permite_cronograma: false })
const guardando = ref(null)
const categorias = computed(() => categoriasStore.items)
const parroquiaId = computed(() => parroquiaStore.parroquia?.id ?? authStore.user?.parroquia_id ?? null)

async function refrescar() {
  await categoriasStore.fetchAll({ force: true })
  categoriasStore.refrescarHayJornadas()
}

async function cambiar(cat, cambios) {
  if (cambios.nombre !== undefined && !String(cambios.nombre).trim()) {
    showAlerta('El nombre no puede quedar vacío', 'warning')
    await refrescar()
    return
  }
  guardando.value = cat.id
  try {
    await updateCategoria(cat.id, cambios)
    await refrescar()
  } catch (e) {
    showAlerta(e?.message || 'No se pudo guardar la categoría', 'error')
    await refrescar()
  } finally {
    guardando.value = null
  }
}

async function agregar() {
  const nombre = nueva.value.nombre.trim()
  if (!nombre) return
  guardando.value = 'nueva'
  try {
    const orden = Math.max(-1, ...categorias.value.map((c) => c.orden ?? 0)) + 1
    await createCategoria({ ...nueva.value, nombre, orden }, parroquiaId.value)
    nueva.value = { nombre: '', permite_cronograma: false }
    await refrescar()
    showAlerta('Categoría agregada', 'success')
  } catch (e) {
    showAlerta(e?.message || 'No se pudo agregar la categoría', 'error')
  } finally {
    guardando.value = null
  }
}

async function eliminar(cat) {
  if (!(await confirmarEliminacion(cat.nombre))) return
  guardando.value = cat.id
  try {
    await deleteCategoria(cat.id)
    await refrescar()
  } catch (e) {
    // 23503 (FK): hay reuniones con esta categoría. Otro error → su motivo real.
    if (e?.code === '23503') {
      showAlerta('Hay reuniones con esta categoría. Desactívala en lugar de eliminarla.', 'warning')
    } else {
      showAlerta(e?.message || 'No se pudo eliminar la categoría.', 'error')
    }
  } finally {
    guardando.value = null
  }
}

onMounted(() => categoriasStore.fetchAll({ force: true }))
</script>

<template>
  <div class="cats" role="table" aria-label="Categorías de reunión">
    <div class="cat cat--head" role="row">
      <span role="columnheader">Categoría</span>
      <span role="columnheader">Cronograma</span>
      <span role="columnheader">Activa</span>
      <span role="columnheader"><span class="visually-hidden">Eliminar</span></span>
    </div>
    <div v-for="cat in categorias" :key="cat.id" class="cat" :class="{ 'cat--off': !cat.activa }" role="row">
      <span role="cell">
        <input :value="cat.nombre" class="cat__inp" maxlength="40" :aria-label="`Nombre de la categoría ${cat.nombre}`"
          :disabled="guardando === cat.id" @change="cambiar(cat, { nombre: $event.target.value })">
      </span>
      <span role="cell">
        <label class="sw">
          <input type="checkbox" class="sw__inp" :checked="cat.permite_cronograma" :disabled="guardando === cat.id"
            :aria-label="`${cat.nombre} permite cronograma`"
            @change="cambiar(cat, { permite_cronograma: $event.target.checked })">
          <span class="sw__track" aria-hidden="true"><span class="sw__thumb"></span></span>
          <span class="sw__txt">{{ cat.permite_cronograma ? 'Sí' : 'No' }}</span>
        </label>
      </span>
      <span role="cell">
        <label class="sw">
          <input type="checkbox" class="sw__inp" :checked="cat.activa" :disabled="guardando === cat.id"
            :aria-label="`${cat.nombre} activa`" @change="cambiar(cat, { activa: $event.target.checked })">
          <span class="sw__track" aria-hidden="true"><span class="sw__thumb"></span></span>
          <span class="sw__txt">{{ cat.activa ? 'Sí' : 'No' }}</span>
        </label>
      </span>
      <span role="cell">
        <button type="button" class="icon-btn" :disabled="guardando === cat.id" :aria-label="`Eliminar ${cat.nombre}`"
          title="Eliminar la categoría" @click="eliminar(cat)">
          <Trash :size="15" aria-hidden="true" />
        </button>
      </span>
    </div>

    <div class="cat cat--nueva" role="row">
      <span>
        <input v-model="nueva.nombre" class="cat__inp" maxlength="40" placeholder="Nueva categoría"
          aria-label="Nombre de la nueva categoría" @keydown.enter.prevent="agregar">
      </span>
      <span>
        <label class="sw">
          <input v-model="nueva.permite_cronograma" type="checkbox" class="sw__inp"
            aria-label="La nueva categoría permite cronograma">
          <span class="sw__track" aria-hidden="true"><span class="sw__thumb"></span></span>
          <span class="sw__txt">{{ nueva.permite_cronograma ? 'Sí' : 'No' }}</span>
        </label>
      </span>
      <span class="cat__agregar">
        <AppButton size="sm" type="button" :icon="Plus" :loading="guardando === 'nueva'"
          :disabled="!nueva.nombre.trim()" @click="agregar">Agregar</AppButton>
      </span>
    </div>
  </div>
</template>

<style scoped>
.cats { display: flex; flex-direction: column; }
.cat {
  display: grid; grid-template-columns: minmax(8rem, 1fr) 7rem 6rem 2.5rem;
  gap: 0.75rem; align-items: center; padding: 0.5rem 0; border-top: 1px solid var(--line);
}
.cat--head { border-top: 0; padding-top: 0; font-size: var(--fs-xs); font-weight: 700; color: var(--text-muted); }
.cat--nueva { margin: 0; }
.cat__agregar { grid-column: 3 / -1; justify-self: end; }
.cat__inp {
  width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-md);
  padding: 0.45rem 0.6rem; font-size: var(--fs-ui); background: var(--surface); color: var(--text);
}
.cat__inp:focus { outline: 2px solid var(--accent-ring); outline-offset: -1px; border-color: var(--accent); }
.cat--off .cat__inp { color: var(--text-muted); text-decoration: line-through; }

.sw { display: inline-flex; align-items: center; gap: 0.5rem; margin: 0; cursor: pointer; min-height: 36px; }
.sw__inp { position: absolute; opacity: 0; width: 1px; height: 1px; }
.sw__track { position: relative; width: 36px; height: 20px; border-radius: 999px; background: var(--line-strong); transition: background-color 0.15s ease; flex-shrink: 0; }
.sw__thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: var(--shadow-sm); transition: transform 0.15s ease; }
.sw__inp:checked + .sw__track { background: var(--accent); }
.sw__inp:checked + .sw__track .sw__thumb { transform: translateX(16px); }
.sw__inp:focus-visible + .sw__track { outline: 2px solid var(--accent); outline-offset: 2px; }
.sw__inp:disabled + .sw__track { opacity: 0.5; }
.sw__txt { font-size: var(--fs-sm); color: var(--text-muted); }

.icon-btn { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: var(--radius-md); background: transparent; color: var(--text-muted); cursor: pointer; transition: background-color 0.15s ease, color 0.15s ease; }
.icon-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }
.icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

@media (prefers-reduced-motion: reduce) {
  .sw__track, .sw__thumb, .icon-btn { transition: none; }
}
</style>
