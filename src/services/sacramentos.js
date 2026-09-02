import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

// Fase 3 migración Supabase: las LECTURAS del catálogo van directo a PostgREST
// (la RLS por parroquia las acota). Las escrituras siguen en Laravel hasta la
// Fase 4 (validación `unique` por parroquia + invalidación de caché).

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw errorLegible(error)
  return data
}

// PostgREST no expone el atajo M2M cuando la tabla puente tiene PK propia + UNIQUE
// (en vez de PK compuesta), así que embebemos vía `sacramento_requisito` y
// aplanamos para conservar la forma `{ ...sacramento, requisitos: [...] }` que
// espera el frontend.
const SELECT = 'id, nombre, clave, sacramento_requisito(requisitos(id, nombre))'

function aplanar(s) {
  return {
    ...s,
    requisitos: (s.sacramento_requisito ?? []).map(sr => sr.requisitos).filter(Boolean),
    sacramento_requisito: undefined,
  }
}

export async function getSacramentosList() {
  const rows = await unwrap(
    supabase.from('sacramentos').select(SELECT).order('id', { ascending: false }),
  )
  return rows.map(aplanar)
}

export async function getSacramentoById(id) {
  const row = await unwrap(
    supabase.from('sacramentos').select(SELECT).eq('id', Number(id)).single(),
  )
  return aplanar(row)
}

// ── Escrituras: Fase 4, PostgREST directo (RLS: solo privilegiado; trigger fija
//    parroquia_id; UNIQUE nombre por parroquia). El vínculo con requisitos va
//    aparte, celda por celda, vía fn_sacramento_requisito_set.
const soloSacramento = ({ nombre, clave } = {}) => ({
  ...(nombre !== undefined ? { nombre } : {}),
  ...(clave !== undefined ? { clave } : {}),
})

export async function createSacramento(sacramento) {
  const { data, error } = await supabase
    .from('sacramentos').insert(soloSacramento(sacramento)).select('id, nombre, clave').single()
  if (error) throw errorLegible(error)
  return { sacramento: { ...data, requisitos: [] } }
}

export async function updateSacramento(id, sacramento) {
  const { data, error } = await supabase
    .from('sacramentos').update(soloSacramento(sacramento)).eq('id', Number(id)).select('id, nombre, clave').single()
  if (error) throw errorLegible(error)
  return { sacramento: data }
}

export async function deleteSacramentoById(id) {
  const { error } = await supabase.from('sacramentos').delete().eq('id', Number(id))
  if (error) throw errorLegible(error)
  return { message: 'Sacramento eliminado' }
}

// Vincula (o desvincula) un requisito con un sacramento — una celda de la matriz.
export async function setSacramentoRequisito(sacramentoId, requisitoId, activo) {
  const { error } = await supabase.rpc('fn_sacramento_requisito_set', {
    p_sacramento_id: Number(sacramentoId),
    p_requisito_id: Number(requisitoId),
    p_activo: !!activo,
  })
  if (error) throw errorLegible(error)
}
