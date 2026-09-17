import { ref, computed } from 'vue'

const STORAGE_KEY = 'sgpc-theme'

function prefiereOscuro() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function leerTemaInicial() {
  try {
    const guardado = localStorage.getItem(STORAGE_KEY)
    if (guardado === 'dark' || guardado === 'light') return guardado
  } catch { /* localStorage bloqueado (modo privado, etc.) */ }
  return prefiereOscuro() ? 'dark' : 'light'
}

function aplicarTema(valor) {
  document.documentElement.setAttribute('data-bs-theme', valor)
  try { localStorage.setItem(STORAGE_KEY, valor) } catch { /* ignorar */ }
}

const tema = ref(leerTemaInicial())
aplicarTema(tema.value)

/**
 * Tema claro/oscuro del sistema. Estado a nivel de módulo (no por instancia):
 * todo componente que llame useTheme() comparte el mismo `tema`, así el
 * toggle del Navbar y cualquier otro consumidor quedan sincronizados.
 */
export function useTheme() {
  const esOscuro = computed(() => tema.value === 'dark')

  function alternarTema() {
    tema.value = tema.value === 'dark' ? 'light' : 'dark'
    aplicarTema(tema.value)
  }

  return { esOscuro, alternarTema }
}
