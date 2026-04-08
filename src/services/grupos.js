import api from '@/lib/api'

export function getGruposList() {
  return api.get('/grupos').then(res => res.data)
}

export function getGrupoById(id) {
  return api.get(`/grupos/${id}`).then(res => res.data)
}

export function createGrupo(grupo) {
  return api.post('/grupos', grupo).then(res => res.data)
}

export function updateGrupo(id, grupo) {
  return api.put(`/grupos/${id}`, grupo).then(res => res.data)
}

export function deleteGrupoById(id) {
  return api.delete(`/grupos/${id}`).then(res => res.data)
}
export function syncCatequists(grupoId, userIds) {
  const payload = {
    users: userIds,
  };
  return api.post(`/grupos/${grupoId}/sync-catequists`, payload).then(res => res.data);
}

export function syncConfirmandos(grupoId, confirmandoIds) {
  const payload = {
    confirmandos: confirmandoIds,
  };
  return api.post(`/grupos/${grupoId}/sync-confirmandos`, payload).then(res => res.data);
}

export function getApoderadosByGrupo(grupoId) {
    return api.get(`/grupos/${grupoId}/apoderados`).then(res => res.data);
}

export function generarGruposEquitativos(payload) {
  return api.post('/grupos/generar-equitativo', payload).then(res => res.data);
}