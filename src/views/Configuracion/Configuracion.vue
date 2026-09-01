<script setup>
import { ref, reactive, onMounted } from 'vue'
import {
  useParroquiaStore, CONFIG_DEFAULTS,
  DASHBOARD_KPIS, DASHBOARD_PANELES, MODULOS_OCULTABLES, CONFIRMANDOS_ESTADOS, CONFIRMANDO_CAMPOS,
} from '@/stores/parroquia'
import {
  Save, RotateCcw, Image as ImageIcon,
  Palette, CalendarRange, Users, Tag, LayoutDashboard, TriangleAlert, Check, PanelLeft, ListFilter, UserCheck,
} from 'lucide-vue-next'
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

// Etiquetas para los toggles del panel de control.
const KPI_META = {
  confirmandos: 'Confirmandos',
  usuarios: 'Usuarios',
  grupos: 'Grupos',
}
const PANEL_META = {
  seguimiento_critico: 'Seguimiento crítico',
  proximos_encuentros: 'Próximos encuentros',
  retencion: 'Estado de retención',
}
const MODULO_META = {
  cronograma: 'Cronograma',
  cumpleanos: 'Cumpleaños',
  sacramentos: 'Ruta sacramental',
}
const ESTADO_META = {
  en_preparacion: 'En preparación',
  confirmado: 'Confirmados',
  retirado: 'Retirados',
  todos: 'Todos',
}
const CAMPO_META = {
  celular: 'Celular',
  fecha_nacimiento: 'Fecha de nacimiento',
  genero: 'Género',
}

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
    ui_dashboard_kpis: [...CONFIG_DEFAULTS.ui.dashboard_kpis],
    ui_dashboard_paneles: [...CONFIG_DEFAULTS.ui.dashboard_paneles],
    ui_modulos_visibles: [...MODULOS_OCULTABLES],
    ui_confirmandos_estado_default: CONFIG_DEFAULTS.ui.confirmandos_estado_default,
    ui_confirmando_obligatorios: [...CONFIG_DEFAULTS.ui.confirmando_obligatorios],
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
  form.ui_dashboard_kpis = [...(c.ui?.dashboard_kpis ?? CONFIG_DEFAULTS.ui.dashboard_kpis)]
  form.ui_dashboard_paneles = [...(c.ui?.dashboard_paneles ?? CONFIG_DEFAULTS.ui.dashboard_paneles)]
  {
    const ocultos = c.ui?.modulos_ocultos ?? []
    form.ui_modulos_visibles = MODULOS_OCULTABLES.filter(m => !ocultos.includes(m))
  }
  form.ui_confirmandos_estado_default =
    CONFIRMANDOS_ESTADOS.includes(c.ui?.confirmandos_estado_default)
      ? c.ui.confirmandos_estado_default
      : CONFIG_DEFAULTS.ui.confirmandos_estado_default
  form.ui_confirmando_obligatorios =
    CONFIRMANDO_CAMPOS.filter(campo => (c.ui?.confirmando_obligatorios ?? []).includes(campo))
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
    ui: {
      dashboard_kpis: DASHBOARD_KPIS.filter(k => form.ui_dashboard_kpis.includes(k)),
      dashboard_paneles: DASHBOARD_PANELES.filter(k => form.ui_dashboard_paneles.includes(k)),
      modulos_ocultos: MODULOS_OCULTABLES.filter(m => !form.ui_modulos_visibles.includes(m)),
      confirmandos_estado_default: form.ui_confirmandos_estado_default,
      confirmando_obligatorios: CONFIRMANDO_CAMPOS.filter(c => form.ui_confirmando_obligatorios.includes(c)),
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
  <AppPage title="Configuración" subtitle="Ajustes que aplican a toda la parroquia" :loading="parroquiaStore.loading"
    skeleton="form">
    <template #actions>
      <button type="button" class="cfg__reset" :disabled="saving" @click="cargarDesdeStore">
        <RotateCcw :size="14" /> Descartar
      </button>
    </template>

    <form class="cfg__form" @submit.prevent="guardar">
      <!-- Identidad -->
      <section class="card">
        <header class="card__head">
          <h3 class="card__title"><Palette :size="15" class="card__ico" /> Identidad</h3>
        </header>
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
            <input v-model="form.branding.logo_url" type="url" maxlength="500" placeholder="https://…/logo.png"
              class="inp" />
            <small>Súbelo a un hosting de imágenes y pega el enlace.</small>
          </div>
        </div>
      </section>

      <!-- Programa -->
      <section class="card">
        <header class="card__head">
          <h3 class="card__title"><CalendarRange :size="15" class="card__ico" /> Programa</h3>
        </header>
        <div class="card__body">
          <div class="grid-fields grid-fields--sm">
            <div class="field">
              <label>Inicio</label>
              <input v-model="form.programa_inicio" type="date" class="inp" />
            </div>
            <div class="field">
              <label>Cierre <span class="opt">(opcional)</span></label>
              <input v-model="form.programa_fin" type="date" :min="form.programa_inicio || undefined" class="inp" />
            </div>
          </div>
        </div>
      </section>

      <!-- Reuniones y grupos -->
      <section class="card">
        <header class="card__head">
          <h3 class="card__title"><Users :size="15" class="card__ico" /> Reuniones y grupos</h3>
        </header>
        <div class="card__body">
          <div class="field">
            <label>Tipos de reunión activos</label>
            <div class="chips">
              <label v-for="t in TIPOS_REUNION" :key="t" class="chip"
                :class="{ 'chip--on': form.tipos_reunion.includes(t) }">
                <input type="checkbox" :value="t" v-model="form.tipos_reunion" />
                <Check v-if="form.tipos_reunion.includes(t)" :size="13" class="chip__check" /> {{ t }}
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

      <!-- Panel de control -->
      <section class="card">
        <header class="card__head">
          <h3 class="card__title"><LayoutDashboard :size="15" class="card__ico" /> Panel de control</h3>
          <p class="card__hint">Qué se muestra en el dashboard. Cada opción aparece solo si además tienes el permiso
            para verla.</p>
        </header>
        <div class="card__body">
          <div class="field">
            <label>Tarjetas KPI</label>
            <div class="chips">
              <label v-for="[key, label] in Object.entries(KPI_META)" :key="key" class="chip"
                :class="{ 'chip--on': form.ui_dashboard_kpis.includes(key) }">
                <input type="checkbox" :value="key" v-model="form.ui_dashboard_kpis" />
                <Check v-if="form.ui_dashboard_kpis.includes(key)" :size="13" class="chip__check" /> {{ label }}
              </label>
            </div>
          </div>
          <div class="field">
            <label>Bloques</label>
            <div class="chips">
              <label v-for="[key, label] in Object.entries(PANEL_META)" :key="key" class="chip"
                :class="{ 'chip--on': form.ui_dashboard_paneles.includes(key) }">
                <input type="checkbox" :value="key" v-model="form.ui_dashboard_paneles" />
                <Check v-if="form.ui_dashboard_paneles.includes(key)" :size="13" class="chip__check" /> {{ label }}
              </label>
            </div>
          </div>
        </div>
      </section>

      <!-- Módulos del menú -->
      <section class="card">
        <header class="card__head">
          <h3 class="card__title"><PanelLeft :size="15" class="card__ico" /> Módulos del menú</h3>
          <p class="card__hint">Qué secciones aparecen en el menú lateral. No cambia los permisos: solo oculta el
            acceso a las parroquias que no usan ese módulo.</p>
        </header>
        <div class="card__body">
          <div class="field">
            <div class="chips">
              <label v-for="[key, label] in Object.entries(MODULO_META)" :key="key" class="chip"
                :class="{ 'chip--on': form.ui_modulos_visibles.includes(key) }">
                <input type="checkbox" :value="key" v-model="form.ui_modulos_visibles" />
                <Check v-if="form.ui_modulos_visibles.includes(key)" :size="13" class="chip__check" /> {{ label }}
              </label>
            </div>
          </div>
        </div>
      </section>

      <!-- Listado de confirmandos -->
      <section class="card">
        <header class="card__head">
          <h3 class="card__title"><ListFilter :size="15" class="card__ico" /> Listado de confirmandos</h3>
        </header>
        <div class="card__body">
          <div class="field">
            <label>Filtro de estado al abrir la lista</label>
            <select v-model="form.ui_confirmandos_estado_default" class="inp inp--md">
              <option v-for="[key, label] in Object.entries(ESTADO_META)" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Datos del confirmando -->
      <section class="card">
        <header class="card__head">
          <h3 class="card__title"><UserCheck :size="15" class="card__ico" /> Datos del confirmando</h3>
          <p class="card__hint">Campos que se exigen al registrar o editar un confirmando. Nombres y apellidos siempre
            son obligatorios.</p>
        </header>
        <div class="card__body">
          <div class="field">
            <label>Exigir</label>
            <div class="chips">
              <label v-for="[key, label] in Object.entries(CAMPO_META)" :key="key" class="chip"
                :class="{ 'chip--on': form.ui_confirmando_obligatorios.includes(key) }">
                <input type="checkbox" :value="key" v-model="form.ui_confirmando_obligatorios" />
                <Check v-if="form.ui_confirmando_obligatorios.includes(key)" :size="13" class="chip__check" /> {{ label }}
              </label>
            </div>
          </div>
        </div>
      </section>

      <!-- Roles -->
      <section class="card">
        <header class="card__head">
          <h3 class="card__title"><Tag :size="15" class="card__ico" /> Nombres de los roles</h3>
          <p class="card__hint">Cómo se muestran en la interfaz (no cambia los permisos).</p>
        </header>
        <div class="card__body">
          <div class="grid-fields">
            <div v-for="[rol, ph] in ROLES_INTERNOS" :key="rol" class="field">
              <label>{{ ph }}</label>
              <input v-model="form.roles_labels[rol]" type="text" maxlength="60" :placeholder="ph" class="inp" />
            </div>
          </div>
        </div>
      </section>

      <!-- Alertas -->
      <section class="card">
        <header class="card__head">
          <h3 class="card__title"><TriangleAlert :size="15" class="card__ico" /> Alertas del dashboard</h3>
          <p class="card__hint">Un confirmando entra en la alerta al alcanzar estos valores.</p>
        </header>
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
.cfg__reset {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: .4rem .7rem;
  font-size: .8rem;
  color: #475569;
  background: #fff;
}

.cfg__reset:hover {
  background: #f8fafc;
}

/* En laptop, 2 columnas que aprovechan el ancho (multicolumna: reparte las
   tarjetas por altura, sin huecos muertos). En celular, una sola columna. */
.cfg__form {
  max-width: 1120px;
  margin-inline: auto;
}

@media (min-width: 1000px) {
  .cfg__form {
    column-count: 2;
    column-gap: 1.25rem;
  }

  .cfg__bar {
    column-span: all;
  }
}

.card {
  border: 1px solid #e6eaf0;
  border-radius: 14px;
  background: #fff;
  padding: 1.15rem 1.35rem 1.3rem;
  margin-bottom: 1.25rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
  break-inside: avoid;
}

.card__head {
  margin-bottom: 1rem;
}

.card__title {
  display: flex;
  align-items: center;
  gap: .5rem;
  font-size: .82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .045em;
  color: #334155;
  margin: 0;
}

.card__ico {
  color: var(--parroquia-color, #6366f1);
  flex-shrink: 0;
}

.card__hint {
  font-size: .78rem;
  color: #94a3b8;
  margin: .4rem 0 0;
  line-height: 1.35;
}

.card__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.field.grow {
  flex: 1;
}

.field label {
  font-size: .82rem;
  font-weight: 500;
  color: #475569;
  margin-bottom: .35rem;
}

.field small {
  font-size: .72rem;
  color: #94a3b8;
  margin-top: .3rem;
}

.field small.err,
.err {
  font-size: .72rem;
  color: #e11d48;
  margin-top: .3rem;
}

.opt {
  color: #94a3b8;
  font-weight: 400;
}

/* Sub-grilla de campos: 2-3 por fila en laptop, 1 en celular. */
.grid-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: .9rem 1.1rem;
}

.grid-fields--sm {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  max-width: 420px;
}

.inp {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  padding: .5rem .65rem;
  font-size: .88rem;
  background: #fff;
  color: #1e293b;
}

.inp:focus {
  outline: 2px solid #c7d2fe;
  outline-offset: -1px;
  border-color: #6366f1;
}

.inp--md {
  max-width: 340px;
}

.inp-color {
  width: 100%;
  min-width: 48px;
  height: 38px;
  padding: 3px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  cursor: pointer;
}

.inp-num {
  width: 64px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: .4rem;
  text-align: center;
  font-size: .88rem;
  color: #1e293b;
}

.inp-num:focus {
  outline: 2px solid #c7d2fe;
  outline-offset: -1px;
  border-color: #6366f1;
}

.row-identidad {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: end;
  gap: 1rem;
}

@media (max-width: 520px) {
  .row-identidad {
    grid-template-columns: auto 1fr;
  }

  .row-identidad .field:last-child {
    grid-column: 1 / -1;
  }

  .inp-color {
    max-width: 120px;
  }
}

.logo-box {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  background: #f8fafc;
}

.logo-box img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Chips seleccionables */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  margin: 0;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: .45rem .8rem;
  font-size: .84rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  user-select: none;
  transition: background-color .12s, border-color .12s, color .12s;
}

