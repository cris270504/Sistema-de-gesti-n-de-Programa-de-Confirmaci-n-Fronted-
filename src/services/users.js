import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'
import { logFrontendError } from '@/composables/useErrorLogger'

// Usuarios. Lecturas → vista v_usuarios (PostgREST; roles/grupos resueltos con
// helpers SECURITY DEFINER, RLS de users acota por parroquia). Escrituras →
// Edge Function `admin-usuarios`, que crea/edita/borra también en auth.users.

const SELECT = 'id, name, email, dni, celular, fecha_nacimiento, activo, grupo_id, parroquia_id, roles, grupos'

export async function getUsersList() {
  const { data, error } = await supabase
    .from('v_usuarios')
    .select(SELECT)
    .order('id', { ascending: false })
  if (error) throw errorLegible(error)
  return data
}

export async function getUserById(id) {
  const { data, error } = await supabase
    .from('v_usuarios')
    .select(SELECT)
    .eq('id', Number(id))
    .single()
  if (error) throw errorLegible(error)
  return data
}

// La Edge Function devuelve { message, ... } tanto en éxito como en error; en
// error hay que leer el cuerpo de la respuesta (error.context) para el mensaje.
async function invokeAdmin(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', {
    body: { action, ...payload },
  })
  if (error) {
    let message = error.message
    try {
      const body = await error.context?.json?.()
      if (body?.message) message = body.message
    } catch { /* respuesta sin cuerpo JSON */ }
    // 5xx = falla del servidor (no una validación): que el proveedor lo vea.
    if (Number(error.context?.status) >= 500) {
      logFrontendError(`[admin-usuarios ${action} ${error.context.status}] ${message}`, new Error().stack)
    }
    throw new Error(message)
  }
  return data
}

export function createUser(user) {
  return invokeAdmin('create', user)
}

export function updateUser(id, user) {
  return invokeAdmin('update', { id: Number(id), ...user })
}

export function deleteUserById(id) {
  return invokeAdmin('delete', { id: Number(id) })
}

// "Mi perfil": cada usuario edita su propio nombre y correo (cualquier rol).
export function updateMyProfile({ name, email }) {
  return invokeAdmin('update_self', { name, email })
}

// Genera una contraseña temporal (solo super-admin/proveedor; reglas en
// fn_admin_reset_target). El usuario deberá cambiarla al iniciar sesión.
export function resetUserPassword(id) {
  return invokeAdmin('reset_password', { id: Number(id) })
}

export function setUserEstado(id, activo) {
  return invokeAdmin('estado', { id: Number(id), activo })
}
