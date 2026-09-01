import { defineStore } from 'pinia'
import { LS_PARROQUIA_KEY } from '@/constants/auth'
import { getConfiguracion, updateConfiguracion } from '@/services/parroquia'
import { showAlerta, showErroresDeValidacion } from '@/funciones'

// Valores por defecto (espejo de App\Tenancy\TenantConfig::DEFAULTS del backend).
export const CONFIG_DEFAULTS = {
  programa_inicio: null,
  programa_fin: null,
  dias_ventana_justificacion: 21,
  tipos_reunion: ['Confirmandos', 'Catequistas', 'Apoderados'],
  umbrales_alerta: {
    alto_injustificadas: 4,
    alto_racha: 2,
    alto_seguidas_historicas: 3,
    medio_justificadas: 4,
    bajo_tardanzas_seguidas: 2,
  },
  procedencias: ['sede', 'caserio'],
  branding: { nombre_publico: null, logo_url: null, color_primario: '#2563eb' },
  roles_labels: {},
  // Personalización de interfaz. Filtro de layout: cada opción se muestra solo
  // si además el usuario tiene el permiso/rol correspondiente. Ausente ⇒ default.
  ui: {
    // Tarjetas KPI del panel.
    dashboard_kpis: ['confirmandos', 'usuarios', 'grupos'],
    // Bloques del panel.
    dashboard_paneles: ['seguimiento_critico', 'proximos_encuentros', 'retencion'],
    // Módulos del menú que la parroquia oculta (por nombre de ruta). Vacío = ninguno.
    modulos_ocultos: [],
  },
}

// Listas blancas (espejo de fn_guardar_configuracion). El frontend es dueño de
// estas listas; una clave desconocida guardada es inofensiva (se ignora acá).
export const DASHBOARD_KPIS = ['confirmandos', 'usuarios', 'grupos']
export const DASHBOARD_PANELES = ['seguimiento_critico', 'proximos_encuentros', 'retencion']
// Módulos que se pueden ocultar (nombre de ruta). El resto es núcleo y no se toca.
export const MODULOS_OCULTABLES = ['cronograma', 'cumpleanos', 'sacramentos', 'requisitos']

// Etiqueta por defecto de un rol interno cuando la parroquia no definió una.
const ROLES_DEFAULT = {
  'proveedor': 'Proveedor',
  'super-admin': 'Administrador',
  'coordinador': 'Coordinador',
  'catequista': 'Catequista',
}
function prettify(rol) {
  return ROLES_DEFAULT[rol] || rol.replace(/(^|[-_\s])(\p{L})/gu, (_, s, c) => (s ? ' ' : '') + c.toUpperCase())
}

function safeParse(json) {
  try { return JSON.parse(json) } catch { return null }
}

// Merge de config: shallow arriba + deep en `ui` (que va creciendo en claves).
// Así toda clave nueva de `ui` queda cubierta por su default sin tocar esto.
function mergeConfig(incoming = {}) {
  const c = incoming || {}
  return {
    ...CONFIG_DEFAULTS,
    ...c,
    ui: { ...CONFIG_DEFAULTS.ui, ...(c.ui ?? {}) },
  }
}

function persist(state) {
  localStorage.setItem(LS_PARROQUIA_KEY, JSON.stringify({
    parroquia: state.parroquia,
    configuracion: state.configuracion,
  }))
}

export const useParroquiaStore = defineStore('parroquia', {
  state: () => {
    const saved = safeParse(localStorage.getItem(LS_PARROQUIA_KEY)) || {}
    return {
      parroquia: saved.parroquia ?? null,
      configuracion: mergeConfig(saved.configuracion),
      loading: false,
    }
  },

  getters: {
    branding: (s) => ({ ...CONFIG_DEFAULTS.branding, ...(s.configuracion?.branding ?? {}) }),
    tiposReunion: (s) => s.configuracion?.tipos_reunion ?? CONFIG_DEFAULTS.tipos_reunion,
    procedencias: (s) => s.configuracion?.procedencias ?? CONFIG_DEFAULTS.procedencias,
    nombreApp: (s) => s.configuracion?.branding?.nombre_publico || s.parroquia?.nombre || 'SGPC',
    roleLabel: (s) => (rol) => (s.configuracion?.roles_labels?.[rol]) || prettify(rol),
    dashboardKpis: (s) => s.configuracion?.ui?.dashboard_kpis ?? CONFIG_DEFAULTS.ui.dashboard_kpis,
    dashboardPaneles: (s) => s.configuracion?.ui?.dashboard_paneles ?? CONFIG_DEFAULTS.ui.dashboard_paneles,
    // La procedencia (sede/caserío) solo aporta si la parroquia usa más de una.
    usaProcedencia: (s) => (s.configuracion?.procedencias ?? CONFIG_DEFAULTS.procedencias).length > 1,
    // true si la parroquia ocultó ese módulo del menú (por nombre de ruta).
    moduloOculto: (s) => (nombreRuta) => (s.configuracion?.ui?.modulos_ocultos ?? []).includes(nombreRuta),
  },

  actions: {
    // Llamado tras el login con la respuesta del backend.
    hydrateFromLogin({ parroquia, configuracion }) {
      if (parroquia) this.parroquia = parroquia
      if (configuracion) this.configuracion = mergeConfig(configuracion)
      persist(this)
    },

    async fetchConfiguracion() {
      this.loading = true
      try {
        this.configuracion = mergeConfig(await getConfiguracion())
        persist(this)
      } catch (e) {
        console.error('No se pudo cargar la configuración de la parroquia', e)
      } finally {
        this.loading = false
      }
    },

    async save(payload) {
      try {
        const { configuracion } = await updateConfiguracion(payload)
        this.configuracion = mergeConfig(configuracion)
        persist(this)
        showAlerta('Configuración guardada', 'success')
        return true
      } catch (e) {
        showErroresDeValidacion(e?.response?.data?.errors || e)
        return false
      }
    },

    clear() {
      this.parroquia = null
      this.configuracion = mergeConfig()
      localStorage.removeItem(LS_PARROQUIA_KEY)
    },
  },
})
