<script setup>
/**
 * Estado vacío único del sistema: ícono + una frase simple + (opcional) la acción
 * que lo resuelve. La acción va en el slot por defecto y la muestra solo quien
 * tenga permiso (el v-if va en el botón del padre).
 * Estilos globales: `.empty-state` en src/assets/main.css.
 */
defineProps({
  message: { type: String, required: true },
  icon: { type: [Object, Function], default: null },
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <div class="empty-state" :class="{ 'empty-state--compact': compact }">
    <span v-if="icon" class="empty-state__icon" aria-hidden="true">
      <component :is="icon" :size="compact ? 22 : 28" />
    </span>
    <p class="empty-state__text">{{ message }}</p>
    <div v-if="$slots.default" class="empty-state__action">
      <slot />
    </div>
  </div>
</template>
