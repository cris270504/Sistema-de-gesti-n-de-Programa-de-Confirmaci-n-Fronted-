<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useParroquiaStore, CONFIG_DEFAULTS } from '@/stores/parroquia'
import { Save, RotateCcw, Image as ImageIcon } from 'lucide-vue-next'
import AppPage from '@/components/AppPage.vue'

const parroquiaStore = useParroquiaStore()

const TIPOS_REUNION = ['Confirmandos', 'Catequistas', 'Apoderados']
const saving = ref(false)
const form = reactive(estructuraVacia())

const ROLES_INTERNOS = [
  ['super-admin', 'Administrador'],
  ['coordinador', 'Coordinador'],
  ['catequista', 'Catequista'],
]

function estructuraVacia() {
  return {
    programa_inicio: '',
    programa_fin: '',
    dias_ventana_justificacion: 21,
    tipos_reunion: [],
    umbrales_alerta: { ...CONFIG_DEFAULTS.umbrales_alerta },
    procedencias: '',
    branding: { nombre_publico: '', logo_url: '', color_primario: '#2563eb' },
    roles_labels: {},
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
  form.roles_labels = { ...(c.roles_labels ?? {}) }
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
    roles_labels: Object.fromEntries(
      Object.entries(form.roles_labels).filter(([, v]) => (v || '').trim()),
    ),
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
</script>

<template>
  <AppPage title="Configuración" subtitle="Ajustes que aplican a toda la parroquia" :loading="parroquiaStore.loading" skeleton="form">
    <template #actions>
      <button type="button" class="cfg__reset" :disabled="saving" @click="cargarDesdeStore">
        <RotateCcw :size="14" /> Descartar
      </button>
    </template>

    <form class="cfg__form" @submit.prevent="guardar">
      <!-- Identidad -->
      <section class="card">
        <h3 class="card__title">Identidad</h3>
        <div class="card__body">
          <div class="row-identidad">
            <div class="logo-box">
              <img v-if="form.branding.logo_url" :src="form.branding.logo_url" alt="" />
              <ImageIcon v-else :size="20" class="text-slate-300" />
            </div>
            <div class="field grow">
              <label>Nombre visible</label>
              <input v-model="form.branding.nombre_publico" type="text" maxlength="120"
                placeholder="Parroquia Sagrado Corazón de Jesús" class="inp" />
            </div>
            <div class="field">
              <label>Color</label>
              <input v-model="form.branding.color_primario" type="color" class="inp-color" />
            </div>
          </div>
          <div class="field">
            <label>URL del logo</label>
            <input v-model="form.branding.logo_url" type="url" maxlength="500" placeholder="https://…/logo.png" class="inp" />
            <small>Súbelo a un hosting de imágenes y pega el enlace.</small>
          </div>
        </div>
      </section>

      <!-- Programa -->
      <section class="card">
        <h3 class="card__title">Programa</h3>
        <div class="card__body row">
          <div class="field">
            <label>Inicio</label>
            <input v-model="form.programa_inicio" type="date" class="inp inp--date" />
          </div>
          <div class="field">
            <label>Cierre <span class="opt">(opcional)</span></label>
            <input v-model="form.programa_fin" type="date" :min="form.programa_inicio || undefined" class="inp inp--date" />
          </div>
        </div>
      </section>

      <!-- Reuniones y grupos -->
      <section class="card">
        <h3 class="card__title">Reuniones y grupos</h3>
        <div class="card__body">
          <div class="field">
            <label>Tipos de reunión activos</label>
            <div class="chips">
              <label v-for="t in TIPOS_REUNION" :key="t" class="chip" :class="{ 'chip--on': form.tipos_reunion.includes(t) }">
                <input type="checkbox" :value="t" v-model="form.tipos_reunion" />
                {{ t }}
              </label>
            </div>
            <small v-if="form.tipos_reunion.length === 0" class="err">Debe quedar al menos uno.</small>
          </div>
          <div class="field">
            <label>Procedencias de grupo</label>
            <input v-model="form.procedencias" type="text" class="inp inp--md" />
            <small>Separadas por coma. Ej: <code>sede, caserio</code></small>
          </div>
        </div>
      </section>

      <!-- Roles -->
      <section class="card">
        <h3 class="card__title">Nombres de los roles</h3>
        <p class="card__hint">Cómo se muestran en la interfaz (no cambia los permisos).</p>
        <div class="card__body">
          <div v-for="[rol, ph] in ROLES_INTERNOS" :key="rol" class="field">
            <label>{{ ph }}</label>
            <input v-model="form.roles_labels[rol]" type="text" maxlength="60" :placeholder="ph" class="inp" />
          </div>
        </div>
      </section>

      <!-- Alertas -->
      <section class="card card--wide">
        <h3 class="card__title">Alertas del dashboard</h3>
        <p class="card__hint">Un confirmando entra en la alerta al alcanzar estos valores.</p>
        <div class="umbral-grid">
          <div class="umbral">
            <span>Días para poder justificar una falta</span>
            <input v-model="form.dias_ventana_justificacion" type="number" min="1" max="365" class="inp-num" />
          </div>
          <div v-for="[key, label, riesgo] in UMBRALES" :key="key" class="umbral">
            <span><i class="tag" :class="'tag--' + riesgo.toLowerCase()">{{ riesgo }}</i> {{ label }}</span>
            <input v-model="form.umbrales_alerta[key]" type="number" min="1" max="99" class="inp-num" />
          </div>
        </div>
      </section>

      <div class="cfg__bar">
        <button type="submit" class="btn-primary" :disabled="saving || form.tipos_reunion.length === 0">
          <Save :size="16" /> {{ saving ? 'Guardando…' : 'Guardar configuración' }}
        </button>
      </div>
    </form>
  </AppPage>
</template>

<style scoped>
.cfg__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
.cfg__reset {
  display: inline-flex; align-items: center; gap: .4rem;
  border: 1px solid #e2e8f0; border-radius: 8px; padding: .4rem .7rem;
  font-size: .8rem; color: #475569; background: #fff;
}
.cfg__reset:hover { background: #f8fafc; }

/* Grilla que aprovecha todo el ancho: 3 tarjetas por fila en desktop, 2, luego 1. */
.cfg__form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 1rem;
  align-items: start;
}
.card--wide { grid-column: 1 / -1; }
.cfg__bar { grid-column: 1 / -1; }

.card { border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; padding: 1.1rem 1.25rem; }
.card__title { font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #64748b; margin: 0 0 .85rem; }
.card__hint { font-size: .78rem; color: #94a3b8; margin: -.6rem 0 .85rem; }
.card__body { display: flex; flex-direction: column; gap: .85rem; }
.card__body.row { flex-direction: row; flex-wrap: wrap; gap: .85rem 2rem; }

.field { display: flex; flex-direction: column; min-width: 0; }
.field.grow { flex: 1; }
.field label { font-size: .82rem; color: #475569; margin-bottom: .3rem; }
.field small { font-size: .72rem; color: #94a3b8; margin-top: .25rem; }
.field small.err, .err { font-size: .72rem; color: #e11d48; margin-top: .25rem; }
.opt { color: #94a3b8; }

.inp {
  width: 100%; border: 1px solid #cbd5e1; border-radius: 8px;
  padding: .45rem .6rem; font-size: .88rem; background: #fff;
}
.inp:focus { outline: 2px solid #c7d2fe; outline-offset: -1px; border-color: #6366f1; }
.inp--md { max-width: 340px; }
.inp--date { width: 176px; }
.inp-color { width: 56px; height: 36px; padding: 2px; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer; }
.inp-num { width: 68px; border: 1px solid #cbd5e1; border-radius: 8px; padding: .4rem; text-align: center; font-size: .88rem; }

.row-identidad { display: flex; align-items: flex-end; gap: 1rem; }
@media (max-width: 560px) { .row-identidad { flex-wrap: wrap; } .field.grow { flex-basis: 100%; } }
.logo-box {
  width: 56px; height: 56px; flex-shrink: 0;
  display: grid; place-items: center; overflow: hidden;
  border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc;
}
.logo-box img { width: 100%; height: 100%; object-fit: contain; }

.chips { display: flex; flex-wrap: wrap; gap: .5rem; }
.chip {
  display: inline-flex; align-items: center; gap: .45rem; margin: 0;
  border: 1px solid #e2e8f0; border-radius: 9px; padding: .4rem .7rem;
  font-size: .84rem; color: #64748b; cursor: pointer;
}
.chip--on { border-color: #c7d2fe; background: #eef2ff; color: #3730a3; }

/* En pantallas anchas los umbrales van en 2-3 columnas para no dejar espacio muerto. */
.umbral-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 0 2rem;
}
.umbral {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: .55rem 0; border-bottom: 1px solid #f1f5f9; font-size: .86rem; color: #475569;
}
.umbral > span { display: inline-flex; align-items: center; gap: .5rem; }
.tag { font-style: normal; font-size: .62rem; font-weight: 700; border-radius: 4px; padding: .1rem .35rem; }
.tag--alto { background: #ffe4e6; color: #be123c; }
.tag--medio { background: #fef3c7; color: #b45309; }
.tag--bajo { background: #e0f2fe; color: #0369a1; }

.cfg__bar { position: sticky; bottom: 0; padding: .8rem 0; margin-top: .25rem; display: flex; justify-content: flex-end; background: linear-gradient(transparent, #f9fafb 40%); }
.cfg__bar .btn-primary { display: inline-flex; align-items: center; gap: .5rem; }
</style>
