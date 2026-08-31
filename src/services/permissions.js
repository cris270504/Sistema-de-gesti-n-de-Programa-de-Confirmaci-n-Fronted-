import { supabase } from '@/lib/supabase'

// Catálogo de permisos: solo lectura (para los checkboxes del editor de roles).
// La tabla `permissions` está REVOCADA de PostgREST → RPC SECURITY DEFINER
// gateada por el permiso `ver roles` del claim.
// El CRUD del catálogo (crear/editar/borrar permisos) no existe en el frontend.

export async function getPermissionsList() {
  const { data, error } = await supabase.rpc('fn_permisos_lista')
  if (error) throw new Error(error.message)
  return data
}
