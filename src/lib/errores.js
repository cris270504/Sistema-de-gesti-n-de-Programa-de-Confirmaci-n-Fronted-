import { logFrontendError } from '@/composables/useErrorLogger'

// Traduce un error de Supabase/PostgREST a un mensaje entendible para el usuario.
// CLAUDE.md §3: no exponer errores crudos del servidor.
//
// - Nuestros RPC/triggers lanzan con RAISE y mensaje YA redactado en español →
//   se muestra tal cual.
// - Los errores "crudos" de Postgres (violaciones de constraint, not-null, etc.)
//   traen inglés + nombres internos → se mapean por código a un mensaje genérico.

const POR_CODIGO = {
  '23505': 'Ya existe un registro con esos datos.',
  '23502': 'Falta completar un campo obligatorio.',
  '23503': 'No se puede: el registro está vinculado a otros datos.',
  '23514': 'Alguno de los datos no cumple las reglas del sistema.',
  '22007': 'Una fecha tiene un formato inválido.',
  '22P02': 'Un dato tiene un formato inválido.',
  '42501': 'No tienes permiso para realizar esta acción.',
  '40001': 'Otra persona guardó al mismo tiempo. Vuelve a intentarlo.',
  '55P03': 'El recurso está ocupado por otra operación. Intenta de nuevo.',
  PGRST301: 'Tu sesión expiró. Vuelve a iniciar sesión.',
}

// Mensajes por nombre de constraint (violaciones de CHECK/UNIQUE con nombre propio).
const POR_CONSTRAINT = {
  confirmandos_nombres_no_vacios: 'El confirmando necesita nombres y apellidos.',
  confirmandos_celular_check: 'El celular debe tener 9 dígitos.',
  grupos_parroquia_nombre_periodo_uq: 'Ya existe un grupo con ese nombre en ese periodo.',
  asistencia_reunion_asistente_uq: 'Ya hay un registro de asistencia para esa persona en esa reunión.',
  parroquias_slug_unique: 'Ese identificador (slug) ya está en uso.',
  roles_parroquia_name_guard_uq: 'Ya existe un rol con ese nombre en tu parroquia.',
  parroquias_instagram_url_check: 'El enlace de Instagram no es válido: pega la dirección completa (https://www.instagram.com/…).',
  parroquias_facebook_url_check: 'El enlace de Facebook no es válido: pega la dirección completa (https://www.facebook.com/…).',
  parroquias_whatsapp_prefijo_check: 'El prefijo de WhatsApp debe tener el formato +51 (de 1 a 4 dígitos).',
  justificacion_acciones_nombre_uq: 'Ya existe una acción reparadora con ese nombre.',
  sacramento_requisito_sacramento_id_requisito_id_unique: 'Ese documento ya está asignado a ese sacramento.',
  parroquia_config_edad_chk: 'El rango de edad para grupos no es válido (1–99, mínimo ≤ máximo).',
}

