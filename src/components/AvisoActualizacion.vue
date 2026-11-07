<script setup>
// Aviso de versión nueva de la app (PWA). El service worker ya no se cambia
// solo: al detectar una versión nueva se muestra este aviso y la app se recarga
// cuando la persona toca "Actualizar" — así nadie pierde cambios sin guardar
// (p. ej. una asistencia a medio marcar).
import { onUnmounted } from 'vue'
import { RefreshCw, X } from 'lucide-vue-next'
import { useRegisterSW } from 'virtual:pwa-register/vue'

const UNA_HORA = 60 * 60 * 1000
let intervalo = null
let registro = null

// La app instalada puede quedar abierta días: se busca versión nueva cada hora
// y cada vez que la persona vuelve a la app.
const buscarActualizacion = () => {
  if (document.visibilityState === 'visible') registro?.update().catch(() => {})
}

const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(_url, r) {
    if (!r) return
    registro = r
    intervalo = setInterval(buscarActualizacion, UNA_HORA)
    document.addEventListener('visibilitychange', buscarActualizacion)
  },
})

const actualizar = () => updateServiceWorker(true)
const despues = () => { needRefresh.value = false }

onUnmounted(() => {
  clearInterval(intervalo)
  document.removeEventListener('visibilitychange', buscarActualizacion)
})
</script>

<template>
  <Transition name="aviso-act">
    <div v-if="needRefresh" class="aviso-act" role="status" aria-live="polite">
      <RefreshCw :size="18" class="aviso-act__ico" aria-hidden="true" />
      <span class="aviso-act__txt">Hay una nueva versión del sistema.</span>
      <button type="button" class="aviso-act__btn" @click="actualizar">Actualizar</button>
      <button type="button" class="aviso-act__cerrar" aria-label="Más tarde" title="Más tarde" @click="despues">
        <X :size="16" aria-hidden="true" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.aviso-act {
  position: fixed;
  left: 50%;
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: max-content;
  max-width: calc(100vw - 2rem);
  padding: 0.6rem 0.6rem 0.6rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-lg);
  font-size: var(--fs-ui);
}
.aviso-act__ico { color: var(--accent); flex-shrink: 0; }
.aviso-act__txt { min-width: 0; }
.aviso-act__btn {
  padding: 0.35rem 0.8rem;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  white-space: nowrap;
}
.aviso-act__btn:hover { background: color-mix(in srgb, var(--accent), #000 10%); }
.aviso-act__cerrar {
  display: inline-flex;
  padding: 0.3rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
}
.aviso-act__cerrar:hover { background: var(--surface-sunken); color: var(--text); }
.aviso-act__btn:focus-visible,
.aviso-act__cerrar:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
/* En celular, por encima de la barra de accesos rápidos. */
@media (max-width: 767px) {
  .aviso-act { bottom: calc(72px + env(safe-area-inset-bottom, 0px)); }
}
.aviso-act-enter-active, .aviso-act-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.aviso-act-enter-from, .aviso-act-leave-to { opacity: 0; transform: translate(-50%, 0.5rem); }
@media (prefers-reduced-motion: reduce) {
  .aviso-act-enter-active, .aviso-act-leave-active { transition: none; }
}
</style>
