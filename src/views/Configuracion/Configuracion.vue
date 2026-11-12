<script setup>
import AppButton from '@/components/AppButton.vue'
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import {
  useParroquiaStore, CONFIG_DEFAULTS, PROGRAMA_TIPOS, PERSONA_LABELS_DEFAULT,
  DASHBOARD_KPIS, DASHBOARD_PANELES, MODULOS_OCULTABLES, CONFIRMANDOS_ESTADOS, CONFIRMANDO_CAMPOS,
} from '@/stores/parroquia'
import {
  Save, RotateCcw, Image as ImageIcon, Upload,
  Palette, CalendarRange, Users, Tag, LayoutDashboard, TriangleAlert, Check, PanelLeft, ListFilter, UserCheck,
  Phone, ClipboardCheck, Plus, Trash2, Settings2, History, DatabaseBackup, HeartHandshake, MessageSquareText, Archive,
} from 'lucide-vue-next'
import { subirLogo, quitarLogo } from '@/services/branding'
import { showAlerta, confirmar } from '@/funciones'
import AppPage from '@/components/AppPage.vue'
import CategoriasReunionEditor from './CategoriasReunionEditor.vue'
import HistorialParroquia from './HistorialParroquia.vue'
import RespaldoParroquia from './RespaldoParroquia.vue'
import CiclosParroquia from './CiclosParroquia.vue'
import { saveJustificacionAcciones } from '@/services/parroquia'
import { validarAcciones, validarMotivos } from '@/lib/justificacionConfig'

const parroquiaStore = useParroquiaStore()
const route = useRoute()
const router = useRouter()

// Pestañas (con enlace propio: ?tab=…). Historial y Respaldo no editan el formulario.
const TABS = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'reuniones', label: 'Reuniones y alertas', icon: Users },
  { id: 'panel', label: 'Panel y menú', icon: LayoutDashboard },
  { id: 'confirmandos', label: 'Jóvenes y roles', icon: UserCheck },
  { id: 'justificaciones', label: 'Justificaciones', icon: ClipboardCheck },
  { id: 'ciclos', label: 'Ciclos', icon: Archive },
  { id: 'historial', label: 'Historial', icon: History },
  { id: 'datos', label: 'Respaldo', icon: DatabaseBackup },
]
const TABS_FORM = ['general', 'reuniones', 'panel', 'confirmandos', 'justificaciones']
const tab = ref(TABS.some((t) => t.id === route.query.tab) ? route.query.tab : 'general')
const esTabForm = computed(() => TABS_FORM.includes(tab.value))
function irATab(id) {
  tab.value = id
  router.replace({ query: { ...route.query, tab: id } })
}
// Flechas izquierda/derecha entre pestañas (patrón ARIA tabs).
function teclaTab(e, i) {
  const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (!d) return
  e.preventDefault()
  const sig = TABS[(i + d + TABS.length) % TABS.length]
  irATab(sig.id)
  document.getElementById(`cfg-tab-${sig.id}`)?.focus()
}

// ── Identidad: logo (Storage) + color en vivo ──────────────────────────────
const fileInput = ref(null)
const subiendoLogo = ref(false)
const logoLocal = ref('') // objectURL de la imagen recién elegida (preview inmediato)

const COLOR_PRESETS = [
  '#2563eb', '#0ea5e9', '#0d9488', '#16a34a',
  '#7c3aed', '#db2777', '#dc2626', '#ea580c',
]

const logoPreview = computed(() =>
  logoLocal.value || form.branding.logo_url || form.branding.logo_url_proveedor || '')

const usandoLogoProveedor = computed(() =>
  !form.branding.logo_url && !!form.branding.logo_url_proveedor)

const colorHex = computed({
  get: () => form.branding.color_primario,
  set: (v) => {
    const s = String(v || '').trim().replace(/^#?/, '#')
    if (/^#[0-9a-fA-F]{6}$/.test(s)) form.branding.color_primario = s.toLowerCase()
  },
})

// Contraste del color contra texto blanco (WCAG AA = 4.5). CLAUDE.md §3.
const contrasteBajo = computed(() => {
  const m = /^#([0-9a-fA-F]{6})$/.exec(form.branding.color_primario || '')
  if (!m) return false
  const n = parseInt(m[1], 16)
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  })
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
  return 1.05 / (L + 0.05) < 4.5
})

function limpiarLocal() {
  if (logoLocal.value) URL.revokeObjectURL(logoLocal.value)
  logoLocal.value = ''
}

async function onLogoFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  const pid = parroquiaStore.parroquia?.id
  if (!pid) { showAlerta('No se pudo identificar la parroquia.', 'error'); return }

  subiendoLogo.value = true
  limpiarLocal()
  logoLocal.value = URL.createObjectURL(file)
  try {
    const { branding } = await subirLogo({
      parroquiaId: pid, slot: 'parroquia', file, urlAnterior: form.branding.logo_url,
    })
    parroquiaStore.aplicarBranding(branding)
    cargarDesdeStore()
    showAlerta('Logo actualizado', 'success')
  } catch (err) {
    showAlerta(err.message || 'No se pudo subir el logo', 'error')
  } finally {
    limpiarLocal()
    subiendoLogo.value = false
  }
}

