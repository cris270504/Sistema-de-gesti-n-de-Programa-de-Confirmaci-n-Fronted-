// Validación de la configuración de justificaciones (misma regla que la base:
// fn_guardar_configuracion y fn_guardar_justificacion_acciones). '' = válido.

export function validarMotivos(motivos = []) {
  const limpios = motivos.map((m) => String(m ?? '').trim()).filter(Boolean)
  if (limpios.length === 0) return 'Deja al menos un motivo de justificación.'
  if (limpios.length > 20) return 'Puedes tener hasta 20 motivos.'
  if (limpios.some((m) => m.length > 80)) return 'Cada motivo admite hasta 80 caracteres.'
  return ''
}

export function validarAcciones(acciones = []) {
  if (acciones.length === 0 || acciones.length > 20) return 'Define entre 1 y 20 acciones reparadoras.'
  const nombres = acciones.map((a) => String(a.nombre ?? '').trim())
  if (nombres.some((n) => !n)) return 'Cada acción reparadora necesita un nombre.'
  if (nombres.some((n) => n.length > 60)) return 'El nombre de una acción admite hasta 60 caracteres.'
  if (new Set(nombres.map((n) => n.toLowerCase())).size !== nombres.length) return 'Hay acciones con el mismo nombre.'
  if (!acciones.some((a) => a.activo)) return 'Deja al menos una acción reparadora activa.'
  for (const a of acciones) {
    const c = a.cupo_por_fecha
    if (c === '' || c === null || c === undefined) continue
    const n = Number(c)
    if (!Number.isInteger(n) || n < 1 || n > 99) return `El cupo de «${String(a.nombre).trim()}» debe estar entre 1 y 99 (o vacío).`
  }
  return ''
}
