import { supabase } from '@/lib/supabase'

// Fase 3/4: lecturas y escrituras → PostgREST (RLS + CHECK de tipo + trigger
// de parroquia).

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

const COLS = 'id, nombre_tema, fecha, descripcion, tipo, created_at, updated_at'

// Columnas que el cliente puede escribir. Filtra `id` y cualquier campo suelto del
// draft (mandar `id: null` en el insert rompía el NOT NULL de la PK).
const WRITE_COLS = ['nombre_tema', 'fecha', 'descripcion', 'tipo']
const soloEscribibles = (obj) =>
  Object.fromEntries(WRITE_COLS.filter(k => obj?.[k] !== undefined).map(k => [k, obj[k]]))

export function getReunionsList() {
  return unwrap(supabase.from('reunions').select(COLS).order('fecha', { ascending: true }))
}

export function getReunionById(id) {
  return unwrap(supabase.from('reunions').select(COLS).eq('id', Number(id)).single())
}

export function getUpcomingReuniones() {
  // `reunions.fecha` es timestamp sin zona → comparamos con una marca local sin `Z`.
  const ahora = new Date().toISOString().slice(0, 19)
  return unwrap(
    supabase.from('reunions')
      .select(COLS)
      .gte('fecha', ahora)
      .order('fecha', { ascending: true })
      .limit(5),
  )
}

// ── Escrituras: Fase 4, PostgREST directo (RLS: solo privilegiado; trigger fija
//    parroquia_id; CHECK de tipo). ────────────────────────────────────────────
export async function createReunion(reunion) {
  const { data, error } = await supabase
    .from('reunions').insert(soloEscribibles(reunion)).select(COLS).single()
  if (error) throw new Error(error.message)
  return { reunion: data }
}

export async function updateReunion(id, reunion) {
  const { data, error } = await supabase
    .from('reunions').update(soloEscribibles(reunion)).eq('id', Number(id)).select(COLS).single()
  if (error) throw new Error(error.message)
  return { reunion: data }
}

export async function deleteReunionById(id) {
  const { error } = await supabase.from('reunions').delete().eq('id', Number(id))
  if (error) throw new Error(error.message)
  return { message: 'Reunión eliminada' }
}
