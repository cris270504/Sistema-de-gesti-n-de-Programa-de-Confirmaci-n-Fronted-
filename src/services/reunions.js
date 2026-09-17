import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

// Fase 3/4: lecturas y escrituras → PostgREST (RLS + CHECK de tipo + trigger
// de parroquia).

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw errorLegible(error)
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

// `reunions.fecha` es timestamp sin zona (hora local de la parroquia). "Ahora"
// hay que expresarlo en esa misma zona (no en UTC) para que la comparación no
// se desfase según dónde esté la parroquia — ver parroquia.zonaHoraria.
function ahoraEnZona(timeZone) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (tipo) => partes.find((p) => p.type === tipo)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}

export function getUpcomingReuniones(timeZone = 'America/Lima') {
  const ahora = ahoraEnZona(timeZone)
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
  if (error) throw errorLegible(error)
  return { reunion: data }
}

export async function updateReunion(id, reunion) {
  const { data, error } = await supabase
    .from('reunions').update(soloEscribibles(reunion)).eq('id', Number(id)).select(COLS).single()
  if (error) throw errorLegible(error)
  return { reunion: data }
}

export async function deleteReunionById(id) {
  const { error } = await supabase.from('reunions').delete().eq('id', Number(id))
  if (error) throw errorLegible(error)
  return { message: 'Reunión eliminada' }
}

// Nº de asistencias registradas de una reunión (para avisar antes de borrarla).
export async function contarAsistenciasReunion(id) {
  const { count, error } = await supabase
    .from('asistencia')
    .select('id', { count: 'exact', head: true })
    .eq('reunion_id', Number(id))
  if (error) throw errorLegible(error)
  return count ?? 0
}
