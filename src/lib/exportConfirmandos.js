// Lógica pura del export de confirmandos (sin Vue, sin red, sin librerías de
// archivos): catálogo de columnas, mapeo de filas, orientación del PDF y
// nombres. Los generadores (.xlsx/.pdf) viven en exportConfirmandosArchivos.js.

export const ESTADOS_EXPORT = [
  { value: 'en_preparacion', label: 'En preparación', plural: 'En preparación' },
  { value: 'confirmado', label: 'Confirmados', plural: 'Confirmados' },
  { value: 'retirado', label: 'Retirados', plural: 'Retirados' },
  { value: 'todos', label: 'Todos', plural: 'Todos' },
]

const ETIQUETA_ESTADO = {
  en_preparacion: 'En preparación',
  confirmado: 'Confirmado',
  retirado: 'Retirado',
}

export const GRUPOS_COLUMNAS = [
  { id: 'personales', label: 'Datos personales' },
  { id: 'grupo', label: 'Grupo' },
  { id: 'sacramentos', label: 'Sacramentos' },
  { id: 'apoderados', label: 'Apoderados' },
  { id: 'requisitos', label: 'Requisitos' },
  { id: 'retiro', label: 'Retiro' },
]

// A4 vertical: 210 mm menos márgenes de 10 mm por lado.
export const PDF_MARGEN_MM = 10
export const A4_ANCHO_UTIL_VERTICAL_MM = 210 - 2 * PDF_MARGEN_MM

const capitalizar = (s) => {
  const t = (s ?? '').toString().trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''
}

// Mismo criterio que ListConfirmandos.vue: 'YYYY-MM-DD[THH...]' → 'DD/MM/YYYY'.
function formatearFecha(valor) {
  if (!valor) return ''
  const [year, month, day] = valor.toString().split('T')[0].split('-')
  if (!year || !month || !day) return ''
  return `${day}/${month}/${year}`
}

export function calcularEdad(fechaNacimiento, hoy = new Date()) {
  if (!fechaNacimiento) return null
  const [y, m, d] = fechaNacimiento.toString().split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return null
  let edad = hoy.getFullYear() - y
  const aunNoCumple = hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)
  if (aunNoCumple) edad -= 1
  return edad
}

// Misma convención que el modal de apoderados: 1 = Padre, 2 = Madre, resto Tutor.
const tipoApoderado = (id) => (id === 1 ? 'Padre' : id === 2 ? 'Madre' : 'Tutor')

const textoApoderado = (a) => {
  const nombre = `${a.nombres ?? ''} ${a.apellidos ?? ''}`.trim()
  const base = `${tipoApoderado(a.pivot?.tipo_apoderado_id)}: ${nombre}`
  return a.celular ? `${base} (${a.celular})` : base
}

const unirConEstado = (lista = []) =>
  lista.map((x) => `${x.nombre}: ${capitalizar(x.pivot?.estado)}`).join(', ')

// `width` = ancho estimado en mm (para decidir la orientación del PDF y el
// ancho de columna en Excel). `get(confirmando, { hoy })` → texto de la celda.
export const COLUMNAS = [
  { key: 'apellidos', label: 'Apellidos', group: 'personales', width: 32, get: (c) => c.apellidos ?? '' },
  { key: 'nombres', label: 'Nombres', group: 'personales', width: 32, get: (c) => c.nombres ?? '' },
  { key: 'fecha_nacimiento', label: 'Fecha de nacimiento', group: 'personales', width: 22, get: (c) => formatearFecha(c.fecha_nacimiento) },
  {
    key: 'edad', label: 'Edad', group: 'personales', width: 12,
    get: (c, { hoy } = {}) => {
      const edad = calcularEdad(c.fecha_nacimiento, hoy)
      return edad === null ? '' : String(edad)
    },
  },
  {
    key: 'genero', label: 'Género', group: 'personales', width: 20,
    get: (c) => {
      const g = (c.genero ?? '').toString().toLowerCase()
      return g === 'm' ? 'Masculino' : g === 'f' ? 'Femenino' : ''
    },
  },
  { key: 'celular', label: 'Celular', group: 'personales', width: 22, get: (c) => c.celular ?? '' },
  { key: 'estado', label: 'Estado', group: 'personales', width: 24, get: (c) => ETIQUETA_ESTADO[c.estado] ?? capitalizar(c.estado) },
  { key: 'grupo', label: 'Grupo', group: 'grupo', width: 24, get: (c) => c.grupo?.nombre ?? 'Sin grupo' },
  { key: 'procedencia', label: 'Procedencia', group: 'grupo', width: 20, get: (c) => capitalizar(c.grupo?.procedencia) },
  { key: 'sacramentos', label: 'Sacramentos', group: 'sacramentos', width: 55, get: (c) => unirConEstado(c.sacramentos) },
  { key: 'apoderados', label: 'Apoderados', group: 'apoderados', width: 70, get: (c) => (c.apoderados ?? []).map(textoApoderado).join('; ') },
  { key: 'requisitos', label: 'Requisitos', group: 'requisitos', width: 55, get: (c) => unirConEstado(c.requisitos) },
  { key: 'fecha_retiro', label: 'Fecha de retiro', group: 'retiro', width: 22, get: (c) => formatearFecha(c.fecha_retiro) },
  { key: 'motivo_retiro', label: 'Motivo de retiro', group: 'retiro', width: 40, get: (c) => c.motivo_retiro ?? '' },
]

// Respeta el orden del catálogo (no el orden en que el usuario marcó).
export function columnasPorClave(claves) {
  const set = new Set(claves)
  return COLUMNAS.filter((c) => set.has(c.key))
}

export function construirFilas(confirmandos, columnas, hoy = new Date()) {
  return confirmandos.map((c) => columnas.map((col) => col.get(c, { hoy })))
}

export function calcularOrientacionPdf(columnas) {
  const total = columnas.reduce((suma, c) => suma + c.width, 0)
  return total <= A4_ANCHO_UTIL_VERTICAL_MM ? 'portrait' : 'landscape'
}

const dosDigitos = (n) => String(n).padStart(2, '0')

export function fechaIso(fecha = new Date()) {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`
}

export function fechaLegible(fecha = new Date()) {
  return `${dosDigitos(fecha.getDate())}/${dosDigitos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`
}

export function nombreArchivoExport({ estado, fecha = new Date(), extension }) {
  return `confirmandos_${String(estado).replace(/_/g, '-')}_${fechaIso(fecha)}.${extension}`
}

export function tituloExport(estado) {
  const e = ESTADOS_EXPORT.find((x) => x.value === estado)
  return `Confirmandos – ${e ? e.plural : capitalizar(estado)}`
}

// Resumen legible de los filtros de la tabla que el export respeta.
export function describirFiltros({ search = '', grupo = 'todos', procedencia = 'todos' } = {}, grupos = []) {
  const out = []
  const termino = (search ?? '').trim()
  if (termino) out.push(`Búsqueda: "${termino}"`)
  if (grupo === 'sin_grupo') out.push('Grupo: Sin grupo asignado')
  else if (grupo !== 'todos') {
    const g = grupos.find((x) => Number(x.id) === Number(grupo))
    out.push(`Grupo: ${g ? g.nombre : grupo}`)
  }
  if (procedencia !== 'todos') out.push(`Procedencia: ${capitalizar(procedencia)}`)
  return out
}
