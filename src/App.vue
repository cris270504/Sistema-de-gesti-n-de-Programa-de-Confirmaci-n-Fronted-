<script setup>
import { RouterView } from 'vue-router'
import { SpeedInsights } from '@vercel/speed-insights/vue';
import { onMounted, onUnmounted } from 'vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import ToastStack from '@/components/ToastStack.vue'
import { useAuthStore } from '@/stores/auth'
import { useParroquiaStore } from '@/stores/parroquia'
import { useSystemStatusStore } from '@/stores/systemStatus'
import { supabase } from '@/lib/supabase'

// El keep-alive de Supabase (evitar que el proyecto del plan Free se pause por
// inactividad) lo hace un pinger externo dedicado (ver
// docs/PLAN-MIGRACION-SUPABASE.md, checklist de cutover). Antes también se
// pingueaba desde acá cada 13 min, duplicado: con N pestañas abiertas eran N
// pings redundantes por cliente para un trabajo que ya cubre el pinger.

// Al volver a la pestaña: traer la config de la parroquia si cambió y revalidar
// la sesión (si el proveedor desactivó la parroquia, cierra sesión con aviso).
// Ambos se auto-limitan a un chequeo cada 30s.
const onVisible = () => {
  if (document.visibilityState !== 'visible') return
  useParroquiaStore().refreshIfStale()
  useAuthStore().refrescarUsuario()
}

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisible)

  // Fase 1 migración Supabase: mantener el token del store sincronizado con la
  // sesión de supabase-js (refresco automático, cierre de sesión remoto).
  const auth = useAuthStore()
  auth.initAuthListener()

  const systemStatus = useSystemStatusStore()

  // Al abrir la app con sesión de Supabase activa, sincroniza datos y permisos
  // del usuario con el backend (evita quedarse con permisos viejos de localStorage).
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    auth.token = data.session.access_token
    await Promise.all([auth.refrescarUsuario({ force: true }), systemStatus.fetchStatus()])
  } else if (auth.token) {
    // Espejo viejo sin sesión de Supabase: limpiar.
    auth.logoutLocal()
  }

  // Modo mantenimiento: suscripción en vivo (para que un cambio del proveedor
  // bloquee/libere sin esperar a la próxima navegación). Se arma DESPUÉS de
  // que el token esté sincronizado: el canal de Realtime autoriza con la
  // sesión vigente en ese momento, y si se suscribe antes de tener token
  // puede quedar autorizado como anónimo.
  systemStatus.iniciarEscuchaEnVivo()
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <RouterView />
  <LoadingOverlay />
  <ToastStack />
  <SpeedInsights />
</template>

<style scoped>

</style>