// Errores de Supabase Storage / GoTrue → mensaje amable.
const POR_TEXTO = [
  [/row-level security|not authorized|Unauthorized/i, 'No tienes permiso para esa operación.'],
  [/Invalid login credentials/i, 'Correo/DNI o contraseña incorrectos.'],
  [/exceeded the maximum allowed size|Payload too large/i, 'El archivo es demasiado grande.'],
  [/mime type .* is not supported|invalid_mime_type/i, 'Ese tipo de archivo no está permitido.'],
  [/The resource already exists|Duplicate/i, 'Ese archivo ya existe.'],
  [/JWT expired|token is expired/i, 'Tu sesión expiró. Vuelve a iniciar sesión.'],
  [/Failed to fetch|NetworkError|Load failed|Failed to send a request/i, 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'],
]

// Marcas de un mensaje crudo de Postgres (no redactado por nosotros).
const CRUDO = /(violates|constraint|relation ["']|column ["']|null value in|duplicate key|invalid input syntax|permission denied for|does not exist|out of range|syntax error|could not embed|more than one relationship)/i

export function traducirError(error) {
  if (!error) return 'Ocurrió un error inesperado.'
  const msg = String(error.message || error.msg || error).trim()
  const code = error.code || error.details?.code

  // Violación de un constraint con nombre propio → mensaje específico.
  for (const nombre in POR_CONSTRAINT) {
    if (msg.includes(nombre)) return POR_CONSTRAINT[nombre]
  }

  // Error crudo de Postgres con código conocido → mensaje por código (antes de
  // POR_TEXTO: "duplicate key" no debe caer en el "Duplicate" de Storage).
  if (CRUDO.test(msg) && POR_CODIGO[code]) return POR_CODIGO[code]

  // Errores de Storage / Auth / red (vienen en inglés). Van antes del chequeo de
  // "mensaje nuestro": ese solo mira que haya letras y dejaba pasar inglés crudo.
  for (const [re, txt] of POR_TEXTO) {
    if (re.test(msg)) return txt
  }

  // Mensaje nuestro (español, sin jerga de Postgres) → mostrarlo.
  if (msg && !CRUDO.test(msg) && /[a-záéíóúñ]/i.test(msg) && msg.length <= 300) {
    return msg
  }

  return POR_CODIGO[code] || 'No se pudo completar la operación. Inténtalo de nuevo.'
}

// Mensaje para un login fallido. Distingue lo que el usuario puede resolver
// (red, esperar por exceso de intentos, servicio caído) de credenciales malas.
// Credenciales/identificador inexistente comparten mensaje a propósito (no
// revelar si un DNI/correo está registrado).
export const LOGIN_MSG = {
  credenciales: 'Correo/DNI o contraseña incorrectos.',
  sinConexion: 'Sin conexión a internet. Revisa tu red e inténtalo de nuevo.',
  servicio: 'El servicio no está disponible en este momento. Inténtalo en unos minutos.',
  demasiados: 'Demasiados intentos. Espera unos minutos antes de volver a intentar.',
  parroquiaInactiva: 'Tu parroquia está desactivada. Contacta con el proveedor del sistema.',
}

const minutos = (seg) => Math.max(1, Math.ceil(Number(seg) / 60))

// `cuerpo`: JSON de error de la Edge Function `login` ({ error, retry_after }).
export function motivoFalloLogin(error, online = typeof navigator === 'undefined' ? true : navigator.onLine, cuerpo = null) {
  if (!online) return LOGIN_MSG.sinConexion
  if (cuerpo?.error === 'parroquia_inactiva') return LOGIN_MSG.parroquiaInactiva
  if (cuerpo?.error === 'demasiados_intentos') {
    return cuerpo.retry_after
      ? `Demasiados intentos. Vuelve a intentar en ${minutos(cuerpo.retry_after)} min.`
      : LOGIN_MSG.demasiados
  }
  if (cuerpo?.error === 'credenciales' || cuerpo?.error === 'bad_request') return LOGIN_MSG.credenciales
  if (cuerpo?.error === 'server_error') return LOGIN_MSG.servicio
  if (!error) return LOGIN_MSG.credenciales
  const nombre = error.name || ''
  const status = Number(error.status ?? error.context?.status ?? 0)
  const msg = String(error.message || '')

  if (status === 429 || /rate limit|too many/i.test(msg)) return LOGIN_MSG.demasiados
  if (status >= 500) return LOGIN_MSG.servicio
  if (nombre === 'FunctionsFetchError' || nombre === 'AuthRetryableFetchError'
      || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return LOGIN_MSG.sinConexion
  }
  if (nombre === 'FunctionsRelayError') return LOGIN_MSG.servicio
  return LOGIN_MSG.credenciales
}

// ¿El error delata un bug (y no una validación, un permiso o la red del usuario)?
// Esos son los que vale la pena que el proveedor vea en "Errores del sistema".
const PGRST_ESPERADOS = new Set(['PGRST116', 'PGRST301', 'PGRST303'])
export function esErrorInesperado(error) {
  if (!error) return false
  const msg = String(error.message || error.msg || '')
  const code = String(error.code || '')
  if (/Failed to fetch|NetworkError|Load failed|Failed to send a request/i.test(msg)) return false
  if (code === '42501') return false                        // permiso denegado: esperado
  if (/^42/.test(code)) return true                          // columna/función/tabla inexistente
  if (/^PGRST/.test(code)) return !PGRST_ESPERADOS.has(code) // embebidos rotos, etc.
  if (/^(XX|58|53)/.test(code)) return true                  // error interno / recursos del servidor
  return false
}

// Envuelve un error crudo en uno con `message` ya traducido (para `throw`).
// Si delata un bug, queda registrado para el proveedor (sin bloquear nada).
export function errorLegible(error) {
  const e = new Error(traducirError(error))
  e.code = error?.code
  if (esErrorInesperado(error)) {
    logFrontendError(`[API ${error.code}] ${error.message || ''}`.trim(), new Error().stack)
  }
  return e
}