async function restablecerIdentidad() {
  const tieneLogo = !!form.branding.logo_url
  const ok = await confirmar({
    titulo: '¿Restablecer la identidad?',
    texto: tieneLogo
      ? 'Se quita tu logo (vuelve el del proveedor o el del sistema) y el color pasa al azul por defecto. Se aplica al instante.'
      : 'El color vuelve al azul por defecto. (Recuerda Guardar para conservarlo.)',
    icono: 'warning',
    confirmarTexto: 'Sí, restablecer',
  })
  if (!ok) return
  form.branding.color_primario = CONFIG_DEFAULTS.branding.color_primario
  if (tieneLogo) {
    subiendoLogo.value = true
    try {
      const { branding } = await quitarLogo({
        parroquiaId: parroquiaStore.parroquia.id, slot: 'parroquia', urlAnterior: form.branding.logo_url,
      })
      parroquiaStore.aplicarBranding(branding)
      const color = form.branding.color_primario
      cargarDesdeStore()
      form.branding.color_primario = color
    } catch (err) {
      showAlerta(err.message || 'No se pudo quitar el logo', 'error')
    } finally {
      subiendoLogo.value = false
    }
  }
}

async function quitarLogoActual() {
  const ok = await confirmar({
    titulo: '¿Quitar tu logo?',
    texto: form.branding.logo_url_proveedor
      ? 'Volverá a mostrarse el logo puesto por el proveedor.'
      : 'La parroquia quedará con el logo por defecto del sistema.',
    icono: 'warning',
    confirmarTexto: 'Sí, quitar',
  })
  if (!ok) return
  subiendoLogo.value = true
  try {
    const { branding } = await quitarLogo({
      parroquiaId: parroquiaStore.parroquia.id, slot: 'parroquia', urlAnterior: form.branding.logo_url,
    })
    parroquiaStore.aplicarBranding(branding)
    cargarDesdeStore()
    showAlerta('Logo quitado', 'success')
  } catch (err) {
    showAlerta(err.message || 'No se pudo quitar el logo', 'error')
  } finally {
    subiendoLogo.value = false
  }
}

const TIPOS_REUNION = ['Confirmandos', 'Catequistas', 'Apoderados']
const saving = ref(false)
const form = reactive(estructuraVacia())
// Última foto de `form` tal como quedó cargado/guardado -- si el form actual
// difiere, hay cambios sin guardar (avisamos antes de perderlos).
const snapshotForm = ref(JSON.stringify(estructuraVacia()))
// Acciones reparadoras: lista editable; se guardan junto con la configuración.
const acciones = ref([])
const snapshotAcciones = ref('[]')
const accionesJSON = () => JSON.stringify(acciones.value.map(({ id, nombre, cupo_por_fecha, pide_detalle, activo }) =>
  ({ id: id ?? null, nombre, cupo_por_fecha: cupo_por_fecha === '' ? null : cupo_por_fecha, pide_detalle, activo })))
async function cargarAcciones() {
  const lista = await parroquiaStore.fetchJustificacionAcciones()
  acciones.value = lista.map((a) => ({ ...a, cupo_por_fecha: a.cupo_por_fecha ?? '' }))
  snapshotAcciones.value = accionesJSON()
}
const accionesCambiadas = computed(() => accionesJSON() !== snapshotAcciones.value)
const agregarAccion = () => acciones.value.push({ id: null, nombre: '', cupo_por_fecha: '', pide_detalle: false, activo: true })
const quitarAccion = (i) => acciones.value.splice(i, 1)

const agregarMotivo = () => form.justificacion_motivos.push('')
const quitarMotivo = (i) => form.justificacion_motivos.splice(i, 1)

const hayCambiosSinGuardar = computed(() => JSON.stringify(form) !== snapshotForm.value || accionesCambiadas.value)

// Default automático según el tipo elegido AHORA en el form (no el guardado
// todavía) -- para mostrar como placeholder de lo que se usa si se deja vacío.
const personaDefault = computed(() =>
  PERSONA_LABELS_DEFAULT[form.programa_tipo] || PERSONA_LABELS_DEFAULT.confirmacion)

// Vista previa del color EN VIVO sobre todo el sistema mientras se edita: se
// publica en el store (solo si difiere del guardado) y DefaultLayout lo pinta.
// Al Descartar / Guardar / salir vuelve el color guardado.
watch(() => form.branding.color_primario, (hex) => {
  const guardado = parroquiaStore.configuracion?.branding?.color_primario
  parroquiaStore.setColorPreview(hex && hex !== guardado ? hex : null)
})
onBeforeUnmount(() => {
  limpiarLocal()
  parroquiaStore.setColorPreview(null)
})

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
  jornadas: 'Jornadas',
  cumpleanos: 'Cumpleaños',
  sacramentos: 'Ruta sacramental',
  sacramentos_programados: 'Sacramentos programados',
  justificaciones: 'Justificaciones',
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
    programa_tipo: CONFIG_DEFAULTS.programa_tipo,
    programa_nombre_otro: '',
    persona_nombre_singular: '',
    persona_nombre_plural: '',
    dias_ventana_justificacion: 21,
    tipos_reunion: [],
    umbrales_alerta: { ...CONFIG_DEFAULTS.umbrales_alerta },
    procedencias: '',
    grupos_edad_min: '',
    grupos_edad_max: '',
    branding: { nombre_publico: '', logo_url: '', logo_url_proveedor: '', color_primario: '#2563eb' },
    roles_labels: {},
    contacto: { telefono: '', email: '', direccion: '' },
    justificacion_motivos: [],
    ui_dashboard_kpis: [...CONFIG_DEFAULTS.ui.dashboard_kpis],
    ui_dashboard_paneles: [...CONFIG_DEFAULTS.ui.dashboard_paneles],
    ui_modulos_visibles: [...MODULOS_OCULTABLES],
    ui_confirmandos_estado_default: CONFIG_DEFAULTS.ui.confirmandos_estado_default,
    ui_confirmando_obligatorios: [...CONFIG_DEFAULTS.ui.confirmando_obligatorios],
    ui_confirmado_exige_requisitos: CONFIG_DEFAULTS.ui.confirmado_exige_requisitos === 'si',
  }
}

