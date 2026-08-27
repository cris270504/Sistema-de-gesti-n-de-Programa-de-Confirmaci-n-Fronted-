<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useParroquiaStore, CONFIG_DEFAULTS } from '@/stores/parroquia'
import { Save, RotateCcw, Image as ImageIcon } from 'lucide-vue-next'

const parroquiaStore = useParroquiaStore()

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

const UMBRALES = [
  ['alto_injustificadas', 'Faltas injustificadas acumuladas', 'ALTO'],
  ['alto_racha', 'Faltas injustificadas seguidas (racha activa)', 'ALTO'],
  ['alto_seguidas_historicas', 'Faltas seguidas alguna vez en el pasado', 'ALTO'],
  ['medio_justificadas', 'Faltas justificadas acumuladas', 'MEDIO'],
  ['bajo_tardanzas_seguidas', 'Tardanzas en las últimas N reuniones', 'BAJO'],
]
const RIESGO_CLS = {
  ALTO: 'bg-rose-100 text-rose-700',
  MEDIO: 'bg-amber-100 text-amber-700',
  BAJO: 'bg-sky-100 text-sky-700',
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl p-4 pb-16">
    <div class="mb-5 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Configuración de la parroquia</h1>
        <p class="text-sm text-slate-500">Ajustes que aplican a todo el sistema.</p>
      </div>
      <button type="button" class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        :disabled="parroquiaStore.loading || saving" @click="cargarDesdeStore">
        <RotateCcw class="h-3.5 w-3.5" /> Descartar
      </button>
    </div>

    <form class="space-y-4" @submit.prevent="guardar">
      <!-- Identidad -->
      <section class="rounded-xl border bg-white p-5">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Identidad</h2>

        <div class="flex items-center gap-4">
          <div class="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border bg-slate-50">
            <img v-if="form.branding.logo_url" :src="form.branding.logo_url" alt="" class="h-full w-full object-contain" />
            <ImageIcon v-else class="h-5 w-5 text-slate-300" />
          </div>
          <label class="min-w-0 flex-1 text-sm">
            <span class="text-slate-600">Nombre visible</span>
            <input v-model="form.branding.nombre_publico" type="text" maxlength="120"
              placeholder="Parroquia Sagrado Corazón de Jesús"
              class="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm" />
          </label>
          <label class="shrink-0 text-sm">
            <span class="block text-slate-600">Color</span>
            <input v-model="form.branding.color_primario" type="color"
              class="mt-1 h-9 w-14 cursor-pointer rounded-md border border-slate-300 p-0.5" />
          </label>
        </div>

        <label class="mt-3 block text-sm">
          <span class="text-slate-600">URL del logo</span>
          <input v-model="form.branding.logo_url" type="url" maxlength="500" placeholder="https://…/logo.png"
            class="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm" />
          <span class="text-xs text-slate-400">Súbelo a un hosting de imágenes y pega el enlace.</span>
        </label>
      </section>

      <!-- Programa -->
      <section class="rounded-xl border bg-white p-5">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Programa</h2>
        <div class="flex flex-wrap gap-x-8 gap-y-3">
          <label class="text-sm">
            <span class="block text-slate-600">Inicio</span>
            <input v-model="form.programa_inicio" type="date"
              class="mt-1 w-44 rounded-md border-slate-300 text-sm shadow-sm" />
          </label>
          <label class="text-sm">
            <span class="block text-slate-600">Cierre <span class="text-slate-400">(opcional)</span></span>
            <input v-model="form.programa_fin" type="date" :min="form.programa_inicio || undefined"
              class="mt-1 w-44 rounded-md border-slate-300 text-sm shadow-sm" />
          </label>
        </div>
      </section>

      <!-- Reuniones y grupos -->
      <section class="rounded-xl border bg-white p-5">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Reuniones y grupos</h2>

        <div class="mb-4">
          <span class="text-sm text-slate-600">Tipos de reunión activos</span>
          <div class="mt-1.5 flex flex-wrap gap-2">
            <label v-for="t in TIPOS_REUNION" :key="t"
              class="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition"
              :class="form.tipos_reunion.includes(t) ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500'">
              <input type="checkbox" :value="t" v-model="form.tipos_reunion" class="rounded" />
              {{ t }}
            </label>
          </div>
          <p v-if="form.tipos_reunion.length === 0" class="mt-1 text-xs text-rose-500">Debe quedar al menos uno.</p>
        </div>

        <label class="block text-sm">
          <span class="text-slate-600">Procedencias de grupo</span>
          <input v-model="form.procedencias" type="text"
            class="mt-1 w-full max-w-sm rounded-md border-slate-300 text-sm shadow-sm" />
          <span class="text-xs text-slate-400">Separadas por coma. Ej: <code>sede, caserio</code></span>
        </label>
      </section>

      <!-- Alertas -->
      <section class="rounded-xl border bg-white p-5">
        <h2 class="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Alertas del dashboard</h2>
        <p class="mb-3 text-xs text-slate-400">Un confirmando entra en la alerta al alcanzar estos valores.</p>

        <label class="flex items-center justify-between gap-4 border-b py-2.5 text-sm">
          <span class="text-slate-600">Días para poder justificar una falta</span>
          <input v-model="form.dias_ventana_justificacion" type="number" min="1" max="365"
            class="w-20 rounded-md border-slate-300 text-center text-sm shadow-sm" />
        </label>

        <label v-for="[key, label, riesgo] in UMBRALES" :key="key"
          class="flex items-center justify-between gap-4 border-b py-2.5 text-sm last:border-0">
          <span class="flex items-center gap-2 text-slate-600">
            <span class="rounded px-1.5 py-0.5 text-[10px] font-bold" :class="RIESGO_CLS[riesgo]">{{ riesgo }}</span>
            {{ label }}
          </span>
          <input v-model="form.umbrales_alerta[key]" type="number" min="1" max="99"
            class="w-16 rounded-md border-slate-300 text-center text-sm shadow-sm" />
        </label>
      </section>

      <div class="sticky bottom-0 -mx-4 flex justify-end border-t bg-slate-50/80 px-4 py-3 backdrop-blur">
        <button type="submit"
          class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          :disabled="saving || form.tipos_reunion.length === 0">
          <Save class="h-4 w-4" />
          {{ saving ? 'Guardando…' : 'Guardar configuración' }}
        </button>
      </div>
    </form>
  </div>
</template>
