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

// Marcas de un mensaje crudo de Postgres (no redactado por nosotros).
const CRUDO = /(violates|constraint|relation ["']|column ["']|null value in|duplicate key|invalid input syntax|permission denied for|does not exist|out of range|syntax error)/i

export function traducirError(error) {
  if (!error) return 'Ocurrió un error inesperado.'
  const msg = String(error.message || error.msg || error).trim()
  const code = error.code || error.details?.code

  // Mensaje nuestro (español, sin jerga de Postgres) → mostrarlo.
  if (msg && !CRUDO.test(msg) && /[a-záéíóúñ]/i.test(msg) && msg.length <= 300) {
    return msg
  }
  return POR_CODIGO[code] || 'No se pudo completar la operación. Inténtalo de nuevo.'
}

// Envuelve un error crudo en uno con `message` ya traducido (para `throw`).
export function errorLegible(error) {
  const e = new Error(traducirError(error))
  e.code = error?.code
  return e
}
