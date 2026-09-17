import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useGruposStore } from '@/stores/grupos'
import { useParroquiaStore } from '@/stores/parroquia'
import { useConfirmandosStore } from '@/stores/confirmandos'

const DEBOUNCE_MS = 300

function normalizarProcedencia(str) {
  return (str ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Filtros + paginación server-side del listado de confirmandos. Cambiar
 * cualquier filtro vuelve a la página 1 (services/confirmandos.js:
 * getConfirmandosPaginado ya hace el filtrado en el backend); solo el
 * buscador de texto lleva debounce — los selects/radios de estado, grupo y
 * procedencia disparan la consulta al instante.
 */
export function useConfirmandosFilters() {
  const authStore = useAuthStore()
  const gruposStore = useGruposStore()
  const parroquiaStore = useParroquiaStore()
  const confirmandosStore = useConfirmandosStore()

  const filtros = ref({
    search: '',
    estado: parroquiaStore.confirmandosEstadoDefault,
    grupo: 'todos',
    procedencia: 'todos',
  })

  const aplicarFiltros = () => {
    confirmandosStore.fetchPaginado({ page: 1, filters: { ...filtros.value } })
  }

  let searchDebounceTimer = null
  watch(() => filtros.value.search, () => {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(aplicarFiltros, DEBOUNCE_MS)
  })
  watch(() => [filtros.value.estado, filtros.value.grupo, filtros.value.procedencia], () => {
    clearTimeout(searchDebounceTimer)
    aplicarFiltros()
  })

  const limpiarFiltros = () => {
    filtros.value = { search: '', estado: 'todos', grupo: 'todos', procedencia: 'todos' }
  }

  const totalPages = computed(() => {
    const total = confirmandosStore.pagina.total || 0
    return total > 0 ? Math.ceil(total / confirmandosStore.pagination.pageSize) : 0
  })

  const cambiarPagina = (page) => {
    if (page >= 1 && page <= totalPages.value) {
      confirmandosStore.fetchPaginado({ page })
    }
  }

  // Selector de grupos en cascada: si hay procedencia elegida, solo muestra
  // los grupos de esa procedencia.
  const gruposDisponibles = computed(() => {
    let grupos = authStore.can('ver todos los grupos') ? gruposStore.items : (authStore.user?.grupos || [])
    if (filtros.value.procedencia !== 'todos') {
      grupos = grupos.filter(g => g.procedencia && normalizarProcedencia(g.procedencia) === filtros.value.procedencia)
    }
    return grupos
  })

  // Si cambia la procedencia, reseteamos el grupo (dispara aplicarFiltros vía
  // el watch de arriba).
  watch(() => filtros.value.procedencia, () => {
    filtros.value.grupo = 'todos'
  })

  return { filtros, limpiarFiltros, totalPages, cambiarPagina, gruposDisponibles }
}
