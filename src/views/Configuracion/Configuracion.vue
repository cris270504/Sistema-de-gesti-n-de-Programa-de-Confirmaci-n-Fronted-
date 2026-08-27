<script setup>
import { ref, reactive, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useParroquiaStore, CONFIG_DEFAULTS } from '@/stores/parroquia'
import { Save, RotateCcw } from 'lucide-vue-next'

const parroquiaStore = useParroquiaStore()
const { loading } = storeToRefs(parroquiaStore)

const TIPOS_REUNION = ['Confirmandos', 'Catequistas', 'Apoderados']
const saving = ref(false)

const form = reactive(estructuraVacia())

function estructuraVacia() {
  return {
    programa_inicio: '',
    programa_fin: '',
    dias_ventana_justificacion: 21,
    tipos_reunion: [],
    umbrales_alerta: { ...CONFIG_DEFAULTS.umbrales_alerta },
    procedencias: '',
    branding: { nombre_publico: '', logo_url: '', color_primario: '#2563eb' },
  }
}

function cargarDesdeStore() {
  const c = parroquiaStore.configuracion
  form.programa_inicio = c.programa_inicio ?? ''
  form.programa_fin = c.programa_fin ?? ''
  form.dias_ventana_justificacion = c.dias_ventana_justificacion ?? 21
  form.tipos_reunion = [...(c.tipos_reunion ?? CONFIG_DEFAULTS.tipos_reunion)]
  form.umbrales_alerta = { ...CONFIG_DEFAULTS.umbrales_alerta, ...(c.umbrales_alerta ?? {}) }
  form.procedencias = (c.procedencias ?? CONFIG_DEFAULTS.procedencias).join(', ')
  form.branding = {
    nombre_publico: c.branding?.nombre_publico ?? '',
    logo_url: c.branding?.logo_url ?? '',
    color_primario: c.branding?.color_primario ?? '#2563eb',
  }
}

onMounted(async () => {
  await parroquiaStore.fetchConfiguracion()
  cargarDesdeStore()
})

async function guardar() {
  saving.value = true
  const payload = {
    programa_inicio: form.programa_inicio || null,
    programa_fin: form.programa_fin || null,
    dias_ventana_justificacion: Number(form.dias_ventana_justificacion),
    tipos_reunion: form.tipos_reunion,
    umbrales_alerta: Object.fromEntries(
      Object.entries(form.umbrales_alerta).map(([k, v]) => [k, Number(v)]),
    ),
    procedencias: form.procedencias.split(',').map(s => s.trim()).filter(Boolean),
    branding: {
      nombre_publico: form.branding.nombre_publico || null,
      logo_url: form.branding.logo_url || null,
      color_primario: form.branding.color_primario,
    },
  }
  await parroquiaStore.save(payload)
  cargarDesdeStore()
  saving.value = false
}

const UMBRAL_LABELS = {
  alto_injustificadas: 'Faltas injustificadas acumuladas → riesgo ALTO',
  alto_racha: 'Faltas injustificadas seguidas (racha activa) → ALTO',
  alto_seguidas_historicas: 'Faltas seguidas alguna vez en el pasado → ALTO',
  medio_justificadas: 'Faltas justificadas acumuladas → riesgo MEDIO',
  bajo_tardanzas_seguidas: 'Tardanzas en las últimas N reuniones → riesgo BAJO',
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-slate-800">Configuración de la parroquia</h1>
      <button class="btn btn-sm btn-light border" :disabled="loading || saving" @click="cargarDesdeStore" title="Descartar cambios">
        <RotateCcw class="h-4 w-4" />
      </button>
    </div>

    <form class="space-y-6" @submit.prevent="guardar">
      <!-- Branding -->
      <section class="bg-white rounded-xl border p-5 space-y-4">
        <h2 class="font-semibold text-slate-700">Identidad</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="text-slate-600">Nombre visible</span>
            <input v-model="form.branding.nombre_publico" type="text" maxlength="120"
              placeholder="Parroquia Sagrado Corazón de Jesús"
              class="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm" />
          </label>
          <label class="block text-sm">
            <span class="text-slate-600">Color primario</span>
            <input v-model="form.branding.color_primario" type="color"
              class="mt-1 h-9 w-full rounded-md border-gray-300" />
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="text-slate-600">URL del logo</span>
            <input v-model="form.branding.logo_url" type="url" maxlength="500"
              placeholder="https://…/logo.png"
              class="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm" />
            <span class="text-xs text-slate-400">Súbelo a un hosting de imágenes y pega el enlace. (La subida directa llegará más adelante.)</span>
          </label>
        </div>
      </section>

      <!-- Programa -->
      <section class="bg-white rounded-xl border p-5 space-y-4">
        <h2 class="font-semibold text-slate-700">Programa</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="text-slate-600">Inicio</span>
            <input v-model="form.programa_inicio" type="date"
              class="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm" />
          </label>
          <label class="block text-sm">
            <span class="text-slate-600">Cierre <span class="text-slate-400">(opcional)</span></span>
            <input v-model="form.programa_fin" type="date" :min="form.programa_inicio || undefined"
              class="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm" />
          </label>
        </div>
      </section>

      <!-- Tipos de reunión -->
      <section class="bg-white rounded-xl border p-5 space-y-3">
        <h2 class="font-semibold text-slate-700">Tipos de reunión activos</h2>
        <label v-for="t in TIPOS_REUNION" :key="t" class="flex items-center gap-2 text-sm">
          <input type="checkbox" :value="t" v-model="form.tipos_reunion" class="rounded" />
          {{ t }}
        </label>
        <p v-if="form.tipos_reunion.length === 0" class="text-xs text-red-500">Debe quedar al menos uno.</p>
      </section>

      <!-- Procedencias -->
      <section class="bg-white rounded-xl border p-5 space-y-2">
        <h2 class="font-semibold text-slate-700">Procedencias de grupo</h2>
        <input v-model="form.procedencias" type="text"
          class="w-full rounded-md border-gray-300 shadow-sm text-sm" />
        <p class="text-xs text-slate-400">Separadas por coma. Ej: <code>sede, caserio</code></p>
      </section>

      <!-- Alertas -->
      <section class="bg-white rounded-xl border p-5 space-y-4">
        <h2 class="font-semibold text-slate-700">Umbrales de alerta del dashboard</h2>
        <label class="block text-sm">
          <span class="text-slate-600">Días para poder justificar una falta</span>
          <input v-model="form.dias_ventana_justificacion" type="number" min="1" max="365"
            class="mt-1 w-32 rounded-md border-gray-300 shadow-sm text-sm" />
        </label>
        <div v-for="(label, key) in UMBRAL_LABELS" :key="key" class="flex items-center justify-between gap-4 text-sm">
          <span class="text-slate-600">{{ label }}</span>
          <input v-model="form.umbrales_alerta[key]" type="number" min="1" max="99"
            class="w-20 rounded-md border-gray-300 shadow-sm text-sm" />
        </div>
      </section>

      <div class="flex justify-end">
        <button type="submit" class="btn btn-primary inline-flex items-center gap-2"
          :disabled="saving || form.tipos_reunion.length === 0">
          <Save class="h-4 w-4" />
          {{ saving ? 'Guardando…' : 'Guardar configuración' }}
        </button>
      </div>
    </form>
  </div>
</template>
