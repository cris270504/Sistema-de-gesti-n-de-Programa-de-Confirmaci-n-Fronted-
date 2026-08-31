import { supabase } from '@/lib/supabase'

// Fase 3: solo lectura → PostgREST (RLS por parroquia).

export async function getTiposApoderadoList() {
  const { data, error } = await supabase
    .from('tipo_apoderados')
    .select('id, nombre')
    .order('nombre', { ascending: true })
  if (error) throw new Error(error.message)
  return data
}
