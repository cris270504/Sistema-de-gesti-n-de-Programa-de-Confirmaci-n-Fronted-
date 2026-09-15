<script setup>
import { Wrench, LogOut, RefreshCw } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useSystemStatusStore } from '@/stores/systemStatus'

const auth = useAuthStore()
const systemStatus = useSystemStatusStore()
</script>

<template>
  <div class="d-flex flex-column justify-content-center align-items-center vh-100 bg-light text-center px-4">
    <Wrench class="text-warning mb-3" :size="56" stroke-width="1.5" aria-hidden="true" />
    <h1 class="h2 fw-bold text-dark mb-2">Sistema en mantenimiento</h1>
    <p class="text-muted mb-1" style="max-width: 420px;">
      {{ systemStatus.mensaje || 'Estamos haciendo tareas de mantenimiento. Volvé a intentarlo en unos minutos.' }}
    </p>
    <p class="text-muted small mb-5">Tu sesión sigue activa: no hace falta que vuelvas a iniciar sesión.</p>
    <div class="d-flex gap-2">
      <button @click="systemStatus.fetchStatus()" class="btn btn-outline-secondary px-4 py-2">
        <RefreshCw :size="16" class="me-2" />Reintentar
      </button>
      <button @click="auth.logout()" class="btn btn-light px-4 py-2">
        <LogOut :size="16" class="me-2" />Cerrar sesión
      </button>
    </div>
  </div>
</template>
