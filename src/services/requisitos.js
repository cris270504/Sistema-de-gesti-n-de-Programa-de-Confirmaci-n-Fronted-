import api from '@/lib/api'

export function getRequisitoList() {
  return api.get('/requisitos').then(res => res.data)
}

export function getRequisitoById(id) {
  return api.get(`/requisitos/${id}`).then(res => res.data)
}

export function createRequisito(requisito) {
  return api.post('/requisitos', requisito).then(res => res.data)
}

export function updateRequisito(id, requisito) {
  return api.put(`/requisitos/${id}`, requisito).then(res => res.data)
}

export function deleteRequisitoById(id) { 
  return api.delete(`/requisitos/${id}`).then(res => res.data)
}