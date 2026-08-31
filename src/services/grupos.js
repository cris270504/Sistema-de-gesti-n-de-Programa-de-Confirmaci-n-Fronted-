import api from '@/lib/api'
import { supabase } from '@/lib/supabase'

// Fase 3: lecturas de grupos → PostgREST (RLS: privilegiado ve su parroquia,
// catequista solo sus grupos). Fase 4: escrituras del grupo + reparto equitativo
// (RPC). El sync de catequistas/confirmandos y el listado de apoderados por grupo
// siguen en Laravel.

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

// `catequistas` es N:M vía `catequista_grupo` (sin PK compuesta → sin atajo M2M).
// Se embebe vía la tabla puente y se aplana a `grupo.catequistas = [User, ...]`.
const SELECT = `
  id, nombre, periodo, color, procedencia,
  catequista_grupo ( users ( id, name, email, celular ) ),
  confirmandos ( id, nombres, apellidos, estado, genero, fecha_nacimiento, grupo_id )
`.replace(/\s+/g, ' ').trim()

function aplanar(g) {
  return {
    ...g,
    catequistas: (g.catequista_grupo ?? []).map(cg => cg.users).filter(Boolean),
    catequista_grupo: undefined,
  }
}

export async function getGruposList() {
  const rows = await unwrap(supabase.from('grupos').select(SELECT).order('id', { ascending: true }))
  return rows.map(aplanar)
}

export async function getGrupoById(id) {
  const row = await unwrap(supabase.from('grupos').select(SELECT).eq('id', Number(id)).single())
  return aplanar(row)
}

// ── Escrituras del grupo en sí: Fase 4, PostgREST directo. El sync de
//    catequistas/confirmandos sigue en Laravel. ───────────────────────────────
const GRUPO_COLS = 'id, nombre, periodo, color, procedencia'

export async function createGrupo(grupo) {
  const { data, error } = await supabase.from('grupos').insert(grupo).select(GRUPO_COLS).single()
  if (error) throw new Error(error.message)
  return { grupo: { ...data, catequistas: [], confirmandos: [] } }
}

export async function updateGrupo(id, grupo) {
  const { data, error } = await supabase
    .from('grupos').update(grupo).eq('id', Number(id)).select(GRUPO_COLS).single()
  if (error) throw new Error(error.message)
  return { grupo: data }
}

export async function deleteGrupoById(id) {
  const { error } = await supabase.from('grupos').delete().eq('id', Number(id))
  if (error) throw new Error(error.message)
  return { message: 'Grupo eliminado' }
}

export function syncCatequists(grupoId, userIds) {
  return api.post(`/grupos/${grupoId}/sync-catequists`, { users: userIds }).then(res => res.data)
}

export function syncConfirmandos(grupoId, confirmandoIds) {
  return api.post(`/grupos/${grupoId}/sync-confirmandos`, { confirmandos: confirmandoIds }).then(res => res.data)
}

export function getApoderadosByGrupo(grupoId) {
  return api.get(`/grupos/${grupoId}/apoderados`).then(res => res.data)
}

// Reparto equitativo: RPC transaccional. La función hace el firstOrCreate de los
// grupos + round-robin por género en un UPDATE; acá solo se arma el mensaje
// "Caso A/B/C" (presentación) con los contadores que devuelve.
export async function generarGruposEquitativos({ nombres_grupos, periodo }) {
  const { data, error } = await supabase.rpc('fn_generar_grupos_equitativo', {
    p_nombres: nombres_grupos.map(n => n.trim()),
    p_periodo: periodo,
  })
  if (error) throw new Error(error.message)

  const { total_asignados, grupos_nuevos, grupos_existentes } = data
  const n = grupos_nuevos + grupos_existentes
  let message
  if (grupos_nuevos === n) {
    message = `Se crearon ${n} nuevos grupos y se asignaron ${total_asignados} confirmandos.`
  } else if (grupos_nuevos === 0) {
    message = `Se asignaron ${total_asignados} confirmandos a ${n} grupos existentes.`
  } else {
    message = `Se crearon ${grupos_nuevos} grupos, se usaron ${grupos_existentes} existentes y se asignaron ${total_asignados} confirmandos.`
  }

  return { ...data, message }
}
