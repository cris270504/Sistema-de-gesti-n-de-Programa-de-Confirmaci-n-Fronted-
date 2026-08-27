import { API_BASE_URL } from '@/constants/api';
import { LS_TOKEN_KEY } from '@/constants/auth';

// Protección simple contra flood: si algo entra en loop de errores (ej. un render
// que falla en cada tick), no queremos mandar cientos de peticiones por sesión.
const MAX_LOGS_PER_SESSION = 20;
const mensajesYaEnviados = new Set();
let enviados = 0;

/**
 * Reporta un error de JS/Vue al backend (POST /logs/frontend-error), sin bloquear
 * la UI ni volver a lanzar si el propio reporte falla.
 *
 * Usa `fetch` crudo (no la instancia `api` de axios) a propósito: si este POST
 * fallara, no queremos que dispare de nuevo el interceptor de errores de `api.js`
 * y termine reportándose a sí mismo en bucle.
 *
 * @param {string} message
 * @param {string} [stack]
 */
export function logFrontendError(message, stack = '') {
  try {
    if (!message) return;

    const token = localStorage.getItem(LS_TOKEN_KEY);
    if (!token) return; // el endpoint requiere sesión; sin token no vale la pena intentarlo

    if (enviados >= MAX_LOGS_PER_SESSION) return;
    if (mensajesYaEnviados.has(message)) return; // no repetir el mismo error muchas veces
    mensajesYaEnviados.add(message);
    enviados++;

    fetch(`${API_BASE_URL}/logs/frontend-error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: String(message).slice(0, 2000),
        stack: String(stack || '').slice(0, 8000),
        url: window.location.href,
      }),
    }).catch(() => {});
  } catch {
    // El logger de errores nunca debe romper la app que intenta proteger.
  }
}
