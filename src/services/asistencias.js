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

export function saveAsistenciasBulk(reunionId, asistenciasData) {
    return api.post(`/reuniones/${reunionId}/asistencias`, { asistencias: asistenciasData }).then(res => res.data);
}

// Se queda en Laravel: es dinámica (tipo = Confirmandos | Catequistas | Apoderados),
// cruza personas × reuniones, y la variante Catequistas necesita los roles de
// Spatie (bloqueados de PostgREST). Vista de administración, poco tráfico.
export function getAsistenciaMatrix(tipo, fecha) {
    return api.get('/asistencias/matriz', { params: { tipo, fecha } }).then(res => res.data);
}