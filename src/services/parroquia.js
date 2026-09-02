import { supabase } from '@/lib/supabase'

// Configuración de la parroquia. Lectura → PostgREST sobre
// parroquia_configuraciones (RLS select + restrictive de parroquia acotan a la
// fila propia). Escritura → RPC fn_guardar_configuracion, que valida igual que el
// controller (programa, umbrales 1..99, dominio de tipos_reunion, hex del color)
// y devuelve { message, configuracion }.

const CONFIG_COLS =
  'programa_inicio, programa_fin, dias_ventana_justificacion, tipos_reunion,' +
  ' umbrales_alerta, procedencias, branding, roles_labels, ui,' +
  ' grupos_edad_min, grupos_edad_max, updated_at'

export async function getConfiguracion() {
  const { data, error } = await supabase
    .from('parroquia_configuraciones')
    .select(CONFIG_COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ?? {} // sin fila → el store aplica sus defaults
}

// Solo el timestamp: para detectar si la config cambió sin traerla entera.
export async function getConfiguracionUpdatedAt() {
  const { data, error } = await supabase
    .from('parroquia_configuraciones')
    .select('updated_at')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.updated_at ?? null
}

export async function updateConfiguracion(payload) {
  const { data, error } = await supabase.rpc('fn_guardar_configuracion', { p_config: payload })
  if (error) throw new Error(error.message)
  return data // { message, configuracion }
}
