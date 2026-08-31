import { supabase } from '@/lib/supabase';
import { LS_TOKEN_KEY } from '@/constants/auth';

// Protección simple contra flood: si algo entra en loop de errores (ej. un render
// que falla en cada tick), no queremos mandar cientos de peticiones por sesión.
const MAX_LOGS_PER_SESSION = 20;
const mensajesYaEnviados = new Set();
let enviados = 0;

/**
 * Reporta un error de JS/Vue al backend (RPC `fn_log_frontend_error`), sin
 * bloquear la UI ni volver a lanzar si el propio reporte falla.
 *
 * @param {string} message
 * @param {string} [stack]
 */
export function logFrontendError(message, stack = '') {
  try {
    if (!message) return;
    if (!localStorage.getItem(LS_TOKEN_KEY)) return; // sin sesión no vale la pena

    if (enviados >= MAX_LOGS_PER_SESSION) return;
    if (mensajesYaEnviados.has(message)) return; // no repetir el mismo error muchas veces
    mensajesYaEnviados.add(message);
    enviados++;

    supabase.rpc('fn_log_frontend_error', {
      p_message: String(message).slice(0, 2000),
      p_stack: String(stack || '').slice(0, 8000),
      p_url: window.location.href,
      p_user_agent: navigator.userAgent,
    }).catch(() => {});
  } catch {
    // El logger de errores nunca debe romper la app que intenta proteger.
  }
}
