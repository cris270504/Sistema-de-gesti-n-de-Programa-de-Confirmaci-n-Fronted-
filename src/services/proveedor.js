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

// Columnas que el proveedor puede escribir sobre `parroquias`. Filtra `id` y
// `created_at` para evitar que un payload armado por spread de un objeto más
// grande pise columnas que no debería (mismo patrón que soloEscribibles en
// services/reunions.js).
const PARROQUIA_WRITE_COLS = ['nombre', 'slug', 'activa', 'zona_horaria', 'instagram_url', 'facebook_url', 'whatsapp_prefijo']
const soloEscribiblesParroquia = (obj) =>
  Object.fromEntries(PARROQUIA_WRITE_COLS.filter(k => obj?.[k] !== undefined).map(k => [k, obj[k]]))

export const actualizarParroquia = async (id, payload) => {
  const { data, error } = await supabase
    .from('parroquias')
    .update(soloEscribiblesParroquia(payload))
    .eq('id', Number(id))
    .select('id, nombre, slug, activa, zona_horaria, instagram_url, facebook_url, whatsapp_prefijo, created_at')
    .single()
  if (error) throw errorLegible(error)
  return { message: 'Parroquia actualizada.', parroquia: data }
}

// Redes y prefijo de WhatsApp de una parroquia (solo el proveedor los edita).
export const getContactoParroquia = async (id) => {
  const { data, error } = await supabase
    .from('parroquias')
    .select('instagram_url, facebook_url, whatsapp_prefijo')
    .eq('id', Number(id))
    .maybeSingle()
  if (error) throw errorLegible(error)
  return {
    instagram_url: data?.instagram_url ?? '',
    facebook_url: data?.facebook_url ?? '',
    whatsapp_prefijo: data?.whatsapp_prefijo ?? '+51',
  }
}

// Elimina una parroquia DESACTIVADA con todo su contenido (irreversible).
// Edge Function `eliminar-parroquia`: la BD revalida proveedor, estado,
// plantilla y que `confirmacion` sea el nombre exacto de la parroquia.
export const eliminarParroquia = async (id, confirmacion) => {
  const { data, error } = await supabase.functions.invoke('eliminar-parroquia', {
    body: { id: Number(id), confirmacion },
  })
  if (error) {
    let message = error.message
    try {
      const body = await error.context?.json?.()
      if (body?.message) message = body.message
    } catch { /* sin cuerpo JSON */ }
    throw new Error(message)
  }
  return data // { message, resumen, avisos }
}

// Mismo criterio que la BD: sin espacios a los lados y sin distinguir mayúsculas.
export const coincideNombreParroquia = (escrito, nombre) =>
  (escrito ?? '').trim().toLowerCase() === (nombre ?? '').trim().toLowerCase()

// Administradores y coordinadores de una parroquia (para restablecerles la
// contraseña desde la consola). v_usuarios: el proveedor ve todas las parroquias.
const ROLES_GESTION = ['super-admin', 'coordinador']
export const listGestoresParroquia = async (parroquiaId) => {
  const { data, error } = await supabase
    .from('v_usuarios')
    .select('id, name, email, dni, activo, roles')
    .eq('parroquia_id', Number(parroquiaId))
    .order('name')
  if (error) throw errorLegible(error)
  return filtrarGestores(data ?? [])
}

// Super-admin primero; luego coordinadores. Cada uno con su rol principal.
export const filtrarGestores = (usuarios) => usuarios
  .map((u) => {
    const nombres = (u.roles ?? []).map((r) => r?.name)
    const rol = ROLES_GESTION.find((r) => nombres.includes(r))
    return rol ? { ...u, rol } : null
  })
  .filter(Boolean)
  .sort((a, b) => ROLES_GESTION.indexOf(a.rol) - ROLES_GESTION.indexOf(b.rol)
    || (a.name ?? '').localeCompare(b.name ?? '', 'es'))

// Historial de acciones del proveedor (solo él lo lee, por RLS).
export const listAuditoria = async ({ limite = 30 } = {}) => {
  const { data, error } = await supabase
    .from('proveedor_auditoria')
    .select('id, created_at, actor_nombre, accion, parroquia_id, parroquia_nombre, detalle')
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) throw errorLegible(error)
  return data ?? []
}

const ACCIONES = {
  crear: 'Creó la parroquia',
  editar: 'Editó los datos de',
  renombrar: 'Renombró',
  activar: 'Activó',
  desactivar: 'Desactivó',
  plantilla: 'Usó como plantilla a',
  eliminar: 'Eliminó la parroquia',
  mantenimiento_on: 'Activó el mantenimiento',
  mantenimiento_off: 'Apagó el mantenimiento',
  restablecer_contrasena: 'Restableció una contraseña en',
}

// Texto corto de una fila del historial: { accion, objetivo, extra }.
export function describirAuditoria(f) {
  const d = f?.detalle ?? {}
  const accion = ACCIONES[f?.accion] ?? f?.accion ?? ''
  let objetivo = f?.parroquia_nombre ?? ''
  let extra = ''
  if (f?.accion === 'renombrar') { objetivo = d.antes ?? objetivo; extra = `ahora «${d.despues ?? ''}»` }
  if (f?.accion === 'restablecer_contrasena' && d.usuario) extra = `de ${d.usuario}`
  if (f?.accion === 'eliminar' && d.confirmandos != null) extra = `${d.usuarios ?? 0} usuarios, ${d.confirmandos} jóvenes`
  if (f?.accion === 'mantenimiento_on') {
    objetivo = ''
    extra = d.alcance === 'parroquias' ? 'en parroquias elegidas' : 'en todas las parroquias'
  }
  if (f?.accion === 'mantenimiento_off') objetivo = ''
  return { accion, objetivo, extra }
}

// Errores de las últimas 24 h agrupados por parroquia (para el aviso del panel).
export function resumirErroresRecientes(filas, parroquias = []) {
  const porParroquia = new Map()
  for (const f of filas ?? []) {
    const k = f.parroquia_id ?? null
    porParroquia.set(k, (porParroquia.get(k) ?? 0) + 1)
  }
  const nombre = (id) => (id == null ? 'Sin parroquia' : parroquias.find((p) => p.id === id)?.nombre ?? `Parroquia ${id}`)
  return {
    total: (filas ?? []).length,
    parroquias: [...porParroquia.entries()]
      .map(([id, n]) => ({ id, nombre: nombre(id), n }))
      .sort((a, b) => b.n - a.n),
  }
}
