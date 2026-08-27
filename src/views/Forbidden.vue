<script setup>
import { useRouter } from 'vue-router'
import { ShieldAlertIcon } from 'lucide-vue-next'

const router = useRouter()

const volverAlInicio = () => {
  router.push('/')
}
</script>

<template>
  <div class="d-flex flex-column justify-content-center align-items-center vh-100 bg-light text-center px-4">
    <ShieldAlertIcon class="text-danger mb-3" :size="56" stroke-width="1.5" aria-hidden="true" />
    <h1 class="display-1 fw-bold text-danger mb-2">403</h1>
    <h2 class="h4 text-secondary mb-3">No tienes permiso para ver esta página</h2>
    <p class="text-muted mb-5">
      Si crees que deberías tener acceso, contacta a un coordinador o administrador.
    </p>
    <button @click="volverAlInicio" class="btn btn-primary px-4 py-2">
      Volver al Inicio
    </button>
  </div>
</template>
