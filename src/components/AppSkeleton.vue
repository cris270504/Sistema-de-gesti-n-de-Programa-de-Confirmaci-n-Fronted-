<script setup>
/** Esqueleto de carga reutilizable. 'table' | 'cards' | 'form' | 'lines' (bloque corto dentro de un modal). */
defineProps({
  skeleton: { type: String, default: 'table' },
})
</script>

<template>
  <div class="sk" aria-hidden="true">
    <div v-if="skeleton === 'cards'" class="sk-grid">
      <div v-for="n in 6" :key="n" class="sk-card">
        <div class="sk-line sk-line--title"></div>
        <div class="sk-line"></div>
        <div class="sk-line sk-line--short"></div>
      </div>
    </div>

    <div v-else-if="skeleton === 'lines'" class="sk-lines">
      <div class="sk-line"></div>
      <div class="sk-line"></div>
      <div class="sk-line sk-line--short"></div>
    </div>

    <div v-else-if="skeleton === 'form'" class="sk-card sk-card--form">
      <div v-for="n in 6" :key="n" class="sk-field">
        <div class="sk-line sk-line--label"></div>
        <div class="sk-line sk-line--input"></div>
      </div>
    </div>

    <div v-else class="sk-card sk-card--table">
      <div class="sk-row sk-row--head">
        <div v-for="n in 5" :key="n" class="sk-line sk-line--short"></div>
      </div>
      <div v-for="r in 7" :key="r" class="sk-row">
        <div v-for="c in 5" :key="c" class="sk-line"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sk-lines { display: grid; gap: .6rem; padding: .25rem 0; }
.sk { animation: sk-pulse 1.4s ease-in-out infinite; }
@keyframes sk-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .55 } }

.sk-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  padding: 1rem 1.25rem;
}
.sk-line { height: 12px; border-radius: var(--radius-sm); background: var(--line); }
.sk-line + .sk-line { margin-top: .6rem; }
.sk-line--title { height: 16px; width: 45%; }
.sk-line--short { width: 60%; }
.sk-line--label { height: 10px; width: 30%; }
.sk-line--input { height: 34px; margin-top: .35rem; }

.sk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
.sk-card--form { max-width: 640px; }
.sk-field + .sk-field { margin-top: 1rem; }

.sk-card--table { padding: 0; overflow: hidden; }
.sk-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1rem;
  padding: .85rem 1.25rem;
  border-top: 1px solid var(--line);
}
.sk-row .sk-line { margin: 0; }
.sk-row--head { border-top: 0; background: var(--surface-sunken); }
.sk-row--head .sk-line { background: #d8dee9; }

:root[data-bs-theme="dark"] .sk-card {
  border-color: var(--line);
}
:root[data-bs-theme="dark"] .sk-line { background: var(--line); }
:root[data-bs-theme="dark"] .sk-row { border-top-color: var(--line); }
:root[data-bs-theme="dark"] .sk-row--head { background: var(--surface-sunken); }
:root[data-bs-theme="dark"] .sk-row--head .sk-line { background: var(--line-strong); }
</style>
