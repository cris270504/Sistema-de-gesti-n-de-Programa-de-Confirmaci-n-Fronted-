import { supabase } from '@/lib/supabase'

// Confirmandos: todo vía Supabase. Lecturas → PostgREST (RLS por parroquia y
// grupo). Escrituras y lógica → RPCs (fn_guardar_confirmando, etc.). Import/
// export Excel → Edge Functions. El perfil lee la vista v_confirmando_perfil.

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

// Autocompletado del modal de confirmando: apoderados existentes (con al menos un
// confirmando) cuyo nombre o apellido contiene `q`. La RLS de apoderados acota por
// parroquia y grupo. Se de-duplica en cliente (el embed !inner repite fila por
// cada confirmando ligado).
export async function buscarApoderados(q) {
  const termino = (q ?? '').trim()
  if (termino.length < 3) return []
  const rows = await unwrap(
    supabase
      .from('apoderados')
      .select('id, nombres, apellidos, celular, confirmando_apoderado!inner(confirmando_id)')
      .or(`nombres.ilike.*${termino}*,apellidos.ilike.*${termino}*`)
      .order('apellidos')
      .limit(24),
  )
  const vistos = new Set()
  const out = []
  for (const r of rows) {
    if (vistos.has(r.id)) continue
    vistos.add(r.id)
    out.push({ id: r.id, nombres: r.nombres, apellidos: r.apellidos, celular: r.celular })
    if (out.length === 8) break
  }
  return out
}

export async function deleteConfirmandoById(id) {
  // RLS confirmandos_delete (app_is_privileged) + cascada de los pivotes por FK.
  const { error } = await supabase.from('confirmandos').delete().eq('id', Number(id))
  if (error) throw new Error(error.message)
  return { message: 'Confirmando eliminado correctamente' }
}

export async function retirarConfirmandoById(id) {
  const { error } = await supabase
    .from('confirmandos').update({ estado: 'retirado' }).eq('id', Number(id))
  if (error) throw new Error(error.message)
  return { status: true, message: 'Confirmando retirado del programa exitosamente.' }
}

// Import: Edge Function `importar-confirmandos` (parseo del .xlsx en Deno). El
// error se re-lanza con forma tipo-axios para que el catch de la vista siga
// distinguiendo `errors` (lista de filas omitidas) de `message`.
export async function importarConfirmandosExcel(formData) {
  const { data, error } = await supabase.functions.invoke('importar-confirmandos', { body: formData })
  if (!error) return data
  let payload = { message: error.message }
  try { payload = await error.context.json() } catch { /* sin cuerpo JSON */ }
  const e = new Error(payload.message || 'Error al importar el archivo.')
  e.response = { data: payload }
  throw e
}

// Export: Edge Function `exportar-confirmandos` → descarga binaria. Se hace con
// fetch directo (functions.invoke asume JSON).
export async function exportarConfirmandosExcel() {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exportar-confirmandos`, {
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || 'No se pudo generar el archivo.')
  }
  const url = window.URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'Confirmandos_por_Grupos.xlsx')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
