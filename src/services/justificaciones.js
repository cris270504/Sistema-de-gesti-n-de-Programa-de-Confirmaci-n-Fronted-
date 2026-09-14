import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase';

// Fase 3.1: el listado usa el RPC fn_justificaciones_pendientes (ventana de N
// días + faltas con trámite ya resueltas en SQL). Antes se leía directo la
// vista v_justificaciones_pendientes con `.order()`, pero PostgREST no puede
// empujar ese ORDER BY a través del security barrier que impone RLS sobre las
// 8 tablas que arma la vista -> timeout 57014. El RPC calcula el scope del
// usuario una sola vez (SECURITY DEFINER) y ordena/limita adentro de la
// función, no desde el cliente. La vista se mantiene por compatibilidad pero
// este listado ya no la usa. Las 3 acciones de escritura son RPCs
// transaccionales (asistencia + justificación).

export async function getJustificacionesPendientes() {
    const { data, error } = await supabase.rpc('fn_justificaciones_pendientes');
    if (error) throw errorLegible(error);
    return data;
}

// ── Fase 4: las 3 acciones son RPCs transaccionales (tocan justificaciones +
//    asistencia). La RLS de esas tablas hace de `autorizarAsistencia`. ─────────
async function rpc(fn, args) {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw errorLegible(error);
    return { status: true, ...(data ?? {}) };
}

export function saveJustificacionAcuerdo(payload) {
    return rpc('fn_justificacion_acuerdo', {
        p_asistencia_id: Number(payload.asistencia_id),
        p_motivo: payload.motivo,
        p_descripcion: payload.descripcion,
        p_fecha_acuerdo: payload.fecha_acuerdo,
        p_tipo_accion: payload.tipo_accion,
    });
}

export function completeJustificacion(asistenciaId) {
    return rpc('fn_justificacion_completar', { p_asistencia_id: Number(asistenciaId) });
}

export function rejectJustificacion(asistenciaId) {
    return rpc('fn_justificacion_rechazar', { p_asistencia_id: Number(asistenciaId) });
}