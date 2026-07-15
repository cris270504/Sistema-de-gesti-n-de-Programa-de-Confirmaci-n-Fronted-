<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const volverAlInicio = () => {
  router.push('/dashboard')
}
</script>

<template>
  <div class="d-flex flex-column justify-content-center align-items-center vh-100 bg-light text-center">
    <h1 class="display-1 fw-bold text-primary">404</h1>
    <h2 class="h4 text-secondary mb-4">Página no encontrada</h2>
    <p class="text-muted mb-5">
      La ruta que intentas buscar no existe o ha sido movida.
    </p>
    <button @click="volverAlInicio" class="btn btn-primary px-4 py-2">
      Volver al Inicio
    </button>
  </div>
</template>