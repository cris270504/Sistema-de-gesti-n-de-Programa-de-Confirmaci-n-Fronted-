import pluginVue from 'eslint-plugin-vue'

// Config mínima para un proyecto que nunca tuvo lint: usamos el set "essential"
// de eslint-plugin-vue (atrapa bugs reales — variables sin usar, keys duplicadas,
// mutaciones de props, etc.) en vez de "recommended"/"strongly-recommended", que
// son mucho más estrictos con estilo (orden de atributos, nombres multi-palabra)
// y generarían cientos de warnings de estilo en un codebase existente sin
// aportar nada de valor real hoy. Se puede subir el nivel más adelante.
export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.claude/**'],
  },
  ...pluginVue.configs['flat/essential'],
  {
    rules: {
      // El proyecto ya tiene archivos como profile.vue, Login.vue, etc. — no vale
      // la pena forzar nombres multi-palabra en un codebase existente.
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'warn',
    },
  },
]
