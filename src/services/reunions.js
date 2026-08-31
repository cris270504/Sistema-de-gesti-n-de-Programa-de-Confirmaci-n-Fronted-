import api from '@/lib/api'
import { supabase } from '@/lib/supabase'

// Fase 3: lecturas → PostgREST (RLS por parroquia). Escrituras en Laravel (Fase 4:
// validación de tipo/fecha por config de parroquia).

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

const COLS = 'id, nombre_tema, fecha, descripcion, tipo, created_at, updated_at'

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

export function createReunion(reunion) {
  return api.post('/reuniones', reunion).then(res => res.data)
}

export function updateReunion(id, reunion) {
  return api.put(`/reuniones/${id}`, reunion).then(res => res.data)
}

export function deleteReunionById(id) {
  return api.delete(`/reuniones/${id}`).then(res => res.data)
}