function cargarDesdeStore() {
  const c = parroquiaStore.configuracion
  form.programa_inicio = c.programa_inicio ?? ''
  form.programa_fin = c.programa_fin ?? ''
  form.programa_tipo = c.programa_tipo ?? CONFIG_DEFAULTS.programa_tipo
  form.programa_nombre_otro = c.programa_nombre_otro ?? ''
  form.persona_nombre_singular = c.persona_nombre_singular ?? ''
  form.persona_nombre_plural = c.persona_nombre_plural ?? ''
  form.dias_ventana_justificacion = c.dias_ventana_justificacion ?? 21
  form.tipos_reunion = [...(c.tipos_reunion ?? CONFIG_DEFAULTS.tipos_reunion)]
  form.umbrales_alerta = { ...CONFIG_DEFAULTS.umbrales_alerta, ...(c.umbrales_alerta ?? {}) }
  form.procedencias = (c.procedencias ?? CONFIG_DEFAULTS.procedencias).join(', ')
  form.grupos_edad_min = c.grupos_edad_min ?? ''
  form.grupos_edad_max = c.grupos_edad_max ?? ''
  form.roles_labels = { ...(c.roles_labels ?? {}) }
  form.contacto = {
    telefono: c.contacto?.telefono ?? '',
    email: c.contacto?.email ?? '',
    direccion: c.contacto?.direccion ?? '',
  }
  form.justificacion_motivos = [...(c.justificacion_motivos?.length ? c.justificacion_motivos : CONFIG_DEFAULTS.justificacion_motivos)]
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
  form.ui_confirmado_exige_requisitos = (c.ui?.confirmado_exige_requisitos ?? 'no') === 'si'
  form.branding = {
    nombre_publico: c.branding?.nombre_publico ?? '',
    logo_url: c.branding?.logo_url ?? '',
    logo_url_proveedor: c.branding?.logo_url_proveedor ?? '',
    color_primario: c.branding?.color_primario ?? '#2563eb',
  }
  snapshotForm.value = JSON.stringify(form)
}

onMounted(async () => {
  await parroquiaStore.fetchConfiguracion()
  cargarDesdeStore()
  cargarAcciones()
})

