import api from '@/lib/api'

export function getRolesList() {
  return api.get('/roles').then(res => res.data)
}

export function getRoles(id) {
  return api.get(`/roles/${id}`).then(res => res.data)
}

export function createRoles(roles) {
  return api.post('/roles', roles).then(res => res.data)
}

export function updateRoles(id, roles) {
  return api.put(`/roles/${id}`, roles).then(res => res.data)
}

export function deleteRoles(id) {
  return api.delete(`/roles/${id}`).then(res => res.data)
}
