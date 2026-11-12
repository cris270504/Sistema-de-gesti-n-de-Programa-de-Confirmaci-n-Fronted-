<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import AppCredit from '@/components/AppCredit.vue'

const props = defineProps({
  titulo: { type: String, required: true },
  descripcion: { type: String, required: true },
  actualizado: { type: String, required: true },
})

// Metadatos para buscadores y vistas previas al compartir el enlace.
const creados = []
function meta(attr, clave, valor) {
  let el = document.head.querySelector(`meta[${attr}="${clave}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, clave)
    document.head.appendChild(el)
    creados.push(el)
  }
  el.setAttribute('content', valor)
}
onMounted(() => {
  meta('name', 'description', props.descripcion)
  meta('property', 'og:title', props.titulo)
  meta('property', 'og:description', props.descripcion)
  meta('property', 'og:type', 'article')
})
onBeforeUnmount(() => creados.forEach((el) => el.remove()))
</script>

<template>
  <div class="legal">
    <header class="legal__top">
      <RouterLink :to="{ name: 'login' }" class="legal__volver">
        <ArrowLeft :size="16" aria-hidden="true" /> Volver al sistema
      </RouterLink>
      <nav class="legal__nav" aria-label="Documentos legales">
        <RouterLink :to="{ name: 'privacidad' }">Privacidad</RouterLink>
        <RouterLink :to="{ name: 'terminos' }">Términos</RouterLink>
      </nav>
    </header>

    <main class="legal__main">
      <article class="legal__doc">
        <h1>{{ titulo }}</h1>
        <p class="legal__fecha">Última actualización: {{ actualizado }}</p>
        <slot />
      </article>
    </main>

    <footer class="legal__pie"><AppCredit /></footer>
  </div>
</template>

<style scoped>
.legal { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; background: var(--surface-sunken); }
.legal__top {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
  padding: 0.75rem 1rem; background: var(--surface); border-bottom: 1px solid var(--line);
}
.legal__volver, .legal__nav a {
  display: inline-flex; align-items: center; gap: 0.35rem; min-height: 44px; padding: 0 0.5rem;
  border-radius: var(--radius-md); font-size: var(--fs-sm); font-weight: 600; color: var(--accent); text-decoration: none;
}
.legal__nav { display: flex; gap: 0.25rem; }
.legal__nav a { color: var(--text-muted); }
.legal__nav a.router-link-exact-active { color: var(--accent); background: var(--accent-soft); }
.legal__volver:focus-visible, .legal__nav a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.legal__main { flex: 1; padding: 1.5rem 1rem 2.5rem; }
.legal__doc {
  max-width: 78ch; margin: 0 auto; padding: 1.75rem clamp(1rem, 4vw, 2.5rem);
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-xl);
  color: var(--text); line-height: 1.65; font-size: var(--fs-base);
}
.legal__doc :deep(h1) { margin: 0 0 0.25rem; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.01em; }
.legal__fecha { margin: 0 0 1.5rem; font-size: var(--fs-sm); color: var(--text-muted); }
.legal__doc :deep(h2) { margin: 1.75rem 0 0.5rem; font-size: 1.1rem; font-weight: 700; }
.legal__doc :deep(p), .legal__doc :deep(li) { color: var(--text); }
.legal__doc :deep(ul) { padding-left: 1.25rem; }
.legal__doc :deep(li) { margin-bottom: 0.35rem; }
.legal__doc :deep(a) { color: var(--accent); }
.legal__pie { padding: 1rem; border-top: 1px solid var(--line); background: var(--surface); }
</style>
