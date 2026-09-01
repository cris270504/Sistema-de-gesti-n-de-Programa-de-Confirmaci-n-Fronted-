import { supabase } from '@/lib/supabase'

// Grupos: todo vía Supabase. Lecturas → PostgREST (RLS: privilegiado ve su
// parroquia, catequista solo sus grupos). Escrituras del grupo → PostgREST;
// reparto equitativo y sync de catequistas/confirmandos → RPC transaccional.

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

// Sync de catequistas / confirmandos de un grupo: RPC transaccional (varias filas,
// atómico). La función devuelve el grupo_id; re-leemos el detalle para devolver
// `{ message, grupo }` como consumían assignCatequists / assignConfirmandos.
async function syncGrupo(rpc, grupoId, arg, key, message) {
  const { error } = await supabase.rpc(rpc, { p_grupo_id: Number(grupoId), [key]: arg ?? [] })
  if (error) throw new Error(error.message)
  return { message, grupo: await getGrupoById(grupoId) }
}

export function syncCatequists(grupoId, userIds) {
  return syncGrupo('fn_sync_catequistas_grupo', grupoId, userIds?.map(Number), 'p_user_ids', 'Catequistas actualizados')
}

export function syncConfirmandos(grupoId, confirmandoIds) {
  return syncGrupo('fn_sync_confirmandos_grupo', grupoId, confirmandoIds?.map(Number), 'p_confirmando_ids', 'Confirmandos actualizados')
}

// Apoderados cuyos confirmandos están en el grupo (con sus confirmandos). RLS de
// apoderados / confirmando_apoderado acota por parroquia y grupo del catequista.
export async function getApoderadosByGrupo(grupoId) {
  const rows = await unwrap(
    supabase
      .from('apoderados')
      .select('id, nombres, apellidos, celular, confirmando_apoderado!inner(confirmandos!inner(id, nombres, apellidos, grupo_id))')
      .eq('confirmando_apoderado.confirmandos.grupo_id', Number(grupoId)),
  )
  return rows.map(a => ({
    id: a.id,
    nombres: a.nombres,
    apellidos: a.apellidos,
    celular: a.celular,
    confirmandos: (a.confirmando_apoderado ?? [])
      .map(link => link.confirmandos)
      .filter(c => c && c.grupo_id === Number(grupoId))
      .map(({ id, nombres, apellidos }) => ({ id, nombres, apellidos })),
  }))
}

// Reparto equitativo: RPC transaccional. La función hace el firstOrCreate de los
// grupos + round-robin por género en un UPDATE; acá solo se arma el mensaje
// "Caso A/B/C" (presentación) con los contadores que devuelve.
export async function generarGruposEquitativos({ nombres_grupos, periodo, estrategia = 'genero' }) {
  const { data, error } = await supabase.rpc('fn_generar_grupos_equitativo', {
    p_nombres: nombres_grupos.map(n => n.trim()),
    p_periodo: periodo,
    p_estrategia: estrategia,
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
