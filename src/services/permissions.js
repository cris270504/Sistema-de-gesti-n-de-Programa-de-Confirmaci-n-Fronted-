import api from '@/lib/api'

export function getPermissionsList() {
  return api.get('/permissions').then(res => res.data)
}

export function createPermissions(permissions) {
  return api.post('/permissions', permissions).then(res => res.data)
}

export function updatePermissions(id, permissions) {
  return api.put(`/permissions/${id}`, permissions).then(res => res.data)
}

export function deletePermissions(id) {
  return api.delete(`/permissions/${id}`).then(res => res.data)
}