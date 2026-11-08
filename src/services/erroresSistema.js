import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

// Errores del frontend registrados por fn_log_frontend_error (useErrorLogger).
// La tabla no es legible por la API: se lee con fn_errores_sistema, que solo
// el proveedor puede ejecutar (los admins de parroquia no ven stacks ni URLs).

export const LIMITE_ERRORES = 500

export async function listErroresSistema({ parroquiaId = null, desdeDias = 7 } = {}) {
  const desde = new Date(Date.now() - desdeDias * 86_400_000).toISOString()
  const { data, error } = await supabase.rpc('fn_errores_sistema', {
    p_parroquia_id: parroquiaId ? Number(parroquiaId) : null,
    p_desde: desde,
    p_limite: LIMITE_ERRORES,
  })
  if (error) throw errorLegible(error)
  return data ?? []
}

// Agrupa errores con el mismo mensaje: un error que se repite 200 veces es una
// sola fila con contador, la última vez que pasó y cuántas parroquias/usuarios afecta.
export function agruparErrores(filas) {
  const grupos = new Map()
  for (const f of filas) {
    const clave = String(f.message || '').trim()
    let g = grupos.get(clave)
    if (!g) {
      g = { message: clave, veces: 0, ultimo: f.created_at, primero: f.created_at,
        parroquias: new Set(), usuarios: new Set(), ejemplo: f }
      grupos.set(clave, g)
    }
    g.veces++
    if (f.created_at > g.ultimo) { g.ultimo = f.created_at; g.ejemplo = f }
    if (f.created_at < g.primero) g.primero = f.created_at
    if (f.parroquia_id != null) g.parroquias.add(f.parroquia_id)
    if (f.user_id != null) g.usuarios.add(f.user_id)
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, parroquias: [...g.parroquias], usuarios: g.usuarios.size }))
    .sort((a, b) => (a.ultimo < b.ultimo ? 1 : -1))
}
