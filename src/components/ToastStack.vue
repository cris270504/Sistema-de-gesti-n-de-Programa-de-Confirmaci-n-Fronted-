<script setup>
import { storeToRefs } from 'pinia'
import { CheckCircle2, X } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'

const uiStore = useUiStore()
const { toasts } = storeToRefs(uiStore)
</script>

<template>
  <div class="toast-stack" role="status" aria-live="polite">
    <TransitionGroup name="toast-anim">
      <div v-for="t in toasts" :key="t.id" class="toast-item">
        <CheckCircle2 :size="18" class="toast-item__ico" aria-hidden="true" />
        <span class="toast-item__msg">{{ t.mensaje }}</span>
        <button type="button" class="toast-item__close" aria-label="Cerrar" @click="uiStore.removeToast(t.id)">
          <X :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 2100;
  display: flex;
  flex-direction: column-reverse;
  gap: 0.5rem;
  max-width: min(360px, calc(100vw - 2rem));
}
.toast-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.9rem;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid #d1fae5;
  border-left: 4px solid #16a34a;
  box-shadow: var(--shadow-lg);
}
.toast-item__ico { color: #16a34a; flex-shrink: 0; }
.toast-item__msg { font-size: var(--fs-ui); color: var(--text); flex: 1 1 auto; }
.toast-item__close {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  flex-shrink: 0;
  display: inline-flex;
  padding: 0.15rem;
  border-radius: var(--radius-sm);
}
.toast-item__close:hover { background: var(--surface-sunken); color: var(--text); }

.toast-anim-enter-active,
.toast-anim-leave-active {
  transition: all 0.2s ease;
}
.toast-anim-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.toast-anim-leave-to {
  opacity: 0;
  transform: translateX(8px);
}
.toast-anim-leave-active {
  position: absolute;
}

/* ===== MODO OSCURO ===== */
:root[data-bs-theme="dark"] .toast-item {
  background: var(--surface);
  border-color: #14532d;
}
:root[data-bs-theme="dark"] .toast-item__msg { color: var(--text); }
:root[data-bs-theme="dark"] .toast-item__close { color: var(--text-muted); }
:root[data-bs-theme="dark"] .toast-item__close:hover {
  background: var(--line);
  color: var(--text);
}
</style>
