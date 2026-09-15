import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

// Modo mantenimiento: fila única (id=true) en system_status. Lectura para
// cualquier logueado (RLS), escritura solo para el proveedor.

export async function getSystemStatus() {
    const { data, error } = await supabase
        .from('system_status')
        .select('mantenimiento, mensaje, updated_at')
        .eq('id', true)
        .maybeSingle()
    if (error) throw errorLegible(error)
    return data ?? { mantenimiento: false, mensaje: null }
}

export async function setMantenimiento(activo, mensaje) {
    const { data: userData } = await supabase.auth.getUser()
    const { data, error } = await supabase
        .from('system_status')
        .update({
            mantenimiento: activo,
            mensaje: mensaje ?? null,
            updated_by: userData?.user?.id ?? null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', true)
        .select('mantenimiento, mensaje, updated_at')
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
