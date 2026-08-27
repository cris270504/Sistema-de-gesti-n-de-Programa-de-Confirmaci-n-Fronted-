<script setup>
/**
 * Cáscara común de todas las vistas: contenedor con el mismo padding/ancho,
 * cabecera consistente (título + subtítulo + acciones) y estado de carga con
 * esqueleto. Cada vista solo aporta su contenido.
 */
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  // 'table' | 'cards' | 'form' — forma del esqueleto por defecto
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

    <template v-else>
      <slot name="skeleton">
        <div class="sk" aria-hidden="true">
          <template v-if="skeleton === 'cards'">
            <div class="sk-grid">
              <div v-for="n in 6" :key="n" class="sk-card">
                <div class="sk-line sk-line--title"></div>
                <div class="sk-line"></div>
                <div class="sk-line sk-line--short"></div>
              </div>
            </div>
          </template>
          <template v-else-if="skeleton === 'form'">
            <div class="sk-card sk-card--form">
              <div v-for="n in 6" :key="n" class="sk-field">
                <div class="sk-line sk-line--label"></div>
                <div class="sk-line sk-line--input"></div>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="sk-card sk-card--table">
              <div class="sk-row sk-row--head">
                <div v-for="n in 5" :key="n" class="sk-line sk-line--short"></div>
              </div>
              <div v-for="r in 7" :key="r" class="sk-row">
                <div v-for="c in 5" :key="c" class="sk-line"></div>
              </div>
            </div>
          </template>
        </div>
      </slot>
    </template>
  </main>
</template>

<style scoped>
.app-page {
  padding: 1rem;
  width: 100%;
}
@media (min-width: 768px) {
  .app-page { padding: 1.5rem; }
}
.app-page--narrow { max-width: 820px; }

.app-page__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}
.app-page__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}
.app-page__subtitle {
  font-size: .85rem;
  color: #64748b;
  margin: .15rem 0 0;
}
.app-page__actions { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }

/* ===== Esqueleto ===== */
.sk { animation: sk-pulse 1.4s ease-in-out infinite; }
@keyframes sk-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .55 } }

.sk-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  padding: 1rem 1.25rem;
}
.sk-line {
  height: 12px;
  border-radius: 6px;
  background: #e5e7eb;
}
.sk-line + .sk-line { margin-top: .6rem; }
.sk-line--title { height: 16px; width: 45%; }
.sk-line--short { width: 60%; }
.sk-line--label { height: 10px; width: 30%; }
.sk-line--input { height: 34px; margin-top: .35rem; }

.sk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}
.sk-card--form { max-width: 640px; }
.sk-field + .sk-field { margin-top: 1rem; }

.sk-card--table { padding: 0; overflow: hidden; }
.sk-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1rem;
  padding: .85rem 1.25rem;
  border-top: 1px solid #f1f5f9;
}
.sk-row .sk-line { margin: 0; }
.sk-row--head { border-top: 0; background: #f8fafc; }
.sk-row--head .sk-line { background: #d8dee9; }
</style>