const onBeforeUnload = (e) => {
  if (!hayCambiosSinGuardar.value) return
  e.preventDefault()
  e.returnValue = ''
}
window.addEventListener('beforeunload', onBeforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

onBeforeRouteLeave(async () => {
  if (!hayCambiosSinGuardar.value) return true
  return confirmar({
    titulo: 'Tienes cambios sin guardar',
    texto: 'Si sales ahora, se pierden los cambios que hiciste en esta pantalla.',
    icono: 'warning',
    confirmarTexto: 'Salir sin guardar',
    cancelarTexto: 'Seguir editando',
  })
})

async function guardar() {
  const errMotivos = validarMotivos(form.justificacion_motivos)
  const errAcciones = accionesCambiadas.value ? validarAcciones(acciones.value) : ''
  if (errMotivos || errAcciones) {
    irATab('justificaciones')
    showAlerta(errMotivos || errAcciones, 'warning')
    return
  }
  saving.value = true
  const payload = {
    programa_inicio: form.programa_inicio || null,
    programa_fin: form.programa_fin || null,
    programa_tipo: form.programa_tipo,
    programa_nombre_otro: form.programa_tipo === 'otro' ? form.programa_nombre_otro.trim() : null,
    persona_nombre_singular: form.persona_nombre_singular.trim() || null,
    persona_nombre_plural: form.persona_nombre_plural.trim() || null,
    dias_ventana_justificacion: Number(form.dias_ventana_justificacion),
    tipos_reunion: form.tipos_reunion,
    umbrales_alerta: Object.fromEntries(
      Object.entries(form.umbrales_alerta).map(([k, v]) => [k, Number(v)]),
    ),
    procedencias: form.procedencias.split(',').map(s => s.trim()).filter(Boolean),
    grupos_edad_min: form.grupos_edad_min === '' ? null : Number(form.grupos_edad_min),
    grupos_edad_max: form.grupos_edad_max === '' ? null : Number(form.grupos_edad_max),
    roles_labels: Object.fromEntries(
      Object.entries(form.roles_labels).filter(([, v]) => (v || '').trim()),
    ),
    contacto: {
      telefono: form.contacto.telefono.trim() || null,
      email: form.contacto.email.trim() || null,
      direccion: form.contacto.direccion.trim() || null,
    },
    justificacion_motivos: form.justificacion_motivos.map((m) => m.trim()).filter(Boolean),
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
      confirmado_exige_requisitos: form.ui_confirmado_exige_requisitos ? 'si' : 'no',
    },
  }
  const ok = await parroquiaStore.save(payload)
  if (ok && accionesCambiadas.value) {
    try {
      await saveJustificacionAcciones(JSON.parse(accionesJSON()))
      await cargarAcciones()
    } catch (e) {
      irATab('justificaciones')
      showAlerta(e?.message || 'No se pudieron guardar las acciones reparadoras', 'error')
    }
  }
  cargarDesdeStore()
  // Ya guardado: el color efectivo pasa a ser el de la config, no la "vista previa".
  parroquiaStore.setColorPreview(null)
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
      <AppButton v-if="esTabForm" variant="secondary" size="sm" type="button" :icon="RotateCcw" :disabled="saving"
        @click="cargarDesdeStore(); cargarAcciones()">
        Descartar
      </AppButton>
    </template>

    <div class="cfg-tabs" role="tablist" aria-label="Secciones de la configuración">
      <button v-for="(t, i) in TABS" :id="`cfg-tab-${t.id}`" :key="t.id" type="button" role="tab" class="cfg-tab"
        :class="{ 'cfg-tab--on': tab === t.id }" :aria-selected="tab === t.id" :tabindex="tab === t.id ? 0 : -1"
        aria-controls="cfg-panel" @click="irATab(t.id)" @keydown="teclaTab($event, i)">
        <component :is="t.icon" :size="15" aria-hidden="true" /> {{ t.label }}
      </button>
    </div>

    <div id="cfg-panel" role="tabpanel" :aria-labelledby="`cfg-tab-${tab}`">
    <HistorialParroquia v-if="tab === 'historial'" />
    <RespaldoParroquia v-else-if="tab === 'datos'" />
    <CiclosParroquia v-else-if="tab === 'ciclos'" />

    <form v-else class="cfg__form" @submit.prevent="guardar">
      <template v-if="tab === 'general'">
      <!-- Identidad -->
      <section class="card">
        <header class="card__head card__head--row">
          <h3 class="card__title"><Palette :size="15" class="card__ico" /> Identidad</h3>
          <AppButton variant="ghost" size="sm" type="button" :disabled="subiendoLogo" @click="restablecerIdentidad">
            Restablecer
          </AppButton>
        </header>
        <div class="card__body">
          <div class="field">
            <label>Nombre visible</label>
            <input v-model="form.branding.nombre_publico" type="text" maxlength="120"
              placeholder="Parroquia Sagrado Corazón de Jesús" class="inp" />
          </div>

          <div class="field">
            <label>Logo</label>
            <div class="logo-up">
              <div class="logo-box logo-box--lg">
                <img v-if="logoPreview" :src="logoPreview" alt="" />
                <ImageIcon v-else :size="22" class="text-slate-300" />
              </div>
              <div class="logo-up__side">
                <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp"
                  class="sr-file" @change="onLogoFile" />
                <div class="logo-up__btns">
                  <AppButton variant="secondary" size="sm" type="button" :icon="Upload" :loading="subiendoLogo"
                    @click="fileInput?.click()">
                    {{ subiendoLogo ? 'Subiendo…' : (form.branding.logo_url ? 'Cambiar logo' : 'Subir logo') }}
                  </AppButton>
                  <AppButton v-if="form.branding.logo_url" variant="ghost" size="sm" type="button" :disabled="subiendoLogo"
                    @click="quitarLogoActual">Quitar el mío</AppButton>
                </div>
                <small v-if="usandoLogoProveedor">Mostrando el logo que puso el proveedor.</small>
                <small v-else>PNG, JPG o WebP. Se recorta a un cuadrado y se optimiza (máx. 512 px).</small>
              </div>
            </div>
          </div>

          <div class="field">
            <label>Color principal</label>
            <div class="color-row">
              <input v-model="colorHex" type="color" class="inp-color inp-color--sm" />
              <input v-model="colorHex" type="text" maxlength="7" class="inp inp-hex" placeholder="#2563eb" />
              <div class="swatches">
                <button v-for="c in COLOR_PRESETS" :key="c" type="button" class="swatch"
                  :class="{ 'swatch--on': form.branding.color_primario.toLowerCase() === c }"
                  :style="{ background: c }" :title="c" @click="form.branding.color_primario = c" />
              </div>
            </div>
            <small v-if="contrasteBajo" class="warn-contraste">
              <TriangleAlert :size="12" /> El texto blanco sobre este color puede leerse mal (contraste bajo).
            </small>
          </div>

          <div class="brand-preview" :style="{ '--pv': form.branding.color_primario }" aria-hidden="true">
            <span class="bp-tag">Vista previa · solo muestra</span>
            <div class="bp-shell">
              <div class="bp-side">
                <span class="bp-logo">
                  <img v-if="logoPreview" :src="logoPreview" alt="" />
                  <ImageIcon v-else :size="13" class="text-slate-300" />
                </span>
                <span class="bp-name">{{ form.branding.nombre_publico || parroquiaStore.parroquia?.nombre || 'Nombre visible' }}</span>
              </div>
              <div class="bp-rows">
                <span class="bp-row bp-row--on">Panel</span>
                <span class="bp-row">Confirmandos</span>
              </div>
              <div class="bp-foot">
                <span class="bp-btn">Botón</span>
                <span class="bp-chip">Etiqueta</span>
              </div>
            </div>
            <small>El color se aplica al instante en todo el sistema. Para conservarlo pulsa
              <b>«Guardar configuración»</b> abajo (o <b>Descartar</b> para volver al anterior).
              El logo se guarda solo, al subirlo.</small>
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
              <label>Tipo de programa</label>
              <select v-model="form.programa_tipo" class="inp">
                <option v-for="[valor, etiqueta] in PROGRAMA_TIPOS" :key="valor" :value="valor">{{ etiqueta }}</option>
              </select>
            </div>
            <div class="field" v-if="form.programa_tipo === 'otro'">
              <label>Nombre del programa</label>
              <input v-model="form.programa_nombre_otro" type="text" maxlength="60" class="inp"
                placeholder="Ej: Primera Reconciliación" />
            </div>
          </div>
          <div class="grid-fields grid-fields--sm mt-3">
            <div class="field">
              <label>Cómo llamar a la persona (singular) <span class="opt">(opcional)</span></label>
              <input v-model="form.persona_nombre_singular" type="text" maxlength="40" class="inp"
                :placeholder="personaDefault[0]" />
            </div>
            <div class="field">
              <label>Cómo llamar a la persona (plural) <span class="opt">(opcional)</span></label>
              <input v-model="form.persona_nombre_plural" type="text" maxlength="40" class="inp"
                :placeholder="personaDefault[1]" />
            </div>
          </div>
          <small class="text-slate-400 block mt-1">
            Vacío usa el default de "{{ PROGRAMA_TIPOS.find(([v]) => v === form.programa_tipo)?.[1] }}":
            "{{ personaDefault[0] }}" / "{{ personaDefault[1] }}". Se usa en el menú, el dashboard y los
            listados (ej. "Listado de {{ (form.persona_nombre_plural.trim() || personaDefault[1]).toLowerCase() }}").
          </small>
          <div class="grid-fields grid-fields--sm mt-3">
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

      <!-- Contacto -->
      <section class="card">
        <header class="card__head">
          <h3 class="card__title"><Phone :size="15" class="card__ico" /> Contacto de la parroquia</h3>
          <p class="card__hint">Opcional. Se usa para que las familias sepan cómo comunicarse con la parroquia.</p>
        </header>
        <div class="card__body">
          <div class="grid-fields grid-fields--sm">
            <div class="field">
              <label for="cfg-tel">Teléfono <span class="opt">(opcional)</span></label>
              <input id="cfg-tel" v-model="form.contacto.telefono" type="tel" maxlength="20" class="inp"
                inputmode="tel" placeholder="Ej: 073 123456" />
            </div>
            <div class="field">
              <label for="cfg-mail">Correo <span class="opt">(opcional)</span></label>
              <input id="cfg-mail" v-model="form.contacto.email" type="email" maxlength="120" class="inp"
                placeholder="parroquia@ejemplo.com" />
            </div>
          </div>
          <div class="field mt-3">
            <label for="cfg-dir">Dirección <span class="opt">(opcional)</span></label>
            <input id="cfg-dir" v-model="form.contacto.direccion" type="text" maxlength="200" class="inp" />
          </div>
          <small>Las redes sociales y el prefijo de WhatsApp los configura el proveedor del sistema.</small>
        </div>
      </section>
      </template>

      <template v-if="tab === 'reuniones'">

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
          <CategoriasReunionEditor />
          <div class="field">
            <label>Procedencias de grupo</label>
            <input v-model="form.procedencias" type="text" class="inp inp--md" />
            <small>Separadas por coma. Ej: <code>sede, caserio</code></small>
          </div>
          <div class="field">
            <label>Edad para el reparto automático de grupos</label>
            <div class="edad-row">
              <input v-model="form.grupos_edad_min" type="number" min="1" max="99" class="inp-num" placeholder="—" />
              <span>a</span>
              <input v-model="form.grupos_edad_max" type="number" min="1" max="99" class="inp-num" placeholder="—" />
              <span>años</span>
            </div>
            <small>Al "Generar grupos", solo se reparten confirmandos dentro de este rango (los que no tienen
              fecha de nacimiento siempre entran). Deja ambos en blanco para no filtrar por edad.</small>
          </div>
        </div>
      </section>

      <section class="card">
        <header class="card__head">
          <h3 class="card__title"><TriangleAlert :size="15" class="card__ico" /> Alertas del dashboard</h3>
          <p class="card__hint">Un joven entra en la alerta al alcanzar estos valores.</p>
        </header>
        <div class="umbral-grid">
          <div v-for="[key, label, riesgo] in UMBRALES" :key="key" class="umbral">
            <span><i class="tag" :class="'tag--' + riesgo.toLowerCase()">{{ riesgo }}</i> {{ label }}</span>
            <input v-model="form.umbrales_alerta[key]" type="number" min="1" max="99" class="inp-num" />
          </div>
        </div>
      </section>
      </template>

      <template v-if="tab === 'panel'">
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

      </template>

      <template v-if="tab === 'confirmandos'">
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
          <div class="field">
            <label class="chip" :class="{ 'chip--on': form.ui_confirmado_exige_requisitos }" style="align-self:flex-start">
              <input type="checkbox" v-model="form.ui_confirmado_exige_requisitos" />
              <Check v-if="form.ui_confirmado_exige_requisitos" :size="13" class="chip__check" />
              No permitir marcar "Confirmado" con documentos o sacramentos pendientes
            </label>
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

      </template>

      <template v-if="tab === 'justificaciones'">
      <section class="card">
        <header class="card__head">
          <h3 class="card__title"><ClipboardCheck :size="15" class="card__ico" /> Plazo para justificar</h3>
          <p class="card__hint">Cuántos días después de la falta todavía se puede registrar un acuerdo.</p>
        </header>
        <div class="card__body">
          <div class="umbral">
            <span>Días para poder justificar una falta</span>
            <input v-model="form.dias_ventana_justificacion" type="number" min="1" max="365" class="inp-num" />
          </div>
        </div>
      </section>

      <section class="card">
        <header class="card__head card__head--row">
          <div>
            <h3 class="card__title"><MessageSquareText :size="15" class="card__ico" /> Motivos de la falta</h3>
            <p class="card__hint">Opciones que ve quien registra el acuerdo con el apoderado.</p>
          </div>
          <AppButton variant="secondary" size="sm" type="button" :icon="Plus"
            :disabled="form.justificacion_motivos.length >= 20" @click="agregarMotivo">Motivo</AppButton>
        </header>
        <ul class="lista-edit">
          <li v-for="(m, i) in form.justificacion_motivos" :key="i" class="lista-edit__fila">
            <input v-model="form.justificacion_motivos[i]" type="text" maxlength="80" class="inp"
              :aria-label="`Motivo ${i + 1}`" placeholder="Ej: Salud / Enfermedad" />
            <AppButton variant="soft-danger" size="sm" icon-only :icon="Trash2" type="button"
              :disabled="form.justificacion_motivos.length <= 1" :aria-label="`Quitar el motivo ${m || i + 1}`"
              @click="quitarMotivo(i)" />
          </li>
        </ul>
      </section>

      <section class="card card--ancha">
        <header class="card__head card__head--row">
          <div>
            <h3 class="card__title"><HeartHandshake :size="15" class="card__ico" /> Acciones reparadoras</h3>
            <p class="card__hint">Lo que se pacta para justificar la falta. El cupo limita cuántas personas pueden
              hacerla la misma fecha (vacío = sin límite). Si una acción ya se usó, al quitarla se desactiva y el
              historial conserva su nombre.</p>
          </div>
          <AppButton variant="secondary" size="sm" type="button" :icon="Plus"
            :disabled="acciones.length >= 20" @click="agregarAccion">Acción</AppButton>
        </header>
        <div class="acc-tabla" role="table" aria-label="Acciones reparadoras">
          <div class="acc-fila acc-fila--head" role="row">
            <span role="columnheader">Nombre</span>
            <span role="columnheader">Cupo por fecha</span>
            <span role="columnheader">Pide detalle</span>
            <span role="columnheader">Activa</span>
            <span role="columnheader"><span class="sr-file">Quitar</span></span>
          </div>
          <div v-for="(a, i) in acciones" :key="a.id ?? `n${i}`" class="acc-fila" :class="{ 'acc-fila--off': !a.activo }" role="row">
            <input v-model="a.nombre" type="text" maxlength="60" class="inp" role="cell"
              :aria-label="`Nombre de la acción ${i + 1}`" placeholder="Ej: Lectura en misa" />
            <input v-model="a.cupo_por_fecha" type="number" min="1" max="99" class="inp-num" role="cell"
              :aria-label="`Cupo por fecha de ${a.nombre || 'la acción'}`" placeholder="—" />
            <label class="chip acc-check" :class="{ 'chip--on': a.pide_detalle }" role="cell">
              <input v-model="a.pide_detalle" type="checkbox" />
              <Check v-if="a.pide_detalle" :size="13" class="chip__check" /> Detalle
            </label>
            <label class="chip acc-check" :class="{ 'chip--on': a.activo }" role="cell">
              <input v-model="a.activo" type="checkbox" />
              <Check v-if="a.activo" :size="13" class="chip__check" /> Activa
            </label>
            <AppButton variant="soft-danger" size="sm" icon-only :icon="Trash2" type="button" role="cell"
              :aria-label="`Quitar ${a.nombre || 'la acción'}`" @click="quitarAccion(i)" />
          </div>
        </div>
      </section>
      </template>

      <div class="cfg__bar">
        <span v-if="hayCambiosSinGuardar && !saving" class="cfg__dirty">
          <TriangleAlert :size="14" /> Tienes cambios sin guardar
        </span>
        <AppButton type="submit" :icon="Save" :loading="saving" :disabled="form.tipos_reunion.length === 0">
          {{ saving ? 'Guardando…' : 'Guardar configuración' }}
        </AppButton>
      </div>
    </form>
    </div>
  </AppPage>
</template>

<style scoped>

/* Multicolumna: reparte las tarjetas por altura, sin huecos muertos. Una
   columna en celular, 2 en laptop y 3 en pantallas anchas (sin tope de ancho:
   antes quedaba un margen vacío a los lados en monitores grandes). */
@media (min-width: 1000px) {
  .cfg__form {
    column-count: 2;
    column-gap: 1.25rem;
  }

  .cfg__bar {
    column-span: all;
  }
}

@media (min-width: 1600px) {
  .cfg__form { column-count: 3; }
}

.card {
  border: 1px solid #e6eaf0;
  border-radius: var(--radius-xl);
  background: var(--surface);
  padding: 1.15rem 1.35rem 1.3rem;
  margin-bottom: 1.25rem;
  box-shadow: var(--shadow-sm);
  break-inside: avoid;
}

.card__head {
  margin-bottom: 1rem;
}

.card__head--row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
}

