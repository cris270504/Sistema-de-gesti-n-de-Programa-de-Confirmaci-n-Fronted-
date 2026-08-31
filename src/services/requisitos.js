import api from '@/lib/api'
import { supabase } from '@/lib/supabase'

// Fase 3: lecturas del catálogo → PostgREST (RLS por parroquia). Escrituras en
// Laravel hasta la Fase 4.

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
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

export function createRequisito(requisito) {
  return api.post('/requisitos', requisito).then(res => res.data)
}

export function updateRequisito(id, requisito) {
  return api.put(`/requisitos/${id}`, requisito).then(res => res.data)
}

export function deleteRequisitoById(id) {
  return api.delete(`/requisitos/${id}`).then(res => res.data)
}
