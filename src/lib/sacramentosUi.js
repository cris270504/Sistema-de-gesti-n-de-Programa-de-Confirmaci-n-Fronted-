import { Droplets, Flame, Wheat } from 'lucide-vue-next'

// Presentación de los tres sacramentos programables: ícono y color litúrgico
// (tokens --sac-* de main.css). Fuente única para el modal, el módulo y el
// calendario.
export const SACRAMENTO_UI = {
  bautismo: { icon: Droplets, color: 'var(--sac-bautismo)', solid: 'var(--sac-bautismo-solid)', hex: '#0e7490' },
  comunion: { icon: Wheat, color: 'var(--sac-comunion)', solid: 'var(--sac-comunion-solid)', hex: '#a16207' },
  confirmacion: { icon: Flame, color: 'var(--sac-confirmacion)', solid: 'var(--sac-confirmacion-solid)', hex: '#b91c1c' },
}

export const sacramentoUi = (clave) => SACRAMENTO_UI[clave] ?? { icon: Flame, color: 'var(--accent)', solid: 'var(--accent)', hex: '#2563eb' }

// Minúsculas + sin tildes: misma regla que confirmandos.nombre_busqueda.
export function normalizarBusqueda(str) {
  return (str ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// 'YYYY-MM-DD HH:mm[:ss]' (hora local de la parroquia) → texto largo legible.
export function formatearFechaCelebracion(fecha, { conHora = true } = {}) {
  if (!fecha) return ''
  const [d, t = '00:00'] = fecha.toString().replace('T', ' ').split(' ')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = t.split(':').map(Number)
  const fechaLocal = new Date(y, m - 1, day, hh, mm)
  return fechaLocal.toLocaleString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}
