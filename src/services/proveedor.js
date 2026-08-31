import { supabase } from '@/lib/supabase'

// Panel del proveedor (administrar plataforma).
// - listar / actualizar parroquias → PostgREST (RLS parroquias: proveedor ve y
//   escribe todas; vista v_parroquias añade los conteos).
// - crear parroquia → Edge Function `onboarding-parroquia` (crea el auth.users
//   del admin + config + catálogo sacramental en una transacción).

export const listParroquias = async () => {
  const { data, error } = await supabase
    .from('v_parroquias')
    .select('id, nombre, slug, activa, zona_horaria, created_at, users_count, grupos_count, confirmandos_count')
    .order('nombre')
  if (error) throw new Error(error.message)
  return data
}

export const crearParroquia = async (payload) => {
  const { data, error } = await supabase.functions.invoke('onboarding-parroquia', { body: payload })
  if (error) {
    let message = error.message
    try {
      const body = await error.context?.json?.()
      if (body?.message) message = body.message
    } catch { /* sin cuerpo JSON */ }
    throw new Error(message)
  }
  return data // { message, parroquia, admin: { email, temp_password } }
}

export const actualizarParroquia = async (id, payload) => {
  const { data, error } = await supabase
    .from('parroquias')
    .update(payload)
    .eq('id', Number(id))
    .select('id, nombre, slug, activa, zona_horaria, created_at')
    .single()
  if (error) throw new Error(error.message)
  return { message: 'Parroquia actualizada.', parroquia: data }
}
