<script setup>
import { DatabaseBackup, Download, ShieldCheck } from 'lucide-vue-next'
import AppButton from '@/components/AppButton.vue'
import { useRespaldo } from '@/composables/useRespaldo'

const { trabajando, paso, descargar } = useRespaldo()
</script>

<template>
  <section class="resp surface" aria-labelledby="resp-titulo">
    <span class="resp__ico" aria-hidden="true"><DatabaseBackup :size="22" /></span>
    <div class="resp__txt">
      <h3 id="resp-titulo" class="resp__titulo">Respaldo de los datos de la parroquia</h3>
      <p>
        Descarga un Excel con una hoja por cada tipo de dato: jóvenes (con apoderados, sacramentos y documentos),
        apoderados, grupos, usuarios, reuniones, asistencias y justificaciones, incluidos los jóvenes archivados en
        ciclos anteriores. Sirve como copia de seguridad propia
        o para llevar los datos a otro sistema.
      </p>
      <p class="resp__nota"><ShieldCheck :size="14" aria-hidden="true" /> Contiene datos personales de menores:
        guárdalo en un lugar seguro y no lo compartas. La descarga queda registrada en el historial.</p>
      <p v-if="paso" class="resp__paso" aria-live="polite">{{ paso }}</p>
    </div>
    <AppButton :icon="Download" :loading="trabajando" @click="descargar">
      {{ trabajando ? 'Preparando…' : 'Descargar respaldo' }}
    </AppButton>
  </section>
</template>

<style scoped>
.resp { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 1rem 1.25rem; padding: 1.25rem; }
.resp__ico { display: grid; place-items: center; width: 48px; height: 48px; border-radius: var(--radius-lg); background: var(--accent-soft); color: var(--accent); flex-shrink: 0; }
.resp__txt { flex: 1 1 360px; min-width: 0; }
.resp__titulo { margin: 0 0 0.35rem; font-size: var(--fs-base); font-weight: 700; color: var(--text); }
.resp__txt p { margin: 0 0 0.5rem; font-size: var(--fs-sm); line-height: 1.5; color: var(--text-muted); }
.resp__nota { display: flex; gap: 0.4rem; align-items: flex-start; }
.resp__nota svg { flex-shrink: 0; margin-top: 0.15rem; color: var(--accent); }
.resp__paso { font-weight: 600; color: var(--text) !important; }
.resp :deep(.app-btn) { min-height: 44px; }
</style>
