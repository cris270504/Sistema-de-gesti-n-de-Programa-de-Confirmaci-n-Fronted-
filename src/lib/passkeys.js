// Inicio de sesión con huella / rostro (passkeys, WebAuthn) vía Supabase Auth.
//
// Activación en dos pasos (ver README de la sección "Inicio con huella"):
//   1. Supabase → Authentication → Passkeys: habilitar con el dominio de
//      producción como Relying Party ID.
//   2. Variable de entorno VITE_PASSKEYS=true (Vercel) para mostrar la opción.
// Sin la variable, la app se comporta exactamente como antes.
//
// Un passkey queda atado al dominio: los registrados en producción no sirven
// en localhost ni en otro dominio.

import { supabase } from '@/lib/supabase'

export const PASSKEYS_HABILITADOS = import.meta.env.VITE_PASSKEYS === 'true'

/** ¿Este dispositivo tiene un autenticador propio (huella, rostro, PIN)? */
export async function dispositivoCompatible() {
  if (!PASSKEYS_HABILITADOS) return false
  try {
    return typeof window !== 'undefined'
      && !!window.PublicKeyCredential
      && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * Mensaje para el usuario. Devuelve null cuando la persona canceló el diálogo
 * del sistema (no es un error: no hay que mostrar nada).
 */
export function mensajePasskey(error) {
  if (!error) return 'No se pudo usar la huella. Entra con tu contraseña.'
  const code = String(error.code || '')
  const nombre = String(error.name || '')
  const msg = String(error.message || '')

  if (nombre === 'NotAllowedError' || nombre === 'AbortError'
      || /not allowed|cancel|aborted|timed out|operation either timed out/i.test(msg)) {
    return null
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Sin conexión a internet. Revisa tu red e inténtalo de nuevo.'
  }
  switch (code) {
    case 'passkey_disabled':
      return 'El inicio con huella todavía no está habilitado. Entra con tu contraseña.'
    case 'webauthn_credential_not_found':
      return 'Esta huella no está vinculada a ninguna cuenta. Entra con tu DNI y contraseña y actívala en "Mi perfil".'
    case 'webauthn_credential_exists':
      return 'Este dispositivo ya está registrado en tu cuenta.'
    case 'too_many_passkeys':
      return 'Llegaste al máximo de dispositivos. Quita uno en "Mi perfil" para agregar otro.'
    case 'webauthn_challenge_expired':
    case 'webauthn_challenge_not_found':
      return 'Pasó demasiado tiempo. Inténtalo de nuevo.'
    case 'user_banned':
      return 'Tu cuenta está desactivada. Contacta al administrador de tu parroquia.'
    case 'email_not_confirmed':
      return 'Tu cuenta no está confirmada. Entra con tu contraseña.'
  }
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
  }
  return 'No se pudo usar la huella. Entra con tu contraseña.'
}

// ── Gestión (requiere sesión) ───────────────────────────────────────────────

export async function listarPasskeys() {
  const { data, error } = await supabase.auth.passkey.list()
  if (error) throw error
  return data ?? []
}

export async function registrarPasskey() {
  const { data, error } = await supabase.auth.registerPasskey()
  if (error) throw error
  return data
}

export async function eliminarPasskey(passkeyId) {
  const { error } = await supabase.auth.passkey.delete({ passkeyId })
  if (error) throw error
}

// ── Oferta tras el login con contraseña ─────────────────────────────────────
// "Ahora no" se recuerda por usuario y por dispositivo.

const claveDescarte = (userId) => `huella_oferta_descartada:${userId}`

export function descartarOferta(userId) {
  try { localStorage.setItem(claveDescarte(userId), '1') } catch { /* modo privado */ }
}

/** ¿Ofrecer "entrar con huella la próxima vez" a este usuario en este dispositivo? */
export async function debeOfrecerHuella(userId) {
  if (!userId || !(await dispositivoCompatible())) return false
  try {
    if (localStorage.getItem(claveDescarte(userId)) === '1') return false
  } catch { /* sin storage: se ofrece igual */ }
  try {
    return (await listarPasskeys()).length === 0
  } catch {
    return false // si no se puede consultar, no molestamos
  }
}
