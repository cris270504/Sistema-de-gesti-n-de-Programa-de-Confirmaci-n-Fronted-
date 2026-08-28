<script setup>
import { RouterView } from 'vue-router'
import { SpeedInsights } from '@vercel/speed-insights/vue';
import { onMounted, onUnmounted } from 'vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { useAuthStore } from '@/stores/auth'

// Evita que Render suspenda el backend por inactividad (cold start ~50s)
const HEALTH_URL = import.meta.env.MODE === 'production'
  ? 'https://sistema-de-gestion-de-programa-de.onrender.com/api/health'
  : '/api/health'
const HEARTBEAT_INTERVAL_MS = 13 * 60 * 1000 // 13 minutos

let heartbeatId = null

const pingHealth = () => {
  fetch(HEALTH_URL, { method: 'GET', cache: 'no-store' }).catch(() => {})
}

onMounted(() => {
  heartbeatId = setInterval(pingHealth, HEARTBEAT_INTERVAL_MS)

  // Al abrir la app con sesión activa, sincroniza datos y permisos del usuario
  // con el backend (evita quedarse con permisos viejos de localStorage).
  const auth = useAuthStore()
  if (auth.token) auth.refrescarUsuario()
})

onUnmounted(() => {
  clearInterval(heartbeatId)
})
</script>

<template>
  <RouterView />
  <LoadingOverlay />
  <SpeedInsights />
</template>

<style scoped>

</style>
