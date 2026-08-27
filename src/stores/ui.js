import { defineStore } from 'pinia'

/**
 * Estado de interfaz transversal. Hoy solo controla el overlay de carga a pantalla
 * completa que se muestra durante transiciones lentas (login, cierre de sesión,
 * arranque en frío del backend en Render).
 */
export const useUiStore = defineStore('ui', {
  state: () => ({
    overlay: false,
    overlayText: 'Cargando…',
  }),

  actions: {
    showOverlay(text = 'Cargando…') {
      this.overlayText = text
      this.overlay = true
    },
    hideOverlay() {
      this.overlay = false
    },
  },
})
