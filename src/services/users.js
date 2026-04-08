import api from '@/lib/api'

export function getUsersList() { 
  return api.get('/users').then(res => res.data)
}

export function getUserById(id) {
  return api.get(`/users/${id}`).then(res => res.data)
}

export function createUser(user) {
  return api.post('/users', user).then(res => res.data)
}

export function updateUser(id, user) {
  return api.put(`/users/${id}`, user).then(res => res.data)
}

export function deleteUserById(id) {
  return api.delete(`/users/${id}`).then(res => res.data)
}
