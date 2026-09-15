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
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #d1fae5;
  border-left: 4px solid #16a34a;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}
.toast-item__ico { color: #16a34a; flex-shrink: 0; }
.toast-item__msg { font-size: 0.85rem; color: #1e293b; flex: 1 1 auto; }
.toast-item__close {
  border: 0;
  background: transparent;
  color: #94a3b8;
  flex-shrink: 0;
  display: inline-flex;
  padding: 0.15rem;
  border-radius: 6px;
}
.toast-item__close:hover { background: #f1f5f9; color: #475569; }

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
</style>
