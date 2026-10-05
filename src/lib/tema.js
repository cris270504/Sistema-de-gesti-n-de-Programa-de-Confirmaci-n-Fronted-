// Color de marca de la parroquia aplicado a TODO el sistema.
//
// Pinta las variables CSS que realmente consumen los estilos:
//   --parroquia-color  → estilos propios (.btn-primary, chips, headers de modal…)
//   --color-primary    → utilidades Tailwind text-primary/bg-primary y Sidebar
//   --bs-primary(-rgb) → utilidades Bootstrap .text-primary/.bg-primary/.badge…
//
// Se fijan como estilo inline en <html>, así ganan siempre a las hojas de estilo.

const HEX6 = /^#[0-9a-fA-F]{6}$/

export function hexARgb(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '')
  if (!m) return null
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

// Color de acento vigente (--accent resuelve a --parroquia-color) para APIs que
// exigen un color literal (p. ej. eventos de FullCalendar) y no aceptan var().
export function colorAcento() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  return HEX6.test(v) ? v : '#2563eb'
}

export function aplicarColorParroquia(hex) {
  if (!HEX6.test(hex || '')) return
  const root = document.documentElement.style
  root.setProperty('--parroquia-color', hex)
  root.setProperty('--color-primary', hex)
  root.setProperty('--bs-primary', hex)
  const rgb = hexARgb(hex)
  if (rgb) root.setProperty('--bs-primary-rgb', rgb)
}
