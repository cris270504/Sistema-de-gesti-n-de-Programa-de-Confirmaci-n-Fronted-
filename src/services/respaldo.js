import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'
import { getConfirmandosExport } from '@/services/confirmandos'
import { getJustificacionAcciones } from '@/services/parroquia'
import { listCiclos } from '@/services/ciclos'

// Lectura de todos los datos de la parroquia para el respaldo. La RLS acota
// cada consulta a la parroquia del usuario; se pagina de a 1000 filas porque
// PostgREST corta ahí por defecto.
const PAGINA = 1000

async function leerTodo(tabla, columnas, orden = 'id') {
  const filas = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from(tabla)
      .select(columnas)
      .order(orden, { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (error) throw errorLegible(error)
    filas.push(...(data ?? []))
    if (!data || data.length < PAGINA) break
  }
  return filas
}

// onPaso(texto): para mostrar el avance ("Leyendo asistencias…").
export async function leerDatosParroquia(onPaso = () => {}) {
  onPaso('Leyendo jóvenes…')
  // También los archivados en ciclos cerrados: el respaldo es de toda la parroquia.
  const [confirmandos, ciclos] = await Promise.all([
    getConfirmandosExport({ filters: { estado: 'todos' }, incluirArchivados: true }),
    listCiclos(),
  ])
  onPaso('Leyendo apoderados y grupos…')
  const [apoderados, grupos, usuarios] = await Promise.all([
    leerTodo('apoderados', 'id, nombres, apellidos, celular'),
    leerTodo('grupos', 'id, nombre, procedencia, periodo'),
    leerTodo('v_usuarios', 'id, name, email, dni, celular, activo, roles, grupos'),
  ])
  onPaso('Leyendo reuniones y asistencias…')
  const [reuniones, asistencias] = await Promise.all([
    leerTodo('reunions', 'id, nombre_tema, fecha, tipo, descripcion'),
    leerTodo('asistencia', 'id, reunion_id, asistente_type, asistente_id, estado, nota'),
  ])
  onPaso('Leyendo justificaciones…')
  const [justificaciones, acciones] = await Promise.all([
    leerTodo('justificaciones', 'id, asistencia_id, motivo, descripcion, fecha_acuerdo, tipo_accion, estado'),
    getJustificacionAcciones(),
  ])
  return { confirmandos, apoderados, grupos, usuarios, reuniones, asistencias, justificaciones, acciones, ciclos }
}
