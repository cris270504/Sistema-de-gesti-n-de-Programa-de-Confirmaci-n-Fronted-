import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

// Fase 3/4: lecturas y escrituras del catálogo → PostgREST (RLS por parroquia).
// PostgREST directo (Fase 4).

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw errorLegible(error)
  return data
}

export function getRequisitoList() {
  return unwrap(
    supabase.from('requisitos').select('id, nombre').order('nombre', { ascending: true }),
  )
}

export function getRequisitoById(id) {
  return unwrap(
    supabase.from('requisitos').select('id, nombre').eq('id', Number(id)).single(),
  )
}

// ── Escrituras: Fase 4, PostgREST directo. ──────────────────────────────────
export async function createRequisito(requisito) {
  const { data, error } = await supabase
    .from('requisitos').insert(requisito).select('id, nombre').single()
  if (error) throw errorLegible(error)
  return { requisito: data }
}

export async function updateRequisito(id, requisito) {
  const { data, error } = await supabase
    .from('requisitos').update(requisito).eq('id', Number(id)).select('id, nombre').single()
  if (error) throw errorLegible(error)
  return { requisito: data }
}

export async function deleteRequisitoById(id) {
  const { error } = await supabase.from('requisitos').delete().eq('id', Number(id))
  if (error) throw errorLegible(error)
  return { message: 'Requisito eliminado' }
}
