<script setup>
const anio = new Date().getFullYear()
</script>

<template>
  <p class="app-credit">
    Sistema desarrollado por Cristopher Andre Carrasco Crisanto · © {{ anio }} ·
    Contacto: <a href="mailto:cristopher270504@gmail.com">cristopher270504@gmail.com</a>
  </p>
</template>

<style scoped>
.app-credit {
  margin: 0;
  font-size: 0.8rem;
  color: #94a3b8;
  text-align: center;
  line-height: 1.6;
}

.app-credit a {
  color: #64748b;
  text-decoration: none;
}

.app-credit a:hover {
  text-decoration: underline;
}
</style>
