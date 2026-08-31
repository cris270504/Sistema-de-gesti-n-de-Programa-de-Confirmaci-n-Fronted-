import { supabase } from '@/lib/supabase'

// Roles (Spatie). Las tablas están REVOCADAS de PostgREST → todo por RPCs
// SECURITY DEFINER gateadas por los permisos del claim del JWT (== el
// `permission:` de las rutas de Laravel). Sin Edge Function: no tocan auth.users.

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data
}

export function getRolesList() {
  return rpc('fn_roles_lista')
}

// Solo se usa para refrescar tras guardar: se relee la lista y se filtra.
export async function getRoles(id) {
  const roles = await rpc('fn_roles_lista')
  return roles.find((r) => r.id === Number(id)) ?? null
}

export function createRoles({ name, permissions } = {}) {
  return rpc('fn_guardar_rol', { p_id: null, p_name: name, p_permissions: permissions ?? [] })
}

export function updateRoles(id, { name, permissions } = {}) {
  return rpc('fn_guardar_rol', {
    p_id: Number(id),
    p_name: name ?? null,
    p_permissions: permissions ?? null,
  })
}

export function deleteRoles(id) {
  return rpc('fn_eliminar_rol', { p_id: Number(id) })
}
