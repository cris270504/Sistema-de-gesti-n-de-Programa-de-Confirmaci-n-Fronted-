import api from '@/lib/api'
import { supabase } from '@/lib/supabase'

// Fase 3 migración Supabase: las LECTURAS de confirmandos van directo a PostgREST
// (la RLS acota por parroquia y por grupo del catequista, igual que hacía el
// filtro en ConfirmandoController). Las escrituras y lo que necesita lógica
// (perfil, buscar-apoderados, importar/exportar Excel) siguen en Laravel hasta
// las Fases 4/5.

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

// PostgREST embebe las relaciones N:M a través de la tabla puente. Se aplanan a
// la forma `{ ...entidad, pivot: {...columnas del puente} }` que ya usa el
// frontend (convención de Eloquent: `s.pivot.estado`, `ap.pivot.tipo_apoderado_id`).
function aplanarM2M(rows, puente, entidad, pivotCols) {
  const flat = (row) => ({
    ...row,
    [entidad + 's']: (row[puente] ?? []).map((link) => ({
      ...link[entidad],
      pivot: Object.fromEntries(pivotCols.map((c) => [c, link[c]])),
    })),
    [puente]: undefined,
  })
  return Array.isArray(rows) ? rows.map(flat) : flat(rows)
}

const SELECT_LISTA =
  'id, nombres, apellidos, fecha_nacimiento, genero, celular, estado, grupo_id,' +
  ' grupo:grupos(id, nombre, color, procedencia),' +
  ' confirmando_sacramento(estado, sacramento:sacramentos(id, nombre))'

const SELECT_DETALLE =
  '*,' +
  ' grupo:grupos(*),' +
  ' confirmando_sacramento(estado, sacramento:sacramentos(id, nombre, clave)),' +
  ' confirmando_requisito(estado, fecha_entrega, requisito:requisitos(id, nombre)),' +
  ' confirmando_apoderado(tipo_apoderado_id, apoderado:apoderados(id, nombres, apellidos, celular))'

function aplanarConfirmando(row) {
  let r = aplanarM2M(row, 'confirmando_sacramento', 'sacramento', ['estado'])
  r = aplanarM2M(r, 'confirmando_requisito', 'requisito', ['estado', 'fecha_entrega'])
  r = aplanarM2M(r, 'confirmando_apoderado', 'apoderado', ['tipo_apoderado_id'])
  return r
}

export async function getConfirmandosList() {
  const rows = await unwrap(
    supabase.from('confirmandos').select(SELECT_LISTA).order('id', { ascending: false }),
  )
  return rows.map((r) => aplanarM2M(r, 'confirmando_sacramento', 'sacramento', ['estado']))
}

export async function getConfirmandoById(id) {
  const row = await unwrap(
    supabase.from('confirmandos').select(SELECT_DETALLE).eq('id', Number(id)).single(),
  )
  return aplanarConfirmando(row)
}

// ── Alta/edición: RPC transaccional fn_guardar_confirmando ──────────────────
// Reparte el payload plano del modal en los argumentos de la función (datos del
// confirmando + ruta sacramental + apoderados + requisitos), llama a la RPC y
// re-lee el detalle para devolver la misma forma que esperaba el controlador
// (`{ message, confirmando }`).
async function guardarConfirmando(id, payload) {
  const {
    sacramento_faltante_id = null,
    apoderados,
    requisitos_actualizar = null,
    ...datos
  } = payload

  const { data: nuevoId, error } = await supabase.rpc('fn_guardar_confirmando', {
    p_id: id ? Number(id) : null,
    p_datos: datos,
    p_sacramento_faltante_id: sacramento_faltante_id ? Number(sacramento_faltante_id) : null,
    // `apoderados` ausente (modal de requisitos) => no se tocan; array (incl. []) => sync
    p_apoderados: apoderados === undefined ? null : apoderados,
    p_requisitos: requisitos_actualizar,
  })
  if (error) throw new Error(error.message)

  return {
    message: id ? 'Confirmando actualizado correctamente' : 'Confirmando creado y ruta sacramental asignada',
    confirmando: await getConfirmandoById(nuevoId),
  }
}

export function createConfirmando(confirmando) {
  return guardarConfirmando(null, confirmando)
}

export async function obtenerPerfilConfirmando(id) {
  // Fase 3: lee la vista v_confirmando_perfil (stats + historial ya calculados en
  // SQL) y la re-arma con la forma que espera PerfilConfirmandoModal.
  const { data, error } = await supabase
    .from('v_confirmando_perfil')
    .select('*')
    .eq('id', Number(id))
    .single()
  if (error) throw new Error(error.message)

  return {
    status: true,
    joven: {
      nombres: data.nombres,
      apellidos: data.apellidos,
      grupo: data.grupo,
      sacramentos_faltantes: data.sacramentos_faltantes,
    },
    apoderado: data.apoderado,
    estadisticas: {
      asistencias: data.stat_asistencias,
      tardanzas: data.stat_tardanzas,
      justificadas: data.stat_justificadas,
      injustificadas: data.stat_injustificadas,
    },
    historial_asistencias: data.historial_asistencias ?? [],
  }
}

export function updateConfirmando(id, confirmando) {
  return guardarConfirmando(id, confirmando)
}

export function deleteConfirmandoById(id) {
  return api.delete(`/confirmandos/${id}`).then((res) => res.data)
}

export function retirarConfirmandoById(id) {
  return api.put(`/confirmandos/${id}/retirar`).then((res) => res.data)
}

export function importarConfirmandosExcel(formData) {
  return api.post('/confirmandos/importar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((res) => res.data)
}

export const exportarConfirmandosExcel = async () => {
  const response = await api.get('/confirmandos/exportar', { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'Confirmandos_por_Grupos.xlsx')
  document.body.appendChild(link)
  link.click()
  link.remove()
}
