<script setup>
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui'

const { overlay, overlayText } = storeToRefs(useUiStore())
</script>

<template>
  <Transition name="ov-fade">
    <div v-if="overlay" class="ov" role="status" aria-live="polite">
      <div class="ov__box">
        <span class="ov__spinner" aria-hidden="true"></span>
        <p class="ov__text">{{ overlayText }}</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.ov {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(248, 250, 252, 0.78);
  backdrop-filter: blur(3px);
}
.ov__box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 2.5rem;
}
.ov__spinner {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid var(--line);
  border-top-color: var(--accent);
  animation: ov-spin 0.7s linear infinite;
}
.ov__text {
  font-size: var(--fs-ui);
  font-weight: 600;
  color: var(--text-muted);
}
@keyframes ov-spin {
  to { transform: rotate(360deg); }
}
.ov-fade-enter-active,
.ov-fade-leave-active {
  transition: opacity 0.2s ease;
}
.ov-fade-enter-from,
.ov-fade-leave-to {
  opacity: 0;
}
</style>
