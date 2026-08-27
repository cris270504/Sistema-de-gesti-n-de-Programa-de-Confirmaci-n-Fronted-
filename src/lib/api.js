import axios from 'axios';
import router from '@/router';
import { LS_TOKEN_KEY,LS_USER_KEY } from '@/constants/auth';
import { API_BASE_URL } from '@/constants/api';
import { showAlerta } from '@/funciones';
import { logFrontendError } from '@/composables/useErrorLogger';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json'
  }
});

api.interceptors.request.use((config) => {  
  const token = localStorage.getItem(LS_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status

    if (status === 401) {
      localStorage.removeItem(LS_TOKEN_KEY)
      localStorage.removeItem(LS_USER_KEY)
      if (router.currentRoute.value.name !== 'login') {
        showAlerta('Tu sesión expiró, vuelve a iniciar sesión', 'info')
        router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
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
