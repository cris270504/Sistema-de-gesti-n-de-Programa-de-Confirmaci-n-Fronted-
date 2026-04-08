import api from '@/lib/api';

export function getAsistenciasList(reunionId) {
    return api.get(`/reuniones/${reunionId}/asistencias`).then(res => res.data);
}

export function saveAsistenciasBulk(reunionId, asistenciasData) {
    return api.post(`/reuniones/${reunionId}/asistencias`, { asistencias: asistenciasData }).then(res => res.data);
}

export function getAsistenciaMatrix(tipo, fecha) {
    return api.get('/asistencias/matriz', { params: { tipo, fecha } }).then(res => res.data);
}