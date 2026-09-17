import { ref } from 'vue'
import { Modal } from 'bootstrap'
import { showAlerta } from '@/funciones'
import { attachModalFocusReturn } from '@/composables/useModalFocusReturn'
import { useConfirmandosStore } from '@/stores/confirmandos'

const EXTENSIONES_PERMITIDAS = ['xls', 'xlsx', 'csv']

/**
 * Importación de confirmandos desde Excel/CSV: valida la extensión, sube el
 * archivo y recarga la tabla. `recargarTabla` la decide quien llama (hoy es
 * `fetchPaginado({ force: true })` en ListConfirmandos.vue) — este composable
 * no necesita saber cómo se recarga, solo que hay que avisar al terminar.
 *
 * @param {() => void} recargarTabla
 */
export function useImportExcel(recargarTabla) {
  const confirmandosStore = useConfirmandosStore()

  const fileInputRef = ref(null)
  const isImporting = ref(false)
  const importModalInstance = ref(null)
  let detachImportFocusReturn = () => {}

  const initImportModal = () => {
    const el = document.getElementById('importFormatModal')
    if (el) {
      importModalInstance.value = new Modal(el)
      detachImportFocusReturn = attachModalFocusReturn(el)
    }
  }

  const abrirImportModal = () => importModalInstance.value?.show()
  const triggerImport = () => fileInputRef.value.click()

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    const fileExtension = file.name.split('.').pop().toLowerCase()
    if (!EXTENSIONES_PERMITIDAS.includes(fileExtension)) {
      showAlerta('Por favor, sube un archivo Excel (.xls, .xlsx) o CSV', 'warning')
      event.target.value = ''
      return
    }

    importModalInstance.value?.hide()
    const formData = new FormData()
    formData.append('archivo', file)

    isImporting.value = true
    try {
      const response = await confirmandosStore.importarExcel(formData)
      showAlerta(response.message || 'Importación completada con éxito', 'success')
      recargarTabla()
    } catch (error) {
      let errorMsg = 'Error al importar el archivo.'
      if (error.response?.data?.errors) {
        const errores = Object.values(error.response.data.errors).flat()
        errorMsg = errores.join('\n')
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message
      }
      showAlerta(errorMsg, 'error')
    } finally {
      isImporting.value = false
      event.target.value = ''
    }
  }

  const dispose = () => {
    detachImportFocusReturn()
    importModalInstance.value?.dispose()
  }

  return {
    fileInputRef,
    isImporting,
    initImportModal,
    abrirImportModal,
    triggerImport,
    handleFileUpload,
    dispose,
  }
}
