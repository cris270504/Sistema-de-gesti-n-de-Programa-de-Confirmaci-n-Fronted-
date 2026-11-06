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
  } catch {
    // FK: hay reuniones con esta categoría.
    showAlerta('Hay reuniones con esta categoría. Desactívala en lugar de eliminarla.', 'warning')
  } finally {
    guardando.value = null
  }
}

onMounted(() => categoriasStore.fetchAll({ force: true }))
</script>

<template>
  <div class="field">
    <label id="cat-titulo">Categorías de reunión</label>
    <small class="d-block mb-2">
      Se anteponen al título en el calendario. Las que permiten cronograma se organizan por momentos en el módulo Jornadas.
    </small>
    <table class="cats" aria-labelledby="cat-titulo">
      <thead>
        <tr><th scope="col">Nombre</th><th scope="col">Cronograma</th><th scope="col">Activa</th><th scope="col"><span class="visually-hidden">Acciones</span></th></tr>
      </thead>
      <tbody>
        <tr v-for="cat in categorias" :key="cat.id" :class="{ 'cats__fila--off': !cat.activa }">
          <td>
            <input :value="cat.nombre" class="inp" maxlength="40" :aria-label="`Nombre de la categoría ${cat.nombre}`"
              :disabled="guardando === cat.id"
              @change="cambiar(cat, { nombre: $event.target.value })">
          </td>
          <td>
            <input type="checkbox" class="form-check-input" :checked="cat.permite_cronograma"
              :aria-label="`${cat.nombre} permite cronograma`" :disabled="guardando === cat.id"
              @change="cambiar(cat, { permite_cronograma: $event.target.checked })">
          </td>
          <td>
            <input type="checkbox" class="form-check-input" :checked="cat.activa"
              :aria-label="`${cat.nombre} activa`" :disabled="guardando === cat.id"
              @change="cambiar(cat, { activa: $event.target.checked })">
          </td>
          <td class="text-end">
            <AppButton variant="soft-danger" size="sm" icon-only :icon="Trash" :aria-label="`Eliminar ${cat.nombre}`"
              :disabled="guardando === cat.id" @click="eliminar(cat)" />
          </td>
        </tr>
        <tr>
          <td>
            <input v-model="nueva.nombre" class="inp" maxlength="40" placeholder="Nueva categoría" aria-label="Nombre de la nueva categoría"
              @keydown.enter.prevent="agregar">
          </td>
          <td>
            <input v-model="nueva.permite_cronograma" type="checkbox" class="form-check-input" aria-label="La nueva categoría permite cronograma">
          </td>
          <td></td>
          <td class="text-end">
            <AppButton size="sm" icon-only :icon="Plus" aria-label="Agregar categoría" :loading="guardando === 'nueva'"
              :disabled="!nueva.nombre.trim()" @click="agregar" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.cats { width: 100%; max-width: 32rem; border-collapse: collapse; font-size: var(--fs-ui); }
.cats th { padding: 0.25rem 0.4rem; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-align: left; }
.cats td { padding: 0.3rem 0.4rem; border-top: 1px solid var(--line); vertical-align: middle; }
.cats .inp { width: 100%; }
.cats__fila--off .inp { opacity: 0.6; }
</style>
