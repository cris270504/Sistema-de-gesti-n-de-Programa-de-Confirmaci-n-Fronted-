import api from '@/lib/api';
import { supabase } from '@/lib/supabase';

// Fase 3: la lista de asistencias de una reunión → PostgREST (RLS por parroquia
// + grupo). El guardado masivo y la matriz siguen en Laravel (la matriz cruza
// personas × reuniones y necesita su propia vista/orquestación).

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

// Se queda en Laravel: es dinámica (tipo = Confirmandos | Catequistas | Apoderados),
// cruza personas × reuniones, y la variante Catequistas necesita los roles de
// Spatie (bloqueados de PostgREST). Vista de administración, poco tráfico.
export function getAsistenciaMatrix(tipo, fecha) {
    return api.get('/asistencias/matriz', { params: { tipo, fecha } }).then(res => res.data);
}