.chip:hover {
  border-color: #cbd5e1;
}

.chip input {
  opacity: 0;
  width: 0;
  height: 0;
  margin: 0;
}

.chip__check {
  flex-shrink: 0;
}

.chip--on {
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #3730a3;
  border-color: color-mix(in srgb, var(--parroquia-color, #6366f1) 45%, #e2e8f0);
  background: color-mix(in srgb, var(--parroquia-color, #6366f1) 9%, #fff);
  color: color-mix(in srgb, var(--parroquia-color, #6366f1) 75%, #1e293b);
}

/* Umbrales: 2 columnas si la tarjeta es ancha, 1 si es angosta. */
.umbral-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  column-gap: 2rem;
}

.umbral {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: .6rem 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: .85rem;
  color: #475569;
}

.umbral>span {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  line-height: 1.3;
}

.tag {
  font-style: normal;
  font-size: .6rem;
  font-weight: 700;
  letter-spacing: .03em;
  border-radius: 4px;
  padding: .12rem .35rem;
  flex-shrink: 0;
}

.tag--alto {
  background: #ffe4e6;
  color: #be123c;
}

.tag--medio {
  background: #fef3c7;
  color: #b45309;
}

.tag--bajo {
  background: #e0f2fe;
  color: #0369a1;
}

/* Barra de guardado */
.cfg__bar {
  position: sticky;
  bottom: 0;
  padding: .9rem 0 .5rem;
  margin-top: .25rem;
  display: flex;
  justify-content: flex-end;
  background: linear-gradient(transparent, #f8fafc 45%);
}

.cfg__bar .btn-primary {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  border-radius: 10px;
  padding: .6rem 1.2rem;
}

@media (max-width: 767px) {
  .card {
    padding: 1rem 1.05rem 1.1rem;
    border-radius: 12px;
  }

  .cfg__bar {
    position: static;
    background: none;
    padding: 1rem 0 0;
  }

  .cfg__bar .btn-primary {
    width: 100%;
    justify-content: center;
  }
}
</style>
