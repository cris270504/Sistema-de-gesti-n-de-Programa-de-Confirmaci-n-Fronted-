import { supabase } from '@/lib/supabase'

// Fase 3 migración Supabase: las LECTURAS del catálogo van directo a PostgREST
// (la RLS por parroquia las acota). Las escrituras siguen en Laravel hasta la
// Fase 4 (validación `unique` por parroquia + invalidación de caché).

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
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
//    parroquia_id; UNIQUE nombre por parroquia). Devuelven la misma forma
//    `{ sacramento }` / `{ message }` que esperaban los stores.
export async function createSacramento(sacramento) {
  const { data, error } = await supabase
    .from('sacramentos').insert(sacramento).select('id, nombre, clave').single()
  if (error) throw new Error(error.message)
  return { sacramento: { ...data, requisitos: [] } }
}

export async function updateSacramento(id, sacramento) {
  const { data, error } = await supabase
    .from('sacramentos').update(sacramento).eq('id', Number(id)).select('id, nombre, clave').single()
  if (error) throw new Error(error.message)
  return { sacramento: data }
}

export async function deleteSacramentoById(id) {
  const { error } = await supabase.from('sacramentos').delete().eq('id', Number(id))
  if (error) throw new Error(error.message)
  return { message: 'Sacramento eliminado' }
}
