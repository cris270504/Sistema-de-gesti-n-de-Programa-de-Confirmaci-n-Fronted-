import { defineStore } from 'pinia'

let _nextToastId = 1

/**
 * Estado de interfaz transversal: el overlay de carga a pantalla completa
 * (transiciones lentas: login, cierre de sesión, arranque en frío del
 * backend) y la pila de toasts (confirmaciones de éxito que no necesitan
 * bloquear la pantalla con un modal — ver showAlerta en funciones.js).
 */
export const useUiStore = defineStore('ui', {
  state: () => ({
    overlay: false,
    overlayText: 'Cargando…',
    toasts: [],
  }),

  actions: {
    showOverlay(text = 'Cargando…') {
      this.overlayText = text
      this.overlay = true
    },
    hideOverlay() {
      this.overlay = false
    },

    pushToast(mensaje, duracionMs = 3500) {
      const id = _nextToastId++
      this.toasts.push({ id, mensaje })
      if (duracionMs > 0) {
        setTimeout(() => this.removeToast(id), duracionMs)
      }
      return id
    },
    removeToast(id) {
      this.toasts = this.toasts.filter(t => t.id !== id)
    },
  },
})
