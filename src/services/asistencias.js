import { supabase } from '@/lib/supabase';

// Asistencias: todo vía Supabase. Lista de una reunión → PostgREST; guardado
// masivo → RPC fn_guardar_asistencias; matriz persona × reunión → RPC
// fn_asistencia_matriz.

export async function getAsistenciasList(reunionId) {
    const { data, error } = await supabase
        .from('asistencia')
        .select('id, reunion_id, estado, asistente_type, asistente_id, nota')
        .eq('reunion_id', Number(reunionId));
    if (error) throw new Error(error.message);
    return data;
}

export async function saveAsistenciasBulk(reunionId, asistenciasData) {
    // Fase 4: upsert masivo vía RPC (transacción en Postgres). El array llega con
    // { asistente_id, asistente_type, estado, nota } — misma forma que espera la fn.
    const { data, error } = await supabase.rpc('fn_guardar_asistencias', {
        p_reunion_id: Number(reunionId),
        p_filas: asistenciasData,
    });
    if (error) throw new Error(error.message);
    return { message: 'Asistencia guardada correctamente', ...data };
}

// Matriz persona × reunión: RPC. Es dinámica (tipo = Confirmandos | Catequistas |
// Apoderados) y la variante Catequistas necesita roles de Spatie (REVOCADOS de
// PostgREST) → la función usa un helper SECURITY DEFINER acotado por parroquia.
// `fecha` es 'YYYY-MM' o null (mismo contrato que el endpoint viejo).
export function getAsistenciaMatrix(tipo, fecha) {
    return supabase
        .rpc('fn_asistencia_matriz', { p_tipo: tipo, p_fecha: fecha || null })
        .then(({ data, error }) => {
            if (error) throw new Error(error.message);
            return data;
        });
}