<script setup>
// Aviso fijo cuando el dispositivo pierde internet. En parroquias con señal
// irregular, sin esto un "no se pudo guardar" no explica nada.
import { WifiOff } from 'lucide-vue-next'
import { useOnline } from '@vueuse/core'

const online = useOnline()
</script>

<template>
  <Transition name="sin-red">
    <div v-if="!online" class="sin-red" role="alert">
      <WifiOff :size="16" aria-hidden="true" />
      <span>Sin conexión a internet. Los cambios no se guardarán hasta que vuelva la conexión.</span>
    </div>
  </Transition>
</template>

<style scoped>
.sin-red {
  position: fixed;
  top: env(safe-area-inset-top, 0px);
  left: 0;
  right: 0;
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  background: #b45309;
  color: #fff;
  text-align: center;
}
.sin-red-enter-active,
.sin-red-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.sin-red-enter-from,
.sin-red-leave-to { transform: translateY(-100%); opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .sin-red-enter-active, .sin-red-leave-active { transition: none; }
}
</style>
