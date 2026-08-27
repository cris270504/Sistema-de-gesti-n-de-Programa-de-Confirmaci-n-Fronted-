/**
 * Bootstrap solo devuelve el foco al elemento que abrió un modal cuando este se
 * abre vía `data-bs-toggle="modal"`. En este proyecto todos los modales se abren
 * programáticamente (`modalInstance.value.show()`), así que Bootstrap no lo hace
 * por su cuenta — sin esto, al cerrar un modal el foco del teclado se pierde
 * (queda en el body), lo cual es un problema real de accesibilidad para
 * navegación por teclado/lector de pantalla.
 *
 * Se llama una sola vez, justo donde ya se tiene la referencia al elemento
 * `<div class="modal">` (al lado de `new Modal(el)`).
 *
 * @param {HTMLElement|null|undefined} el - el elemento raíz del modal
 * @returns {() => void} función de limpieza — llamarla en onUnmounted
 */
export function attachModalFocusReturn(el) {
  if (!el) return () => {}

  let elementoQueAbrio = null
  const onShow = () => { elementoQueAbrio = document.activeElement }
  const onHidden = () => { elementoQueAbrio?.focus?.() }

  el.addEventListener('show.bs.modal', onShow)
  el.addEventListener('hidden.bs.modal', onHidden)

  return () => {
    el.removeEventListener('show.bs.modal', onShow)
    el.removeEventListener('hidden.bs.modal', onHidden)
  }
}
