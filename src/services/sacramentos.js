import api from '@/lib/api'

export function getSacramentosList() {
  return api.get('/sacramentos').then(res => res.data)
}

export function getSacramentoById(id) {
  return api.get(`/sacramentos/${id}`).then(res => res.data)
}

export function createSacramento(sacramento) {
  return api.post('/sacramentos', sacramento).then(res => res.data)
}

export function updateSacramento(id, sacramento) {
  return api.put(`/sacramentos/${id}`, sacramento).then(res => res.data)
}

export function deleteSacramentoById(id) { 
  return api.delete(`/sacramentos/${id}`).then(res => res.data)
}