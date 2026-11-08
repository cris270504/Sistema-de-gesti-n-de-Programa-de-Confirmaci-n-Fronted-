import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css';
import router from './router'
import "bootstrap/dist/css/bootstrap.min.css";
import { showAlerta } from '@/funciones'
import { logFrontendError } from '@/composables/useErrorLogger'

const app = createApp(App)

// Los stores con sintaxis "setup" no traen $reset(): se lo damos a partir de su
// estado inicial, para poder limpiar TODOS los stores al cerrar sesión (si no,
// los datos del usuario anterior quedan en memoria y los ve el siguiente).
const pinia = createPinia()
pinia.use(({ store, options }) => {
  if (options?.state) return // store "options": ya tiene $reset nativo
  let inicial
  try { inicial = structuredClone(store.$state) } catch { inicial = JSON.parse(JSON.stringify(store.$state)) }
  store.$reset = () => {
    let copia
    try { copia = structuredClone(inicial) } catch { copia = JSON.parse(JSON.stringify(inicial)) }
    store.$patch((s) => Object.assign(s, copia))
  }
})
app.use(pinia)
app.use(router)

// Red de seguridad: captura errores de componentes Vue que ningún try/catch local
// atrapó, los reporta al backend y avisa al usuario en vez de dejar la pantalla
// rota en silencio (nunca debe romper la app que intenta proteger).
app.config.errorHandler = (err, instance, info) => {
  console.error('[Error no capturado]', err, info)
  try {
    logFrontendError(err?.message || String(err), err?.stack)
    showAlerta('Ocurrió un error inesperado. Si persiste, recarga la página.', 'error')
  } catch {
    // no-op
  }
}

// Promesas rechazadas sin .catch() en ningún lado (ej. un await suelto en un
// handler de evento). Si el interceptor de api.js ya avisó por este mismo error
// (error.__yaNotificado), no duplicamos el toast — solo lo dejamos logueado.
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  console.error('[Promesa rechazada sin manejar]', reason)
  logFrontendError(reason?.message || String(reason), reason?.stack)
  if (!reason?.__yaNotificado) {
    showAlerta('Ocurrió un error inesperado. Si persiste, recarga la página.', 'error')
  }
})

app.mount('#app')