.card__title {
  display: flex;
  align-items: center;
  gap: .5rem;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.card__ico {
  color: var(--accent);
  flex-shrink: 0;
}

.card__hint {
  font-size: var(--fs-xs);
  color: var(--text-muted);
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
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-muted);
  margin-bottom: .35rem;
}

.field small {
  font-size: var(--fs-xs);
  color: var(--text-muted);
  margin-top: .3rem;
}

.field small.err,
.err {
  font-size: var(--fs-xs);
  color: #e11d48;
  margin-top: .3rem;
}

.opt {
  color: var(--text-muted);
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
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  padding: .5rem .65rem;
  font-size: var(--fs-ui);
  background: var(--surface);
  color: var(--text);
}

.inp:focus {
  outline: 2px solid var(--accent-ring);
  outline-offset: -1px;
  border-color: var(--accent);
}

.inp--md {
  max-width: 340px;
}

.edad-row {
  display: flex;
  align-items: center;
  gap: .5rem;
  font-size: var(--fs-ui);
  color: var(--text-muted);
}

.inp-color {
  width: 100%;
  min-width: 48px;
  height: 38px;
  padding: 3px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.inp-num {
  width: 64px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  padding: .4rem;
  text-align: center;
  font-size: var(--fs-ui);
  color: var(--text);
}

.inp-num:focus {
  outline: 2px solid var(--accent-ring);
  outline-offset: -1px;
  border-color: var(--accent);
}

.logo-box {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface-sunken);
}

