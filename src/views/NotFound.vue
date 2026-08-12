<script setup>
import { useRouter } from 'vue-router'
import { CompassIcon } from 'lucide-vue-next'

const router = useRouter()

const volverAlInicio = () => {
  router.push('/')
}
</script>

<template>
  <div class="d-flex flex-column justify-content-center align-items-center vh-100 bg-light text-center px-4">
    <CompassIcon class="text-primary mb-3" :size="56" stroke-width="1.5" aria-hidden="true" />
    <h1 class="display-1 fw-bold text-primary mb-2">404</h1>
    <h2 class="h4 text-secondary mb-3">Página no encontrada</h2>
    <p class="text-muted mb-5">
      La ruta que intentas buscar no existe o ha sido movida.
    </p>
    <button @click="volverAlInicio" class="btn btn-primary px-4 py-2">
      Volver al Inicio
    </button>
  </div>
</template>