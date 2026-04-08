import api from '@/lib/api'

export function getTiposApoderadoList() {
    return api.get('/tipos-apoderado').then(res => res.data)
}