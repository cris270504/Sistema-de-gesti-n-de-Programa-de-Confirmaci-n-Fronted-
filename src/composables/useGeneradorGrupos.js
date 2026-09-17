import { ref, computed } from 'vue'
import { Modal } from 'bootstrap'
import { showAlerta } from '@/funciones'
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn'
import { useConfirmandosStore } from '@/stores/confirmandos'
import { useGruposStore } from '@/stores/grupos'
import { useParroquiaStore } from '@/stores/parroquia'

const PERIODO_ACTUAL = '2026'

export const ESTRATEGIAS = [
  ['genero', 'Por género'],
  ['edad', 'Por edad'],
  ['ninguno', 'Sin criterio'],
]

function edadDe(iso) {
  if (!iso) return null
  const hoy = new Date(), nacimiento = new Date(iso + 'T00:00:00')
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  if (hoy.getMonth() < nacimiento.getMonth() ||
      (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) edad--
  return edad
}

/**
 * Generador automático de grupos: reparte los confirmandos EN PREPARACIÓN sin
 * grupo, dentro del rango de edad configurado (igual que
 * fn_generar_grupos_equitativo en el backend). ListConfirmandos.vue ya no trae
 * la lista completa de confirmandos (paginación server-side); este composable
 * la carga on-demand solo al abrir el modal, porque el reparto necesita el
 * dataset entero para calcular quién no tiene grupo.
 */
export function useGeneradorGrupos() {
  const confirmandosStore = useConfirmandosStore()
  const gruposStore = useGruposStore()
  const parroquiaStore = useParroquiaStore()

  const generadorModalInstance = ref(null)
  const loadingGenerador = ref(false)
  const groupNames = ref([''])
  const stats = ref({ hombres: 0, mujeres: 0, total: 0 })
  const estrategiaGrupos = ref('genero')

  let detachGeneradorFocusReturn = () => {}

  const initGeneradorModal = () => {
    const el = document.getElementById('generadorGruposModal')
    if (el) {
      generadorModalInstance.value = new Modal(el)
      detachGeneradorFocusReturn = attachModalFocusReturn(el)
    }
  }

  const abrirGenerador = async () => {
    if (confirmandosStore.items.length === 0) {
      await confirmandosStore.fetchAll()
    }
    if (gruposStore.items.length === 0) {
      await gruposStore.fetchAll()
    }
    groupNames.value = gruposStore.items.length > 0
      ? gruposStore.items.map(g => g.nombre)
      : ['Grupo Nuevo 1']

    const { min, max } = parroquiaStore.gruposEdad
    const enRango = (c) => {
      const edad = edadDe(c.fecha_nacimiento)
      if (edad == null) return true // sin fecha → el motor lo incluye
      return (min == null || edad >= min) && (max == null || edad <= max)
    }
    const sinGrupo = confirmandosStore.items.filter(c => !c.grupo_id && c.estado === 'en_preparacion' && enRango(c))
    stats.value = {
      total: sinGrupo.length,
      hombres: sinGrupo.filter(c => c.genero === 'm' || c.genero === 'M').length,
      mujeres: sinGrupo.filter(c => c.genero === 'f' || c.genero === 'F').length,
    }
    generadorModalInstance.value?.show()
  }

  const addGroupInput = () => groupNames.value.push(`Grupo Nuevo ${groupNames.value.length + 1}`)
  const removeGroupInput = (index) => {
    if (groupNames.value.length > 1) groupNames.value.splice(index, 1)
  }

  const generarGruposApi = async () => {
    if (groupNames.value.some(n => n.trim() === '')) return showAlerta('Todos los grupos deben tener nombre', 'warning')
    if (stats.value.total === 0) return showAlerta('No hay confirmandos sin grupo para asignar.', 'warning')

    loadingGenerador.value = true
    try {
      const response = await gruposStore.generateGroups({
        nombres_grupos: groupNames.value,
        periodo: PERIODO_ACTUAL,
        estrategia: estrategiaGrupos.value,
      })
      generadorModalInstance.value?.hide()

      const sinAsignar = response.no_asignados ?? []
      if (sinAsignar.length > 0) {
        const lista = sinAsignar
          .map(c => `• ${c.apellidos}, ${c.nombres} — ${c.motivo}`)
          .join('\n')
        showAlerta(
          `${response.message}\n\n${sinAsignar.length} confirmando(s) quedaron sin grupo:\n${lista}\n\n` +
          `Ajusta el rango de edad en Configuración o corrige sus datos y vuelve a generar.`,
          'warning',
        )
      } else {
        showAlerta(response.message, 'success')
      }
      // El backend devuelve el mapa de asignaciones: parcheamos la lista en memoria
      // en vez de re-descargar los ~458 kB de confirmandos.
      if (response.asignaciones) {
        confirmandosStore.aplicarAsignaciones(response.asignaciones, response.grupos || [])
      } else {
        await confirmandosStore.fetchAll({ force: true })
        await confirmandosStore.fetchPaginado({ force: true })
      }
    } catch (error) {
      console.error('Error en la vista:', error)
    } finally {
      loadingGenerador.value = false
    }
  }

  const prediccion = computed(() => {
    const numGrupos = groupNames.value.length
    if (numGrupos === 0 || stats.value.total === 0) return null
    return {
      hombres: Math.floor(stats.value.hombres / numGrupos),
      mujeres: Math.floor(stats.value.mujeres / numGrupos),
      total: Math.floor(stats.value.total / numGrupos),
    }
  })

  const dispose = () => {
    detachGeneradorFocusReturn()
    generadorModalInstance.value?.dispose()
  }

  return {
    generadorModalInstance,
    loadingGenerador,
    groupNames,
    stats,
    estrategiaGrupos,
    prediccion,
    initGeneradorModal,
    abrirGenerador,
    addGroupInput,
    removeGroupInput,
    generarGruposApi,
    dispose,
  }
}
