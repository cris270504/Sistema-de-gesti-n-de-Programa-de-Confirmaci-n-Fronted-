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
]

// Marcas de un mensaje crudo de Postgres (no redactado por nosotros).
const CRUDO = /(violates|constraint|relation ["']|column ["']|null value in|duplicate key|invalid input syntax|permission denied for|does not exist|out of range|syntax error)/i

export function traducirError(error) {
  if (!error) return 'Ocurrió un error inesperado.'
  const msg = String(error.message || error.msg || error).trim()
  const code = error.code || error.details?.code

  // Violación de un constraint con nombre propio → mensaje específico.
  for (const nombre in POR_CONSTRAINT) {
    if (msg.includes(nombre)) return POR_CONSTRAINT[nombre]
  }

  // Mensaje nuestro (español, sin jerga de Postgres) → mostrarlo.
  if (msg && !CRUDO.test(msg) && /[a-záéíóúñ]/i.test(msg) && msg.length <= 300) {
    return msg
  }

  // Errores de Storage / Auth (vienen en inglés).
  for (const [re, txt] of POR_TEXTO) {
    if (re.test(msg)) return txt
  }

  return POR_CODIGO[code] || 'No se pudo completar la operación. Inténtalo de nuevo.'
}

// Envuelve un error crudo en uno con `message` ya traducido (para `throw`).
export function errorLegible(error) {
  const e = new Error(traducirError(error))
  e.code = error?.code
  return e
}
