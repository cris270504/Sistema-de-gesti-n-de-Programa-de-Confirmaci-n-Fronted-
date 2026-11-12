import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

// Configuración de la parroquia. Lectura → PostgREST sobre
// parroquia_configuraciones (RLS select + restrictive de parroquia acotan a la
// fila propia). Escritura → RPC fn_guardar_configuracion, que valida todo en la
// base (programa, umbrales 1..99, dominio de tipos_reunion, hex del color)
// y devuelve { message, configuracion }.

const CONFIG_COLS =
  'programa_inicio, programa_fin, programa_tipo, programa_nombre_otro,' +
  ' persona_nombre_singular, persona_nombre_plural,' +
  ' dias_ventana_justificacion, tipos_reunion,' +
  ' umbrales_alerta, procedencias, branding, roles_labels, ui,' +
  ' grupos_edad_min, grupos_edad_max, contacto, justificacion_motivos, updated_at'

export async function getConfiguracion() {
  const { data, error } = await supabase
    .from('parroquia_configuraciones')
    .select(CONFIG_COLS)
    .maybeSingle()
  if (error) throw errorLegible(error)
  return data ?? {} // sin fila → el store aplica sus defaults
}

// Solo el timestamp: para detectar si la config cambió sin traerla entera.
export async function getConfiguracionUpdatedAt() {
  const { data, error } = await supabase
    .from('parroquia_configuraciones')
    .select('updated_at')
    .maybeSingle()
  if (error) throw errorLegible(error)
  return data?.updated_at ?? null
}

export async function updateConfiguracion(payload) {
  const { data, error } = await supabase.rpc('fn_guardar_configuracion', { p_config: payload })
  if (error) throw errorLegible(error)
  return data // { message, configuracion }
}

// Datos de la propia parroquia que define el proveedor (redes, prefijo de
// WhatsApp, zona horaria). RLS: cada usuario solo ve la fila de su parroquia.
export async function getDatosParroquia() {
  const { data, error } = await supabase
    .from('parroquias')
    .select('id, nombre, slug, zona_horaria, instagram_url, facebook_url, whatsapp_prefijo')
    .maybeSingle()
  if (error) throw errorLegible(error)
  return data
}

// Acciones reparadoras de justificación (todas: activas e inactivas, para que
// el historial siga mostrando el nombre de las que se dejaron de usar).
export async function getJustificacionAcciones() {
  const { data, error } = await supabase
    .from('justificacion_acciones')
    .select('id, clave, nombre, cupo_por_fecha, pide_detalle, activo, orden')
    .order('activo', { ascending: false })
    .order('orden', { ascending: true })
  if (error) throw errorLegible(error)
  return data ?? []
}

export async function saveJustificacionAcciones(acciones) {
  const { data, error } = await supabase.rpc('fn_guardar_justificacion_acciones', { p_acciones: acciones })
  if (error) throw errorLegible(error)
  return data ?? []
}

// Historial de cambios de la parroquia (solo administradores, por RLS).
export async function getHistorialParroquia({ limite = 100 } = {}) {
  const { data, error } = await supabase
    .from('parroquia_auditoria')
    .select('id, created_at, actor_nombre, accion, detalle')
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) throw errorLegible(error)
  return data ?? []
}

export async function registrarExportacion() {
  const { error } = await supabase.rpc('fn_auditoria_exportacion')
  if (error) throw errorLegible(error)
}
