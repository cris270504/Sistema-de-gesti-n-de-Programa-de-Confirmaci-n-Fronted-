import api from '@/lib/api'

export function getConfiguracion() {
  return api.get('/parroquia/configuracion').then(res => res.data)
}

export function updateConfiguracion(payload) {
  return api.put('/parroquia/configuracion', payload).then(res => res.data)
}
