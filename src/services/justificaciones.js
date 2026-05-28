import api from '@/lib/api'; // <--- ¡Usa obligatoriamente tu instancia personalizada de la parroquia!

export function getJustificacionesPendientes() {
    // Esto asegura que viaje el Header Authorization Bearer Token y el Accept: application/json
    return api.get('/justificaciones').then(res => res.data);
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