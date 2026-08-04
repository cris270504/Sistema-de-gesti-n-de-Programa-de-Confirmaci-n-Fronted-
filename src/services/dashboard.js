import api from '@/lib/api'

export function getDashboardMetricas() {
  return api.get('/dashboard/metricas').then(res => res.data)
}