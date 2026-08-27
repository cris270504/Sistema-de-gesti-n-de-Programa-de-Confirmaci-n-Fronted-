import api from '@/lib/api'

export function getRolesList(params = {}) {
  return api.get('/roles', { params }).then(res => res.data)
}

export function getRoles(id, params = {}) {
  return api.get(`/roles/${id}`, { params }).then(res => res.data)
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
