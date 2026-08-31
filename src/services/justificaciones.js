import { supabase } from '@/lib/supabase';

// Fase 3: el listado lee la vista v_justificaciones_pendientes (ventana de N días
// + faltas con trámite ya resueltas en SQL; RLS acota por parroquia y grupo).
// Las 3 acciones de escritura son RPCs transaccionales (asistencia +
// justificación).

export async function getJustificacionesPendientes() {
    const { data, error } = await supabase
        .from('v_justificaciones_pendientes')
        .select('*')
        .order('fecha_falta', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
}

// ── Fase 4: las 3 acciones son RPCs transaccionales (tocan justificaciones +
//    asistencia). La RLS de esas tablas hace de `autorizarAsistencia`. ─────────
async function rpc(fn, args) {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new Error(error.message);
    return { status: true, ...(data ?? {}) };
}

export function saveJustificacionAcuerdo(payload) {
    return rpc('fn_justificacion_acuerdo', {
        p_asistencia_id: Number(payload.asistencia_id),
        p_motivo: payload.motivo,
        p_descripcion: payload.descripcion,
        p_fecha_acuerdo: payload.fecha_acuerdo,
    });
}

export function completeJustificacion(asistenciaId) {
    return rpc('fn_justificacion_completar', { p_asistencia_id: Number(asistenciaId) });
}

export function rejectJustificacion(asistenciaId) {
    return rpc('fn_justificacion_rechazar', { p_asistencia_id: Number(asistenciaId) });
}