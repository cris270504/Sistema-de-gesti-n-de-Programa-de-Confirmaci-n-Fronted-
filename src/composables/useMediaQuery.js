import { ref, onUnmounted } from 'vue'

/**
 * Reactivo a un media query. Devuelve un ref booleano que se actualiza al
 * cambiar el tamaño/orientación de la pantalla.
 *
 *   const isPhone = useMediaQuery('(max-width: 767px)')
 */
export function useMediaQuery(query) {
  const matches = ref(false)

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mq = window.matchMedia(query)
    matches.value = mq.matches
    const handler = (e) => { matches.value = e.matches }
    mq.addEventListener('change', handler)
    onUnmounted(() => mq.removeEventListener('change', handler))
  }

  return matches
}
