<script setup>
import { ref } from 'vue'
import { Wrench, LogOut, RefreshCw } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useSystemStatusStore } from '@/stores/systemStatus'

const auth = useAuthStore()
const systemStatus = useSystemStatusStore()

const reintentando = ref(false)
const reintentar = async () => {
  if (reintentando.value) return
  reintentando.value = true
  try {
    await systemStatus.fetchStatus()
  } finally {
    // Piso mínimo visible: si la consulta responde en 50ms el spin ni se nota,
    // y da la sensación de que el botón no hizo nada.
    setTimeout(() => { reintentando.value = false }, 400)
  }
}
</script>

<template>
  <div class="d-flex flex-column justify-content-center align-items-center vh-100 bg-light text-center px-4">
    <Wrench class="text-warning mb-3" :size="56" stroke-width="1.5" aria-hidden="true" />
    <h1 class="h2 fw-bold text-dark mb-2">Sistema en mantenimiento</h1>
    <p class="text-muted mb-1" style="max-width: 420px;">
      {{ systemStatus.mensaje || 'Estamos haciendo tareas de mantenimiento. Volvé a intentarlo en unos minutos.' }}
    </p>
    <p class="text-muted small mb-5">Tu sesión sigue activa: no hace falta que vuelvas a iniciar sesión.</p>

    <div class="d-flex flex-column align-items-center gap-3">
      <button @click="reintentar" class="btn btn-warning px-4 py-2 d-inline-flex align-items-center justify-content-center gap-2"
        style="min-width: 180px;" :disabled="reintentando">
        <RefreshCw :size="16" :class="{ 'icon-spin': reintentando }" />
        {{ reintentando ? 'Comprobando…' : 'Reintentar' }}
      </button>
      <button @click="auth.logout()" class="btn btn-link text-secondary text-decoration-none d-inline-flex align-items-center gap-2">
        <LogOut :size="15" />Cerrar sesión
      </button>
    </div>
  </div>
</template>

<style scoped>
.icon-spin {
  animation: icon-spin-rotate 0.8s linear infinite;
}
@keyframes icon-spin-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
