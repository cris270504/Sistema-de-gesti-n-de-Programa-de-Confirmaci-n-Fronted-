import axios from 'axios';
import router, { rutaRedirectSegura } from '@/router';
import { LS_TOKEN_KEY,LS_USER_KEY } from '@/constants/auth';
import { API_BASE_URL } from '@/constants/api';
import { showAlerta } from '@/funciones';
import { logFrontendError } from '@/composables/useErrorLogger';
import { useUiStore } from '@/stores/ui';
import { supabase, currentAccessToken } from '@/lib/supabase';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json'
  }
});

api.interceptors.request.use(async (config) => {
  // Token vigente de la sesión de Supabase (supabase-js lo refresca solo).
  // Fallback al espejo en localStorage por si getSession() aún no resolvió.
  let token
  try {
    token = await currentAccessToken()
  } catch { /* noop */ }
  token = token || localStorage.getItem(LS_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// --- Reintentos automáticos para el "cold start" de Render ---------------------
// El backend gratuito de Render se duerme a los 15 min: la primera petición tras
// eso tarda 30–60 s o falla con error de red / 502 / 503 / 504. En vez de mostrarle
// un toast rojo al usuario, reintentamos con backoff y le enseñamos un overlay
// honesto ("estamos despertando el servidor"). Cuando el server responde, seguimos
// como si nada.
const RETRY_DELAYS = [2000, 5000, 10000] // ~17 s en total antes de rendirse
const RETRY_STATUS = [502, 503, 504]

let warmupActivo = false
function mostrarWarmup() {
  if (warmupActivo) return
  warmupActivo = true
  try { useUiStore().showOverlay('Estamos despertando el servidor, esto puede tardar unos segundos…') } catch { /* pinia aún no lista */ }
}
function ocultarWarmup() {
  if (!warmupActivo) return
  warmupActivo = false
  try { useUiStore().hideOverlay() } catch { /* noop */ }
}

function esReintentable(error) {
  const cfg = error?.config
  if (!cfg) return false
  const metodo = (cfg.method || 'get').toLowerCase()
  // Solo reintentamos métodos seguros (idempotentes) salvo que el caller marque
  // explícitamente la petición como reintentable (p. ej. el login).
  const metodoSeguro = ['get', 'head', 'options'].includes(metodo) || cfg.__retryable
  if (!metodoSeguro) return false

  const status = error?.response?.status
  if (!status) return true // sin respuesta: error de red / timeout / server dormido
  return RETRY_STATUS.includes(status)
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

api.interceptors.response.use(
  (res) => {
    ocultarWarmup()
    return res
  },
  async (error) => {
    const cfg = error.config || {}

    // 1) ¿Toca reintentar? (cold start de Render)
    cfg.__retryCount = cfg.__retryCount || 0
    if (esReintentable(error) && cfg.__retryCount < RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[cfg.__retryCount]
      cfg.__retryCount += 1
      if (!cfg.__noWarmup) mostrarWarmup()
      await esperar(delay)
      return api(cfg)
    }

    // Se agotaron los reintentos (o no aplicaban): cerramos el overlay de warm-up.
    ocultarWarmup()

    const status = error?.response?.status

    if (status === 401) {
      localStorage.removeItem(LS_TOKEN_KEY)
      localStorage.removeItem(LS_USER_KEY)
      supabase.auth.signOut().catch(() => {})
      if (router.currentRoute.value.name !== 'login') {
        showAlerta('Tu sesión expiró, vuelve a iniciar sesión', 'info')
        const redirect = rutaRedirectSegura(router.currentRoute.value.fullPath)
        router.push({ name: 'login', query: redirect ? { redirect } : {} })
      }
    } else if (!error.config?.silent && (!status || status >= 500)) {
      // Errores de red (sin respuesta) o 5xx: casi nunca los maneja el componente que
      // hizo la petición, así que mostramos un aviso genérico. Los 4xx (validación,
      // permisos, etc.) se quedan igual que antes: cada pantalla ya los maneja.
      // Un caller puede pasar `{ silent: true }` en la config del request para que este
      // interceptor no duplique un toast que el propio componente ya va a mostrar.
      showAlerta('No se pudo conectar con el servidor. Intenta de nuevo en unos segundos.', 'error')
      logFrontendError(
        `[HTTP ${status ?? 'network'}] ${error.config?.method?.toUpperCase()} ${error.config?.url}: ${error.message}`
      )
      // Si nadie atrapa este rechazo y termina como 'unhandledrejection' (main.js),
      // evitamos mostrarle un segundo toast al usuario por el mismo error.
      error.__yaNotificado = true
    }

    return Promise.reject(error)
  }
)

export default api;
