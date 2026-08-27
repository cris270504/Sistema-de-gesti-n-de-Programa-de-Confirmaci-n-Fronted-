<script setup>
// Skeleton genérico para el <tbody> de una tabla mientras carga: usa las
// utilidades .placeholder/.placeholder-glow de Bootstrap (el mismo patrón que
// ya usa PerfilConfirmandoModal.vue), pero como filas de tabla reutilizables
// en vez de un spinner centrado que hace desaparecer el <thead>. Al mantener
// el encabezado visible, el usuario ve la estructura de la tabla de inmediato.
defineProps({
  columns: { type: Number, default: 5 },
  rows: { type: Number, default: 6 },
})
</script>

<template>
  <tbody class="placeholder-glow" role="status" aria-live="polite" aria-label="Cargando datos">
    <tr v-for="row in rows" :key="row">
      <td v-for="col in columns" :key="col" class="py-3">
        <span class="placeholder col-8 rounded bg-secondary opacity-25" style="height: 14px; display: block;"></span>
      </td>
    </tr>
  </tbody>
</template>
