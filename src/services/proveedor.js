import api from '@/lib/api'

export const listParroquias = () => api.get('/proveedor/parroquias').then(r => r.data)
export const crearParroquia = (payload) => api.post('/proveedor/parroquias', payload).then(r => r.data)
export const actualizarParroquia = (id, payload) => api.patch(`/proveedor/parroquias/${id}`, payload).then(r => r.data)