.logo-box--lg {
  width: 64px;
  height: 64px;
}

.logo-box img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Subidor de logo */
.logo-up {
  display: flex;
  align-items: center;
  gap: .9rem;
}

.logo-up__side {
  display: flex;
  flex-direction: column;
  gap: .4rem;
  min-width: 0;
}

.logo-up__btns {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
}

.sr-file {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

/* Color: picker + hex + presets */
.color-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .6rem;
}

.inp-color--sm {
  width: 44px;
  min-width: 44px;
  height: 34px;
}

.inp-hex {
  width: 92px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  text-transform: lowercase;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: .35rem;
}

.swatch {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(15, 23, 42, .12);
  cursor: pointer;
  padding: 0;
}

/* Anillo de selección con alto contraste: --text es oscuro en claro y claro en oscuro. */
.swatch--on {
  outline: 2px solid var(--text);
  outline-offset: 2px;
}

.warn-contraste {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  color: #b45309 !important;
}

/* Vista previa del branding */
.brand-preview {
  border: 1px dashed #d8dee9;
  border-radius: var(--radius-lg);
  padding: .85rem;
  background: #fbfcfe;
}

.brand-preview .bp-tag {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text-muted);
}

.bp-shell {
  margin: .5rem 0 .45rem;
  border: 1px solid #e6eaf0;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--surface);
  /* Es una maqueta: nada acá se puede clicar. */
  pointer-events: none;
  user-select: none;
}

