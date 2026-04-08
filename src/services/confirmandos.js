import api from '@/lib/api'

export function getConfirmandosList() {
  return api.get('/confirmandos').then(res => res.data)
}

export function getConfirmandoById(id) {
  return api.get(`/confirmandos/${id}`).then(res => res.data)
}

export function createConfirmando(confirmando) {
  return api.post('/confirmandos', confirmando).then(res => res.data)
}

export function updateConfirmando(id, confirmando) {
  return api.put(`/confirmandos/${id}`, confirmando).then(res => res.data)
}

export function deleteConfirmandoById(id) {
  return api.delete(`/confirmandos/${id}`).then(res => res.data)
}

