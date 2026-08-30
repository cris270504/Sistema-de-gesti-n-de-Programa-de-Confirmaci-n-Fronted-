<script setup>
import { RouterView } from 'vue-router'
import { SpeedInsights } from '@vercel/speed-insights/vue';
import { onMounted, onUnmounted } from 'vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'

// Evita que Render suspenda el backend por inactividad (cold start ~50s)
const HEALTH_URL = import.meta.env.MODE === 'production'
  ? 'https://sistema-de-gestion-de-programa-de.onrender.com/api/health'
  : '/api/health'
const HEARTBEAT_INTERVAL_MS = 13 * 60 * 1000 // 13 minutos

let heartbeatId = null

const pingHealth = () => {
  fetch(HEALTH_URL, { method: 'GET', cache: 'no-store' }).catch(() => {})
}

onMounted(async () => {
  heartbeatId = setInterval(pingHealth, HEARTBEAT_INTERVAL_MS)

  // Fase 1 migración Supabase: mantener el token del store sincronizado con la
  // sesión de supabase-js (refresco automático, cierre de sesión remoto).
  const auth = useAuthStore()
  auth.initAuthListener()

  // Al abrir la app con sesión de Supabase activa, sincroniza datos y permisos
  // del usuario con el backend (evita quedarse con permisos viejos de localStorage).
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    auth.token = data.session.access_token
    await auth.refrescarUsuario()
  } else if (auth.token) {
    // Espejo viejo sin sesión de Supabase: limpiar.
    auth.logoutLocal()
  }
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
