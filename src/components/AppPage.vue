<script setup>
/**
 * Cáscara común de todas las vistas: contenedor con el mismo padding/ancho,
 * cabecera consistente (título + subtítulo + acciones) y estado de carga con
 * esqueleto. Cada vista solo aporta su contenido.
 */
import AppSkeleton from './AppSkeleton.vue'

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  skeleton: { type: String, default: 'table' },
  wide: { type: Boolean, default: true },
})
</script>

<template>
  <main class="app-page" :class="{ 'app-page--narrow': !wide }">
    <header v-if="title || $slots.actions" class="app-page__head">
      <div class="app-page__titles">
        <h1 class="app-page__title">{{ title }}</h1>
        <p v-if="subtitle" class="app-page__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="app-page__actions">
        <slot name="actions" />
      </div>
    </header>

    <slot v-if="!loading" />
    <slot v-else name="skeleton">
      <AppSkeleton :skeleton="skeleton" />
    </slot>
  </main>
</template>

<style scoped>
.app-page {
  padding: 0.75rem;
  width: 100%;
}
@media (min-width: 640px) {
  .app-page { padding: 1rem; }
}
@media (min-width: 768px) {
  .app-page { padding: 1.5rem; }
}
.app-page--narrow { max-width: 820px; }

.app-page__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
@media (min-width: 768px) {
  .app-page__head { gap: 1rem; margin-bottom: 1.25rem; }
}
.app-page__title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}
@media (min-width: 768px) {
  .app-page__title { font-size: 1.25rem; }
}
.app-page__subtitle {
  font-size: .85rem;
  color: #64748b;
  margin: .15rem 0 0;
}
.app-page__actions { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
</style>
