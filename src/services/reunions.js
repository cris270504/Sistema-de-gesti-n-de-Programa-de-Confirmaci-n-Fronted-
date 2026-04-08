import api from '@/lib/api'

export function getReunionsList() {
  return api.get('/reuniones').then(res => res.data)
}

export function getReunionById(id) { 
  return api.get(`/reuniones/${id}`).then(res => res.data)
}

export function createReunion(reunion) { 
  return api.post('/reuniones', reunion).then(res => res.data)
}

export function updateReunion(id, reunion) { 
  return api.put(`/reuniones/${id}`, reunion).then(res => res.data)
}

export function deleteReunionById(id) { 
  return api.delete(`/reuniones/${id}`).then(res => res.data)
}

export function getUpcomingReuniones() {
    return api.get('/reuniones/upcoming').then(res => res.data)
}