.bp-side {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .5rem .6rem;
  border-bottom: 1px solid #eef2f6;
}

.bp-logo {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
}

.bp-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.bp-name {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bp-rows {
  display: flex;
  flex-direction: column;
  padding: .4rem .5rem;
  gap: .2rem;
}

.bp-row {
  font-size: var(--fs-xs);
  color: var(--text-muted);
  padding: .3rem .5rem;
  border-radius: var(--radius-sm);
}

.bp-row--on {
  background: color-mix(in srgb, var(--pv) 12%, var(--surface));
  color: color-mix(in srgb, var(--pv) 78%, var(--text));
  font-weight: 600;
}

.bp-foot {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: .5rem .6rem .6rem;
}

.bp-btn {
  display: inline-block;
  border-radius: var(--radius-md);
  padding: .4rem .8rem;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: #fff;
  background: var(--pv);
}

.bp-chip {
  display: inline-flex;
  align-items: center;
  font-size: var(--fs-xs);
  font-weight: 500;
  padding: .25rem .6rem;
  border-radius: var(--radius-pill);
  border: 1px solid color-mix(in srgb, var(--pv) 40%, var(--line));
  background: color-mix(in srgb, var(--pv) 9%, var(--surface));
  color: color-mix(in srgb, var(--pv) 75%, var(--text));
}

@media (max-width: 520px) {
  .logo-up {
    flex-direction: column;
    align-items: flex-start;
  }
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
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: .45rem .8rem;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
  transition: background-color .12s, border-color .12s, color .12s;
}

.chip:hover {
  border-color: var(--line-strong);
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
  border-color: var(--accent-ring);
  background: var(--accent-soft);
  color: #3730a3;
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
  background: color-mix(in srgb, var(--accent) 9%, var(--surface));
  color: color-mix(in srgb, var(--accent) 75%, var(--text));
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
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-ui);
  color: var(--text-muted);
}

.umbral>span {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  line-height: 1.3;
}

