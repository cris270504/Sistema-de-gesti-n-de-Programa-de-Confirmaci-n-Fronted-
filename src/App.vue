<script setup>
import { RouterView } from 'vue-router'
import { SpeedInsights } from '@vercel/speed-insights/vue';
import { onMounted, onUnmounted } from 'vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { useAuthStore } from '@/stores/auth'
import { useParroquiaStore } from '@/stores/parroquia'
import { supabase } from '@/lib/supabase'

// Heartbeat a Supabase mientras alguien tiene la app abierta: mantiene el
// proyecto (plan Free) "activo" y evita que se pause por inactividad. NO cubre
// el caso de que nadie abra la app en ~7 días — para eso hay un pinger externo
// (ver docs/PLAN-MIGRACION-SUPABASE.md, checklist de cutover).
const HEALTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`
const HEARTBEAT_INTERVAL_MS = 13 * 60 * 1000 // 13 minutos

let heartbeatId = null

const pingHealth = () => {
  fetch(HEALTH_URL, { method: 'GET', cache: 'no-store' }).catch(() => {})
}

// Al volver a la pestaña: traer la config de la parroquia si cambió y revalidar
// la sesión (si el proveedor desactivó la parroquia, cierra sesión con aviso).
// Ambos se auto-limitan a un chequeo cada 30s.
const onVisible = () => {
  if (document.visibilityState !== 'visible') return
  useParroquiaStore().refreshIfStale()
  useAuthStore().refrescarUsuario()
}

onMounted(async () => {
  heartbeatId = setInterval(pingHealth, HEARTBEAT_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisible)

  // Fase 1 migración Supabase: mantener el token del store sincronizado con la
  // sesión de supabase-js (refresco automático, cierre de sesión remoto).
  const auth = useAuthStore()
  auth.initAuthListener()

  // Al abrir la app con sesión de Supabase activa, sincroniza datos y permisos
  // del usuario con el backend (evita quedarse con permisos viejos de localStorage).
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    auth.token = data.session.access_token
    await auth.refrescarUsuario({ force: true })
  } else if (auth.token) {
    // Espejo viejo sin sesión de Supabase: limpiar.
    auth.logoutLocal()
  }
})

onUnmounted(() => {
  clearInterval(heartbeatId)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <RouterView />
  <LoadingOverlay />
  <SpeedInsights />
</template>

<style scoped>

</style>
