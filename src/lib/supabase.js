import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase (Fase 1 de la migración: Supabase es el proveedor de
// identidad; Laravel sigue sirviendo los datos validando el token de Supabase).
//
// En local: VITE_SUPABASE_URL=http://127.0.0.1:54321 y la anon key del stack.
// En producción: la URL y la anon key del proyecto Supabase.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // No reventamos la app, pero dejamos rastro claro: sin esto el login falla.
  console.error('[supabase] Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno.')
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

/** Access token vigente (o null). supabase-js lo refresca solo en segundo plano. */
export async function currentAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