.tag {
  font-style: normal;
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: .03em;
  border-radius: var(--radius-sm);
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
  align-items: center;
  justify-content: flex-end;
  gap: .75rem;
  background: linear-gradient(transparent, var(--surface-sunken) 45%);
}

.cfg__dirty {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: #b45309;
}

@media (max-width: 767px) {
  .card {
    padding: 1rem 1.05rem 1.1rem;
    border-radius: var(--radius-lg);
  }

  .cfg__bar {
    position: static;
    background: none;
    padding: 1rem 0 0;
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .cfg__bar :deep(.app-btn) {
    width: 100%;
  }

  .cfg__dirty {
    justify-content: center;
  }
}
/* ===== MODO OSCURO =====
   Esta vista tiene su propio sistema de tarjetas/campos con colores
   hardcodeados (no pasa por main.css) — se le agrega la contraparte oscura
   acá, con la misma paleta que el resto del sistema. */
:root[data-bs-theme="dark"] .card {
  border-color: var(--line);
  background: var(--surface);
}
:root[data-bs-theme="dark"] .field label {
  color: var(--text);
}
:root[data-bs-theme="dark"] .field small.err,
:root[data-bs-theme="dark"] .err {
  color: #fca5a5;
}
:root[data-bs-theme="dark"] .inp,
:root[data-bs-theme="dark"] .inp-num {
  background: var(--surface-sunken);
  border-color: var(--line-strong);
  color: var(--text);
}
:root[data-bs-theme="dark"] .inp:focus,
:root[data-bs-theme="dark"] .inp-num:focus {
  outline-color: color-mix(in srgb, var(--accent), #000 25%);
  border-color: #818cf8;
}
:root[data-bs-theme="dark"] .logo-box {
  border-color: var(--line);
}
:root[data-bs-theme="dark"] .warn-contraste {
  color: #fbbf24 !important;
}
:root[data-bs-theme="dark"] .brand-preview {
  border-color: var(--line-strong);
  background: var(--surface-sunken);
}
:root[data-bs-theme="dark"] .bp-shell {
  border-color: var(--line);
}
:root[data-bs-theme="dark"] .bp-side {
  border-bottom-color: var(--line);
}
:root[data-bs-theme="dark"] .bp-logo {
  background: var(--line);
}
:root[data-bs-theme="dark"] .bp-row {
  color: var(--text-muted);
}
:root[data-bs-theme="dark"] .bp-row--on {
  background: color-mix(in srgb, var(--pv) 20%, var(--surface));
  color: color-mix(in srgb, var(--pv) 70%, var(--text));
}
:root[data-bs-theme="dark"] .bp-chip {
  background: color-mix(in srgb, var(--pv) 16%, var(--surface));
  color: color-mix(in srgb, var(--pv) 70%, var(--text));
}
:root[data-bs-theme="dark"] .chip {
  border-color: var(--line-strong);
  color: var(--text-muted);
}
:root[data-bs-theme="dark"] .chip:hover {
  border-color: var(--line-strong);
}
:root[data-bs-theme="dark"] .chip--on {
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
  color: color-mix(in srgb, var(--accent) 70%, var(--text));
}
:root[data-bs-theme="dark"] .umbral {
  border-bottom-color: var(--line);
  color: var(--text);
}
:root[data-bs-theme="dark"] .tag--alto {
  background: #4c1d1d;
  color: #fca5a5;
}
:root[data-bs-theme="dark"] .tag--medio {
  background: #4a3412;
  color: #fbbf24;
}
:root[data-bs-theme="dark"] .tag--bajo {
  background: #0c2d48;
  color: #7dd3fc;
}
:root[data-bs-theme="dark"] .cfg__bar {
  background: linear-gradient(transparent, var(--surface-sunken) 45%);
}
:root[data-bs-theme="dark"] .cfg__dirty {
  color: #fbbf24;
}

/* ── Pestañas ─────────────────────────────────────────────────────────── */
.cfg-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 1rem;
  padding: 0.25rem;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-sm);
}
.cfg-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 40px;
  padding: 0.45rem 0.85rem;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--fs-sm);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.cfg-tab:hover { color: var(--text); background: var(--surface-sunken); }
.cfg-tab--on { background: var(--accent-soft); color: var(--accent); }
.cfg-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* ── Listas editables (motivos) ───────────────────────────────────────── */
.lista-edit { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.lista-edit__fila { display: flex; gap: 0.5rem; align-items: center; }
.lista-edit__fila .inp { flex: 1; min-width: 0; }

/* ── Acciones reparadoras ─────────────────────────────────────────────── */
.card--ancha { column-span: all; }
.acc-tabla { display: flex; flex-direction: column; gap: 0.5rem; }
.acc-fila {
  display: grid;
  /* Anchos fijos: cada fila es su propia grilla y deben coincidir entre sí. */
  grid-template-columns: minmax(10rem, 1fr) 6rem 7.5rem 7rem 2.5rem;
  gap: 0.5rem 0.75rem;
  align-items: center;
}
.acc-fila--head { font-size: var(--fs-xs); font-weight: 700; color: var(--text-muted); }
.acc-fila--off .inp { opacity: 0.6; }
.acc-check { justify-self: start; }
@media (max-width: 640px) {
  .acc-fila { grid-template-columns: 1fr 5.5rem 2.5rem; }
  .acc-fila--head { display: none; }
  .acc-fila .inp:first-child { grid-column: 1 / -1; }
}
</style>
