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
  font-size: var(--fs-sm);
  color: var(--text-muted);
  text-align: center;
  line-height: 1.6;
}

.app-credit a {
  color: var(--text-muted);
  text-decoration: none;
}

.app-credit a:hover {
  text-decoration: underline;
}
</style>
