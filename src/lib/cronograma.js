// Cálculo del cronograma por momentos (portado de C:\dev\CRONOGRAMAS\public\js\schedule.js).
//
// La hora de inicio del programa ES la hora de reunions.fecha (la base de
// datos la mantiene sincronizada con el momento clave). Aquí solo se encadenan
// las horas para mostrarlas: cada momento empieza donde termina el anterior.

export const DURACIONES_RAPIDAS = [10, 15, 20, 30, 45, 60]

export function toMin(hhmm) {
  if (!hhmm) return null
  const [h, m] = String(hhmm).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

const norm = (min) => ((min % 1440) + 1440) % 1440

export function toHHMM(min) {
  const n = norm(min)
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
}

export function fmt12(min) {
  const n = norm(min)
  const h = Math.floor(n / 60)
  const m = String(n % 60).padStart(2, '0')
  return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`
}

export const rango = (ini, fin) => `${fmt12(ini)} – ${fmt12(fin)}`

export function duracionTexto(min) {
  if (min == null) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

// 'YYYY-MM-DD HH:MM[:SS]' o 'YYYY-MM-DDTHH:MM[:SS]' (timestamp sin zona) → partes.
// Se lee el texto tal cual: convertirlo con new Date() lo desfasaría por zona.
export function partesFecha(fecha) {
  const m = String(fecha ?? '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/)
  return m ? { fecha: m[1], hora: m[2] } : { fecha: String(fecha ?? '').slice(0, 10), hora: '08:00' }
}

/**
 * Encadena las horas sin huecos.
 * @param {string} fechaReunion  reunions.fecha (su hora = inicio del programa)
 * @param {Array}  momentos      filas de reunion_momentos
 */
export function calcular(fechaReunion, momentos = []) {
  const porOrden = (a, b) => a.orden - b.orden || a.id - b.id
  const prog = momentos.filter((m) => m.en_cronograma).sort(porOrden)
  const sinHora = momentos.filter((m) => !m.en_cronograma).sort(porOrden)

  let inicio = toMin(partesFecha(fechaReunion).hora) ?? 8 * 60
  const idxClave = prog.findIndex((m) => m.es_clave && m.clave_hora)
  const claveActiva = idxClave >= 0
  if (claveActiva) {
    // Misma regla que la base de datos: inicio = clave − duraciones previas.
    const antes = prog.slice(0, idxClave).reduce((s, m) => s + (m.duracion_min || 0), 0)
    inicio = toMin(prog[idxClave].clave_hora) - antes
  }

  let t = inicio
  const filas = prog.map((m, i) => {
    const f = { ...m, inicio: t, fin: t + (m.duracion_min || 0), esClave: claveActiva && i === idxClave }
    t = f.fin
    return f
  })

  return { inicio, fin: t, total: t - inicio, filas, sinHora, claveActiva }
}

// Fecha larga en español a partir de 'YYYY-MM-DD' (mediodía: evita saltos de día por zona).
export function fechaLarga(iso, opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!iso) return ''
  const t = new Intl.DateTimeFormat('es-PE', opciones).format(new Date(`${iso}T12:00:00`))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Nombre de archivo seguro para Windows/macOS.
export const nombreArchivo = (base) => String(base).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'cronograma'
