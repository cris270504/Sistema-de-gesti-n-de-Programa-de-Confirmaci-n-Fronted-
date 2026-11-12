// Redes sociales, WhatsApp y contacto de una parroquia: validación (misma regla
// que los CHECK de la base) y armado de enlaces. Sin Vue ni red.

export const PREFIJO_POR_ZONA = {
  'America/Lima': '+51',
  'America/Bogota': '+57',
  'America/Guayaquil': '+593',
  'America/La_Paz': '+591',
  'America/Santiago': '+56',
  'America/Argentina/Buenos_Aires': '+54',
  'America/Mexico_City': '+52',
  'America/Caracas': '+58',
}

export const prefijoSugerido = (zona) => PREFIJO_POR_ZONA[zona] ?? '+51'

const RE_INSTAGRAM = /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.\-/?=&%]+$/i
const RE_FACEBOOK = /^https:\/\/((www|m|web)\.)?(facebook\.com|fb\.com)\/[A-Za-z0-9_.\-/?=&%]+$/i
const RE_PREFIJO = /^\+[1-9][0-9]{0,3}$/

// '' / null → null (no se muestra). Devuelve { valor, error }.
export function validarRed(tipo, url) {
  const v = (url ?? '').trim()
  if (!v) return { valor: null, error: '' }
  if (v.length > 300) return { valor: v, error: 'El enlace es demasiado largo.' }
  const re = tipo === 'instagram' ? RE_INSTAGRAM : RE_FACEBOOK
  if (!re.test(v)) {
    return {
      valor: v,
      error: tipo === 'instagram'
        ? 'Debe ser el enlace completo de Instagram, por ejemplo https://www.instagram.com/tu_parroquia/'
        : 'Debe ser el enlace completo de Facebook, por ejemplo https://www.facebook.com/tu.parroquia',
    }
  }
  return { valor: v, error: '' }
}

export function validarPrefijo(prefijo) {
  const v = (prefijo ?? '').trim().replace(/\s+/g, '')
  const conMas = v && !v.startsWith('+') ? `+${v}` : v
  if (!RE_PREFIJO.test(conMas)) return { valor: conMas, error: 'Usa el formato +51 (de 1 a 4 dígitos).' }
  return { valor: conMas, error: '' }
}

// Enlace de WhatsApp: quita todo lo que no sea dígito y antepone el prefijo,
// salvo que el número ya lo traiga. null si no hay número.
export function enlaceWhatsapp(celular, prefijo = '+51') {
  const digitos = String(celular ?? '').replace(/\D/g, '')
  if (!digitos) return null
  const pre = String(prefijo ?? '+51').replace(/\D/g, '') || '51'
  const completo = digitos.startsWith(pre) && digitos.length > 9 ? digitos : `${pre}${digitos}`
  return `https://wa.me/${completo}`
}
