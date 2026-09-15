import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

// Panel del proveedor (administrar plataforma).
// - listar / actualizar parroquias → PostgREST (RLS parroquias: proveedor ve y
//   escribe todas; vista v_parroquias añade los conteos).
// - crear parroquia → Edge Function `onboarding-parroquia` (crea el auth.users
//   del admin + config + catálogo sacramental en una transacción).

export const listParroquias = async () => {
  const { data, error } = await supabase
    .from('v_parroquias')
    .select('id, nombre, slug, activa, zona_horaria, es_plantilla, created_at, users_count, grupos_count, confirmandos_count')
    .order('nombre')
  if (error) throw errorLegible(error)
  return data
}

// Marca qué parroquia se usa como plantilla al crear nuevas (ruta sacramental).
export const setPlantillaParroquia = async (id) => {
  const { error } = await supabase.rpc('fn_set_parroquia_plantilla', { p_id: Number(id) })
  if (error) throw errorLegible(error)
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

// Branding + tipo de programa de una parroquia (el proveedor puede leer
// cualquier fila por RLS).
export const getBrandingParroquia = async (id) => {
  const { data, error } = await supabase
    .from('parroquia_configuraciones')
    .select('branding, programa_tipo, programa_nombre_otro, persona_nombre_singular, persona_nombre_plural')
    .eq('parroquia_id', Number(id))
    .maybeSingle()
  if (error) throw errorLegible(error)
  return {
    branding: data?.branding ?? {},
    programa_tipo: data?.programa_tipo ?? 'confirmacion',
    programa_nombre_otro: data?.programa_nombre_otro ?? '',
    persona_nombre_singular: data?.persona_nombre_singular ?? '',
    persona_nombre_plural: data?.persona_nombre_plural ?? '',
  }
}

// El proveedor escribe directo sobre parroquia_configuraciones de CUALQUIER
// parroquia (RLS: app_parroquia_ok admite cualquier fila cuando es_proveedor).
// A diferencia del admin de la parroquia, el proveedor no pasa por
// fn_guardar_configuracion (esa RPC opera sobre "mi propia" parroquia vía
// app_current_parroquia_id(), que para el proveedor es NULL).
export const actualizarProgramaParroquia = async (
  parroquiaId,
  { programa_tipo, programa_nombre_otro, persona_nombre_singular, persona_nombre_plural },
) => {
  const { data, error } = await supabase
    .from('parroquia_configuraciones')
    .update({
      programa_tipo,
      programa_nombre_otro: programa_tipo === 'otro' ? (programa_nombre_otro || null) : null,
      persona_nombre_singular: persona_nombre_singular || null,
      persona_nombre_plural: persona_nombre_plural || null,
      updated_at: new Date().toISOString(),
    })
    .eq('parroquia_id', Number(parroquiaId))
    .select('programa_tipo, programa_nombre_otro, persona_nombre_singular, persona_nombre_plural')
    .single()
  if (error) throw errorLegible(error)
  return data
}

export const actualizarParroquia = async (id, payload) => {
  const { data, error } = await supabase
    .from('parroquias')
    .update(payload)
    .eq('id', Number(id))
    .select('id, nombre, slug, activa, zona_horaria, created_at')
    .single()
  if (error) throw errorLegible(error)
  return { message: 'Parroquia actualizada.', parroquia: data }
}
