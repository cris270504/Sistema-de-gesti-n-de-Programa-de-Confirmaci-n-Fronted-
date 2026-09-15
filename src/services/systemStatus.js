import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

// Modo mantenimiento: fila única (id=true) en system_status. Lectura para
// cualquier logueado (RLS), escritura solo para el proveedor. `alcance`
// decide a quién bloquea: 'todas' las parroquias, o solo las listadas en
// `parroquia_ids`.

const COLS = 'mantenimiento, mensaje, alcance, parroquia_ids, updated_at'

export async function getSystemStatus() {
    const { data, error } = await supabase
        .from('system_status')
        .select(COLS)
        .eq('id', true)
        .maybeSingle()
    if (error) throw errorLegible(error)
    return data ?? { mantenimiento: false, mensaje: null, alcance: 'todas', parroquia_ids: [] }
}

// scope: { alcance: 'todas' | 'parroquias', parroquia_ids?: number[] }
export async function setMantenimiento(activo, mensaje, scope = { alcance: 'todas', parroquia_ids: [] }) {
    const { data: userData } = await supabase.auth.getUser()
    const { data, error } = await supabase
        .from('system_status')
        .update({
            mantenimiento: activo,
            mensaje: mensaje ?? null,
            alcance: scope.alcance,
            parroquia_ids: scope.alcance === 'parroquias' ? (scope.parroquia_ids ?? []) : [],
            updated_by: userData?.user?.id ?? null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', true)
        .select(COLS)
        .single()
    if (error) throw errorLegible(error)
    return data
}

// Suscripción en vivo: dispara `callback(row)` cada vez que cambia la fila,
// para que un cambio del proveedor bloquee/libere a los demás sin esperar a
// que naveguen o recarguen. Devuelve una función para des-suscribirse.
export function subscribeSystemStatus(callback) {
    const channel = supabase
        .channel('system_status_changes')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'system_status' },
            (payload) => callback(payload.new),
        )
        .subscribe()

    return () => supabase.removeChannel(channel)
}
