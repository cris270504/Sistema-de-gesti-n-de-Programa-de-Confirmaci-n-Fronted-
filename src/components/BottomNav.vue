<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { UsersRound, ClipboardList, Clipboard, Calendar, Home } from 'lucide-vue-next'

const route = useRoute()
const authStore = useAuthStore()

const grupoId = computed(() => authStore.user?.grupo_ids?.[0] ?? null)

// Accesos rápidos: pensados para el catequista. Máximo 4 (el menú completo
// está en el ☰ de la barra superior).
const items = computed(() => {
  const out = []

  if (grupoId.value) {
    out.push({ label: 'Mi grupo', icon: UsersRound, to: { name: 'miGrupo', params: { id: grupoId.value } } })
    out.push({ label: 'Asistencia', icon: ClipboardList, to: { name: 'asistencias-confirmandos', query: { grupo: grupoId.value } } })
  } else {
    out.push({ label: 'Inicio', icon: Home, to: { name: 'dashboard' } })
  }

  if (authStore.can('ver asistencias')) {
    out.push({ label: 'Justif.', icon: Clipboard, to: { name: 'justificaciones' } })
  }
  if (authStore.can('ver cronograma')) {
    out.push({ label: 'Cronograma', icon: Calendar, to: { name: 'cronograma' } })
  }

  return out.slice(0, 4)
})

const isActive = (to) => route.name === to.name
</script>

<template>
  <nav class="bottomnav" aria-label="Accesos rápidos">
    <RouterLink v-for="it in items" :key="it.label" :to="it.to" class="bottomnav__item"
      :class="{ 'bottomnav__item--on': isActive(it.to) }">
      <component :is="it.icon" :size="20" aria-hidden="true" />
      <span>{{ it.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.bottomnav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  align-items: stretch;
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 16px rgba(15, 23, 42, 0.06);
}

.bottomnav__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 56px;
  padding: 6px 2px;
  border: 0;
  background: transparent;
  color: #64748b;
  font-size: 0.68rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.bottomnav__item span {
  line-height: 1;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bottomnav__item--on {
  color: var(--parroquia-color, #2563eb);
}

@media (min-width: 768px) {
  .bottomnav { display: none; }
}
</style>
