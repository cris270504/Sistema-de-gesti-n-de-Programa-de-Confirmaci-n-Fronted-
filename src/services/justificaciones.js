import api from '@/lib/api';
import { supabase } from '@/lib/supabase';

// Fase 3: el listado lee la vista v_justificaciones_pendientes (ventana de N días
// + faltas con trámite ya resueltas en SQL; RLS acota por parroquia y grupo).
// Las 3 acciones de escritura siguen en Laravel (transacciones asistencia +
// justificación → Fase 4).

export async function getJustificacionesPendientes() {
    const { data, error } = await supabase
        .from('v_justificaciones_pendientes')
        .select('*')
        .order('fecha_falta', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
}

export function saveJustificacionAcuerdo(payload) {
    return api.post('/justificaciones/acuerdo', payload).then(res => res.data);
}

export function completeJustificacion(asistenciaId) {
    return api.post('/justificaciones/completar', { asistencia_id: asistenciaId }).then(res => res.data);
}

export function rejectJustificacion(asistenciaId) {
    // Hace la petición PUT al endpoint que creamos en Laravel
    return api.put(`/justificaciones/${asistenciaId}/rechazar`).then(res => res.data);
}