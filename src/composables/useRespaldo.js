import { ref } from 'vue'
import { showAlerta } from '@/funciones'
import { useParroquiaStore } from '@/stores/parroquia'
import { leerDatosParroquia } from '@/services/respaldo'
import { registrarExportacion } from '@/services/parroquia'
import { armarHojasRespaldo, nombreArchivoRespaldo } from '@/lib/respaldoParroquia'

// Descarga del respaldo completo de la parroquia (Excel, una hoja por tabla).
// Lo usan la pestaña «Respaldo» y el diálogo de cierre de ciclo.
export function useRespaldo() {
  const parroquiaStore = useParroquiaStore()
  const trabajando = ref(false)
  const paso = ref('')
  const descargado = ref(false)

  async function descargar() {
    if (trabajando.value) return false
    trabajando.value = true
    try {
      const datos = await leerDatosParroquia((t) => { paso.value = t })
      paso.value = 'Armando el archivo…'
      const hojas = armarHojasRespaldo(datos)
      const generadores = await import('@/lib/exportConfirmandosArchivos')
      const blob = await generadores.generarLibro(hojas)
      const nombre = nombreArchivoRespaldo(parroquiaStore.parroquia?.slug)
      const resultado = await generadores.guardarArchivo(blob, nombre, generadores.TIPOS_ARCHIVO.xlsx)
      if (resultado !== 'guardado') return false
      registrarExportacion().catch(() => {})
      const total = hojas.reduce((s, h) => s + h.filas.length, 0)
      showAlerta(`Respaldo descargado (${total} registros en ${hojas.length} hojas).`, 'success')
      descargado.value = true
      return true
    } catch (e) {
      showAlerta(e?.message || 'No se pudo generar el respaldo.', 'error')
      return false
    } finally {
      trabajando.value = false
      paso.value = ''
    }
  }

  return { trabajando, paso, descargado, descargar }
}
