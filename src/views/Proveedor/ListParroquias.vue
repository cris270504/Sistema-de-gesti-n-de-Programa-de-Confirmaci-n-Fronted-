<script setup>
import AppEmpty from '@/components/AppEmpty.vue'
import AppButton from '@/components/AppButton.vue'
import { ref, reactive, computed, onMounted, onUnmounted, onBeforeUnmount, nextTick, watch, defineAsyncComponent } from 'vue'
import { Modal } from 'bootstrap'
import {
  Plus, Check, X, Copy, Building2, KeyRound, Search, Clock, Upload, Image as ImageIcon, Wrench,
  BookOpen, LayoutTemplate, Globe, Trash2, Users, GraduationCap, Settings2, Bug, Info, History, AlertTriangle, RotateCcw,
} from 'lucide-vue-next'
import { showAlerta, confirmar, slugify } from '@/funciones'
import {
  listParroquias, crearParroquia, actualizarParroquia, getBrandingParroquia, setPlantillaParroquia,
  actualizarProgramaParroquia, eliminarParroquia, coincideNombreParroquia,
  listGestoresParroquia, listAuditoria, describirAuditoria, resumirErroresRecientes,
} from '@/services/proveedor'
import { resetUserPassword } from '@/services/users'
import { listErroresSistema } from '@/services/erroresSistema'
import { subirLogo, quitarLogo } from '@/services/branding'
import AppPage from '@/components/AppPage.vue'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { useSystemStatusStore } from '@/stores/systemStatus'
import { PROGRAMA_TIPOS, PERSONA_LABELS_DEFAULT } from '@/stores/parroquia'

// Panel de errores: se descarga y consulta solo al abrir la sección.
const ErroresSistema = defineAsyncComponent(() => import('./ErroresSistema.vue'))
const verErrores = ref(false)

const esMovil = useMediaQuery('(max-width: 767px)')

// --- Modo mantenimiento (bloquea a todo logueado que no sea proveedor) ---
const systemStatus = useSystemStatusStore()
const mensajeMantenimiento = ref('')
const alcanceMantenimiento = ref('todas') // 'todas' | 'parroquias'
const parroquiasSeleccionadas = ref([]) // ids, solo si alcanceMantenimiento === 'parroquias'
onMounted(() => { systemStatus.fetchStatus() })

// Una parroquia inactiva ya no deja entrar a sus usuarios (bloqueo aparte, en
// el login) -- no tiene sentido ofrecerla como blanco del mantenimiento.
const parroquiasParaMantenimiento = computed(() => parroquias.value.filter(p => p.activa))

const nombresSeleccionados = computed(() =>
  parroquiasParaMantenimiento.value.filter(p => parroquiasSeleccionadas.value.includes(p.id)).map(p => p.nombre))

const toggleParroquiaSeleccionada = (id) => {
  const i = parroquiasSeleccionadas.value.indexOf(id)
  if (i === -1) parroquiasSeleccionadas.value.push(id)
  else parroquiasSeleccionadas.value.splice(i, 1)
}

const toggleMantenimiento = async () => {
  if (systemStatus.mantenimiento) {
    const seguro = await confirmar({
      titulo: '¿Desactivar mantenimiento?',
      texto: 'Todas las personas logueadas van a poder volver a usar el sistema normalmente.',
      icono: 'question',
      confirmarTexto: 'Sí, desactivar',
      cancelarTexto: 'Cancelar'
    })
    if (!seguro) return
    try {
      await systemStatus.desactivar()
      showAlerta('Mantenimiento desactivado.', 'success')
      cargarAuditoria()
    } catch (e) {
      showAlerta(e?.message || 'No se pudo desactivar el mantenimiento', 'error')
    }
    return
  }

  if (alcanceMantenimiento.value === 'parroquias' && parroquiasSeleccionadas.value.length === 0) {
    showAlerta('Elegí al menos una parroquia, o cambiá el alcance a "Todas".', 'warning')
    return
  }

  const destino = alcanceMantenimiento.value === 'todas'
    ? 'Todas las personas logueadas (de todas las parroquias, menos vos)'
    : `Las personas logueadas de: ${nombresSeleccionados.value.join(', ')}`

  const seguro = await confirmar({
    titulo: '¿Activar mantenimiento?',
    texto: `${destino} van a quedar bloqueadas con una pantalla de mantenimiento hasta que lo desactives.`,
    icono: 'warning',
    confirmarTexto: 'Sí, activar',
    cancelarTexto: 'Cancelar'
  })
  if (!seguro) return
  try {
    await systemStatus.activar(mensajeMantenimiento.value.trim() || null, {
      alcance: alcanceMantenimiento.value,
      parroquia_ids: parroquiasSeleccionadas.value,
    })
    showAlerta('Mantenimiento activado.', 'success')
    cargarAuditoria()
  } catch (e) {
    showAlerta(e?.message || 'No se pudo activar el mantenimiento', 'error')
  }
}

const ZONAS = ['America/Lima', 'America/Bogota', 'America/Guayaquil', 'America/La_Paz',
  'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Mexico_City', 'America/Caracas']

const SACRAMENTOS_META = [
  ['bautismo', 'Bautismo'],
  ['comunion', 'Primera Comunión'],
  ['confirmacion', 'Confirmación'],
]
const SAC_CLAVES = SACRAMENTOS_META.map(([k]) => k)

const parroquias = ref([])
const loading = ref(true)
const saving = ref(false)
const q = ref('')

const formModalRef = ref(null)
const credsModalRef = ref(null)
const detalleModalRef = ref(null)
let formModal = null
let credsModal = null
let detalleModal = null

const credenciales = ref(null)
const errores = ref({})

// --- Alta ---
const form = reactive({
  nombre: '', slug: '', zona_horaria: 'America/Lima',
  admin_nombre: '', admin_email: '', admin_dni: '',
  sacramentos: [...SAC_CLAVES],
})
const nuevoLogo = ref(null)          // File elegido en el alta (se sube tras crear)
const nuevoLogoPreview = ref('')     // objectURL
const slugManual = ref(false)
const slugPreview = computed(() => (slugManual.value ? form.slug : slugify(form.nombre)))
watch(() => form.nombre, () => { if (!slugManual.value) form.slug = slugify(form.nombre) })

// --- Detalle / edición ---
const edit = reactive({ id: null, nombre: '', slug: '', zona_horaria: '', activa: true, es_plantilla: false, created_at: null, users_count: 0, grupos_count: 0, confirmandos_count: 0 })
const editSlugManual = ref(false)
const editErrores = ref({})
const savingEdit = ref(false)
const marcandoPlantilla = ref(false)

// Branding en el detalle (ranura 'proveedor').
const editBranding = reactive({ logo_url: '', logo_url_proveedor: '' })
const editPrograma = reactive({ tipo: 'confirmacion', nombre_otro: '', persona_singular: '', persona_plural: '' })
const editPersonaDefault = computed(() => PERSONA_LABELS_DEFAULT[editPrograma.tipo] || PERSONA_LABELS_DEFAULT.confirmacion)
const editLogoInput = ref(null)
const editLogoSubiendo = ref(false)
const editLogoLocal = ref('')
const editLogoPreview = computed(() =>
  editLogoLocal.value || editBranding.logo_url_proveedor || editBranding.logo_url || '')

function limpiarLocales() {
  if (nuevoLogoPreview.value) URL.revokeObjectURL(nuevoLogoPreview.value)
  if (editLogoLocal.value) URL.revokeObjectURL(editLogoLocal.value)
  nuevoLogoPreview.value = ''
  editLogoLocal.value = ''
}
onBeforeUnmount(limpiarLocales)

function onNuevoLogo(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (nuevoLogoPreview.value) URL.revokeObjectURL(nuevoLogoPreview.value)
  nuevoLogo.value = file
  nuevoLogoPreview.value = URL.createObjectURL(file)
}

function quitarNuevoLogo() {
  if (nuevoLogoPreview.value) URL.revokeObjectURL(nuevoLogoPreview.value)
  nuevoLogo.value = null
  nuevoLogoPreview.value = ''
}

async function onEditLogo(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file || !edit.id) return
  editLogoSubiendo.value = true
  if (editLogoLocal.value) URL.revokeObjectURL(editLogoLocal.value)
  editLogoLocal.value = URL.createObjectURL(file)
  try {
    const { branding } = await subirLogo({
      parroquiaId: edit.id, slot: 'proveedor', file, urlAnterior: editBranding.logo_url_proveedor,
    })
    editBranding.logo_url = branding?.logo_url ?? ''
    editBranding.logo_url_proveedor = branding?.logo_url_proveedor ?? ''
    showAlerta('Logo del proveedor actualizado', 'success')
  } catch (err) {
    showAlerta(err.message || 'No se pudo subir el logo', 'error')
  } finally {
    if (editLogoLocal.value) URL.revokeObjectURL(editLogoLocal.value)
    editLogoLocal.value = ''
    editLogoSubiendo.value = false
  }
}

async function quitarEditLogo() {
  const ok = await confirmar({
    titulo: '¿Quitar el logo base?',
    texto: editBranding.logo_url
      ? 'La parroquia seguirá viendo el logo que subió su administrador.'
      : 'La parroquia quedará con el logo por defecto del sistema.',
    icono: 'warning', confirmarTexto: 'Sí, quitar',
  })
  if (!ok) return
  editLogoSubiendo.value = true
  try {
    const { branding } = await quitarLogo({
      parroquiaId: edit.id, slot: 'proveedor', urlAnterior: editBranding.logo_url_proveedor,
    })
    editBranding.logo_url = branding?.logo_url ?? ''
    editBranding.logo_url_proveedor = branding?.logo_url_proveedor ?? ''
    showAlerta('Logo base quitado', 'success')
  } catch (err) {
    showAlerta(err.message || 'No se pudo quitar el logo', 'error')
  } finally {
    editLogoSubiendo.value = false
  }
}

const resumen = computed(() => ({
  activas: parroquias.value.filter(p => p.activa).length,
  inactivas: parroquias.value.filter(p => !p.activa).length,
}))

const totales = computed(() => parroquias.value.reduce((acc, p) => ({
  usuarios: acc.usuarios + (Number(p.users_count) || 0),
  grupos: acc.grupos + (Number(p.grupos_count) || 0),
  confirmandos: acc.confirmandos + (Number(p.confirmandos_count) || 0),
}), { usuarios: 0, grupos: 0, confirmandos: 0 }))

const FILTROS_ESTADO = [
  { value: 'todas', label: 'Todas' },
  { value: 'activas', label: 'Activas' },
  { value: 'inactivas', label: 'Inactivas' },
]
const filtroEstado = ref('todas')

// "Parroquia Sagrado Corazón de Jesús" → "SC" (sin la palabra Parroquia ni conectores).
const iniciales = (nombre = '') => nombre
  .replace(/^parroquia\s+/i, '')
  .split(/\s+/).filter(w => w.length > 2)
  .slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

const parroquiasFiltradas = computed(() => {
  const t = q.value.trim().toLowerCase()
  const base = parroquias.value.filter(p =>
    (filtroEstado.value === 'todas' || (filtroEstado.value === 'activas') === !!p.activa)
    && (!t || p.nombre.toLowerCase().includes(t) || (p.slug || '').toLowerCase().includes(t)))
  // Activas primero; el backend ya ordena por nombre dentro de cada grupo.
  return base.sort((a, b) => Number(b.activa) - Number(a.activa))
})

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function cargar() {
  loading.value = true
  try {
    parroquias.value = await listParroquias()
  } finally {
    loading.value = false
  }
  cargarAuditoria()
}

// ── Historial de acciones del proveedor ──────────────────────────────────
const auditoria = ref([])
const auditoriaError = ref(false)
async function cargarAuditoria() {
  try {
    auditoria.value = await listAuditoria({ limite: 30 })
    auditoriaError.value = false
  } catch {
    auditoriaError.value = true
  }
}
const auditoriaVista = computed(() => auditoria.value.map(f => ({ ...f, ...describirAuditoria(f) })))

function hace(iso) {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return `hace ${d} d`
  return fmtFecha(iso)
}

// ── Errores de las últimas 24 h (aviso) ──────────────────────────────────
const erroresRecientes = ref({ total: 0, parroquias: [] })
const erroresRef = ref(null)
async function cargarErroresRecientes() {
  try {
    const filas = await listErroresSistema({ desdeDias: 1 })
    erroresRecientes.value = resumirErroresRecientes(filas, parroquias.value)
  } catch { /* el aviso es secundario: sin él, el panel sigue disponible */ }
}
function verErroresAhora() {
  if (erroresRef.value) {
    erroresRef.value.open = true
    erroresRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

onMounted(async () => {
  await cargar()
  cargarErroresRecientes()
})
onUnmounted(() => {
  formModal?.dispose()
  credsModal?.dispose()
  detalleModal?.dispose()
})

function abrirAlta() {
  errores.value = {}
  slugManual.value = false
  quitarNuevoLogo()
  Object.assign(form, {
    nombre: '', slug: '', zona_horaria: 'America/Lima',
    admin_nombre: '', admin_email: '', admin_dni: '',
    sacramentos: [...SAC_CLAVES],
  })
  nextTick(() => {
    formModal ??= new Modal(formModalRef.value, { backdrop: 'static' })
    formModal.show()
  })
}

async function crear() {
  if (form.sacramentos.length === 0) {
    showAlerta('Elige al menos un sacramento a gestionar.', 'warning')
    return
  }
  saving.value = true
  errores.value = {}
  try {
    const payload = {
      nombre: form.nombre,
      zona_horaria: form.zona_horaria,
      admin_nombre: form.admin_nombre,
      admin_email: form.admin_email,
      sacramentos: SAC_CLAVES.filter(k => form.sacramentos.includes(k)),
    }
    const slug = (slugManual.value ? form.slug : slugPreview.value).trim()
    if (slug) payload.slug = slug
    if (form.admin_dni.trim()) payload.admin_dni = form.admin_dni.trim()

    const res = await crearParroquia(payload)

    // Logo (opcional): la parroquia ya existe, subimos a la ranura del proveedor.
    if (nuevoLogo.value && res?.parroquia?.id) {
      try {
        await subirLogo({ parroquiaId: res.parroquia.id, slot: 'proveedor', file: nuevoLogo.value })
      } catch (err) {
        showAlerta(`Parroquia creada, pero el logo no se pudo subir: ${err.message}`, 'warning')
      }
    }
    quitarNuevoLogo()

    formModal?.hide()
    credenciales.value = { parroquia: res.parroquia.nombre, ...res.admin }
    await nextTick()
    credsModal ??= new Modal(credsModalRef.value, { backdrop: 'static' })
    credsModal.show()
    await cargar()
  } catch (e) {
    errores.value = e?.response?.data?.errors || {}
    if (!Object.keys(errores.value).length) showAlerta(e?.message || 'No se pudo crear la parroquia', 'error')
  } finally {
    saving.value = false
  }
}

async function abrirDetalle(p) {
  editErrores.value = {}
  editSlugManual.value = false
  Object.assign(edit, {
    id: p.id, nombre: p.nombre, slug: p.slug, zona_horaria: p.zona_horaria || 'America/Lima',
    activa: p.activa, es_plantilla: !!p.es_plantilla, created_at: p.created_at,
    users_count: p.users_count, grupos_count: p.grupos_count, confirmandos_count: p.confirmandos_count,
    nombreGuardado: p.nombre,
  })
  activaGuardada.value = p.activa
  confirmEliminar.value = ''
  cargarGestores(p.id)
  editBranding.logo_url = ''
  editBranding.logo_url_proveedor = ''
  editPrograma.tipo = 'confirmacion'
  editPrograma.nombre_otro = ''
  editPrograma.persona_singular = ''
  editPrograma.persona_plural = ''
  getBrandingParroquia(p.id)
    .then(({ branding, programa_tipo, programa_nombre_otro, persona_nombre_singular, persona_nombre_plural }) => {
      editBranding.logo_url = branding?.logo_url ?? ''
      editBranding.logo_url_proveedor = branding?.logo_url_proveedor ?? ''
      editPrograma.tipo = programa_tipo || 'confirmacion'
      editPrograma.nombre_otro = programa_nombre_otro || ''
      editPrograma.persona_singular = persona_nombre_singular || ''
      editPrograma.persona_plural = persona_nombre_plural || ''
    })
    .catch(() => { /* sin config aún */ })
  nextTick(() => {
    detalleModal ??= new Modal(detalleModalRef.value, { backdrop: 'static' })
    detalleModal.show()
  })
}

async function guardarDetalle() {
  if (editPrograma.tipo === 'otro' && !editPrograma.nombre_otro.trim()) {
    showAlerta('Indicá el nombre del programa', 'warning')
    return
  }
  savingEdit.value = true
  editErrores.value = {}
  try {
    const payload = {
      nombre: edit.nombre,
      slug: editSlugManual.value ? edit.slug : slugify(edit.nombre),
      zona_horaria: edit.zona_horaria,
      activa: edit.activa,
    }
    const { parroquia } = await actualizarParroquia(edit.id, payload)
    await actualizarProgramaParroquia(edit.id, {
      programa_tipo: editPrograma.tipo,
      programa_nombre_otro: editPrograma.nombre_otro.trim(),
      persona_nombre_singular: editPrograma.persona_singular.trim(),
      persona_nombre_plural: editPrograma.persona_plural.trim(),
    })
    const i = parroquias.value.findIndex(p => p.id === edit.id)
    if (i !== -1) parroquias.value[i] = { ...parroquias.value[i], ...parroquia }
    detalleModal?.hide()
    showAlerta('Parroquia actualizada', 'success')
    cargarAuditoria()
  } catch (e) {
    editErrores.value = e?.response?.data?.errors || {}
    if (!Object.keys(editErrores.value).length) showAlerta(e?.message || 'No se pudo guardar', 'error')
  } finally {
    savingEdit.value = false
  }
}

// ── Eliminar parroquia (zona de peligro) ───────────────────────────────────
// Solo con la parroquia ya desactivada (estado guardado, no el interruptor del
// formulario) y escribiendo su nombre. La BD vuelve a validar todo.
const activaGuardada = ref(true)
const confirmEliminar = ref('')
const eliminando = ref(false)
const puedeEliminar = computed(() =>
  !activaGuardada.value && !edit.es_plantilla && coincideNombreParroquia(confirmEliminar.value, edit.nombreGuardado))

async function eliminarDetalle() {
  if (!puedeEliminar.value || eliminando.value) return
  eliminando.value = true
  try {
    const res = await eliminarParroquia(edit.id, confirmEliminar.value)
    parroquias.value = parroquias.value.filter(p => p.id !== edit.id)
    cargarAuditoria()
    detalleModal?.hide()
    const avisos = res?.avisos ?? []
    showAlerta(avisos.length ? `${res.message} ${avisos.join(' ')}` : res?.message || 'Parroquia eliminada',
      avisos.length ? 'warning' : 'success')
  } catch (e) {
    showAlerta(e?.message || 'No se pudo eliminar la parroquia', 'error')
  } finally {
    eliminando.value = false
  }
}

async function marcarComoPlantilla() {
  if (edit.es_plantilla || marcandoPlantilla.value) return
  const ok = await confirmar({
    titulo: `¿Usar «${edit.nombre}» como plantilla?`,
    texto: 'Las parroquias nuevas copiarán de esta su ruta sacramental (sacramentos y documentos). Reemplaza a la plantilla actual.',
    icono: 'question',
    confirmarTexto: 'Sí, usar como plantilla',
  })
  if (!ok) return
  marcandoPlantilla.value = true
  try {
    await setPlantillaParroquia(edit.id)
    parroquias.value.forEach(p => { p.es_plantilla = p.id === edit.id })
    edit.es_plantilla = true
    showAlerta('Plantilla actualizada', 'success')
    cargarAuditoria()
  } catch (e) {
    showAlerta(e.message || 'No se pudo marcar como plantilla', 'error')
  } finally {
    marcandoPlantilla.value = false
  }
}

async function cambiarEstado(p) {
  const activar = !p.activa
  const ok = await confirmar({
    titulo: activar ? `¿Activar «${p.nombre}»?` : `¿Desactivar «${p.nombre}»?`,
    texto: activar
      ? 'Sus usuarios volverán a poder entrar al sistema.'
      : 'Sus usuarios NO podrán iniciar sesión mientras esté desactivada.',
    icono: activar ? 'question' : 'warning',
    confirmarTexto: activar ? 'Sí, activar' : 'Sí, desactivar',
  })
  if (!ok) return

  try {
    await actualizarParroquia(p.id, { activa: activar })
    p.activa = activar
    showAlerta(activar ? 'Parroquia activada' : 'Parroquia desactivada', 'success')
    cargarAuditoria()
  } catch (e) {
    showAlerta(e?.message || 'No se pudo cambiar el estado', 'error')
  }
}

// ── Administradores de la parroquia (restablecer contraseña) ───────────
const gestores = ref([])
const cargandoGestores = ref(false)
const gestoresError = ref('')
const reseteandoId = ref(null)
const claveTemporal = ref(null) // { id, name, temp_password }
const ETIQUETA_ROL = { 'super-admin': 'Administrador', coordinador: 'Coordinador' }

async function cargarGestores(parroquiaId) {
  gestores.value = []
  gestoresError.value = ''
  claveTemporal.value = null
  cargandoGestores.value = true
  try {
    gestores.value = await listGestoresParroquia(parroquiaId)
  } catch (e) {
    gestoresError.value = e?.message || 'No se pudieron cargar los administradores.'
  } finally {
    cargandoGestores.value = false
  }
}

async function restablecerClave(u) {
  if (reseteandoId.value) return
  const ok = await confirmar({
    titulo: `¿Restablecer la contraseña de ${u.name}?`,
    texto: 'Se generará una contraseña temporal. Su contraseña actual dejará de funcionar y tendrá que elegir una nueva al entrar.',
    icono: 'warning',
    confirmarTexto: 'Sí, restablecer',
  })
  if (!ok) return
  reseteandoId.value = u.id
  try {
    const res = await resetUserPassword(u.id)
    claveTemporal.value = { id: u.id, name: u.name, temp_password: res?.temp_password }
    cargarAuditoria()
  } catch (e) {
    showAlerta(e?.message || 'No se pudo restablecer la contraseña', 'error')
  } finally {
    reseteandoId.value = null
  }
}

function copiar(txt) {
  navigator.clipboard?.writeText(txt)
  showAlerta('Copiado', 'success')
}
</script>

<template>
  <AppPage title="Parroquias" subtitle="Consola de la plataforma: parroquias, acceso y mantenimiento" :loading="loading">
    <template #actions>
      <AppButton :icon="Plus" @click="abrirAlta">Nueva parroquia</AppButton>
    </template>

    <!-- Resumen de la plataforma -->
    <section class="lp-kpis" aria-label="Resumen de la plataforma">
      <article class="lp-kpi">
        <span class="lp-kpi__ico" aria-hidden="true"><Building2 :size="18" /></span>
        <div class="lp-kpi__body">
          <span class="lp-kpi__label">Parroquias</span>
          <span class="lp-kpi__valor">{{ parroquias.length }}</span>
          <span class="lp-kpi__meta">
            <span class="lp-dot lp-dot--on" aria-hidden="true"></span> {{ resumen.activas }} activas
            <span class="lp-dot lp-dot--off lp-kpi__sep" aria-hidden="true"></span> {{ resumen.inactivas }} inactivas
          </span>
        </div>
      </article>
      <article class="lp-kpi">
        <span class="lp-kpi__ico" aria-hidden="true"><Users :size="18" /></span>
        <div class="lp-kpi__body">
          <span class="lp-kpi__label">Usuarios</span>
          <span class="lp-kpi__valor">{{ totales.usuarios }}</span>
          <span class="lp-kpi__meta">en todas las parroquias</span>
        </div>
      </article>
      <article class="lp-kpi">
        <span class="lp-kpi__ico" aria-hidden="true"><GraduationCap :size="18" /></span>
        <div class="lp-kpi__body">
          <span class="lp-kpi__label">Jóvenes</span>
          <span class="lp-kpi__valor">{{ totales.confirmandos }}</span>
          <span class="lp-kpi__meta">en {{ totales.grupos }} grupos</span>
        </div>
      </article>
      <article class="lp-kpi" :class="{ 'lp-kpi--alerta': systemStatus.mantenimiento }">
        <span class="lp-kpi__ico" aria-hidden="true"><Wrench :size="18" /></span>
        <div class="lp-kpi__body">
          <span class="lp-kpi__label">Mantenimiento</span>
          <span class="lp-kpi__valor lp-kpi__valor--txt">{{ systemStatus.mantenimiento ? 'Activado' : 'Apagado' }}</span>
          <span class="lp-kpi__meta">
            {{ systemStatus.mantenimiento
              ? (systemStatus.alcance === 'todas' ? 'Bloquea todas las parroquias' : 'Bloquea parroquias elegidas')
              : 'Todos pueden entrar' }}
          </span>
        </div>
      </article>
    </section>

    <!-- Aviso: errores de la app en las últimas 24 h -->
    <div v-if="erroresRecientes.total > 0" class="lp-aviso" role="status">
      <AlertTriangle :size="18" class="lp-aviso__ico" aria-hidden="true" />
      <p class="lp-aviso__txt">
        <b>{{ erroresRecientes.total }} {{ erroresRecientes.total === 1 ? 'error' : 'errores' }} en las últimas 24 h</b>
        <span>
          {{ erroresRecientes.parroquias.slice(0, 3).map(x => `${x.nombre} (${x.n})`).join(' · ') }}
          <template v-if="erroresRecientes.parroquias.length > 3"> · y {{ erroresRecientes.parroquias.length - 3 }} más</template>
        </span>
      </p>
      <AppButton variant="secondary" size="sm" @click="verErroresAhora">Ver errores</AppButton>
    </div>

    <div class="lp-layout">
      <!-- Parroquias -->
      <section class="lp-main surface" aria-labelledby="lp-lista-titulo">
        <header class="lp-toolbar">
          <h2 id="lp-lista-titulo" class="lp-toolbar__titulo">
            Listado <span class="lp-toolbar__n">{{ parroquiasFiltradas.length }}</span>
          </h2>
          <div class="lp-seg lp-seg--neutro" role="radiogroup" aria-label="Filtrar por estado">
            <button v-for="f in FILTROS_ESTADO" :key="f.value" type="button" role="radio"
              class="lp-seg__opt" :class="{ 'lp-seg__opt--on': filtroEstado === f.value }"
              :aria-checked="filtroEstado === f.value" @click="filtroEstado = f.value">{{ f.label }}</button>
          </div>
          <label class="lp-search">
            <span class="lp-sr">Buscar parroquia</span>
            <Search :size="15" aria-hidden="true" />
            <input v-model="q" type="search" placeholder="Buscar por nombre o slug…" />
          </label>
        </header>

        <AppEmpty v-if="parroquiasFiltradas.length === 0" :icon="Building2"
          :message="q || filtroEstado !== 'todas' ? 'Ninguna parroquia coincide con el filtro.' : 'Aún no hay parroquias.'">
          <AppButton v-if="!q && filtroEstado === 'todas'" :icon="Plus" @click="abrirAlta">Nueva parroquia</AppButton>
        </AppEmpty>

        <!-- Celular: tarjetas -->
        <div v-else-if="esMovil" class="lp-cards">
          <article v-for="p in parroquiasFiltradas" :key="p.id" class="lp-card" :class="{ 'lp-card--off': !p.activa }">
            <button type="button" class="lp-card__abrir" :aria-label="`Ver y configurar ${p.nombre}`"
              @click="abrirDetalle(p)">
              <span class="lp-par__avatar" aria-hidden="true">{{ iniciales(p.nombre) }}</span>
              <span class="lp-par__txt">
                <span class="lp-par__nombre">{{ p.nombre }}</span>
                <span class="lp-par__slug">{{ p.slug }}</span>
              </span>
            </button>
            <div class="lp-card__stats">
              <span><b>{{ p.users_count }}</b> usuarios</span>
              <span><b>{{ p.grupos_count }}</b> grupos</span>
              <span><b>{{ p.confirmandos_count }}</b> jóvenes</span>
            </div>
            <div class="lp-card__pie">
              <span v-if="p.es_plantilla" class="lp-tag"><LayoutTemplate :size="12" aria-hidden="true" /> Plantilla</span>
              <button type="button" class="lp-estado" :class="p.activa ? 'lp-estado--on' : 'lp-estado--off'"
                @click="cambiarEstado(p)">
                <Check v-if="p.activa" :size="12" aria-hidden="true" /><X v-else :size="12" aria-hidden="true" />
                {{ p.activa ? 'Activa' : 'Inactiva' }}
              </button>
            </div>
          </article>
        </div>

        <!-- Escritorio: tabla -->
        <div v-else class="table-wrap lp-tabla">
          <table class="mb-0">
            <thead>
              <tr>
                <th class="pl-4">Parroquia</th>
                <th class="!text-right">Usuarios</th>
                <th class="!text-right">Grupos</th>
                <th class="!text-right">Jóvenes</th>
                <th>Creada</th>
                <th>Estado</th>
                <th class="pr-4"><span class="lp-sr">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in parroquiasFiltradas" :key="p.id" class="lp-fila" :class="{ 'lp-row--off': !p.activa }"
                @click="abrirDetalle(p)">
                <td class="pl-4">
                  <div class="lp-par">
                    <span class="lp-par__avatar" aria-hidden="true">{{ iniciales(p.nombre) }}</span>
                    <span class="lp-par__txt">
                      <span class="lp-par__nombre">
                        {{ p.nombre }}
                        <span v-if="p.es_plantilla" class="lp-tag"><LayoutTemplate :size="12" aria-hidden="true" /> Plantilla</span>
                      </span>
                      <span class="lp-par__slug">{{ p.slug }}</span>
                    </span>
                  </div>
                </td>
                <td class="!text-right lp-num">{{ p.users_count }}</td>
                <td class="!text-right lp-num">{{ p.grupos_count }}</td>
                <td class="!text-right lp-num">{{ p.confirmandos_count }}</td>
                <td class="lp-fecha">{{ fmtFecha(p.created_at) }}</td>
                <td>
                  <button type="button" class="lp-estado" :class="p.activa ? 'lp-estado--on' : 'lp-estado--off'"
                    :title="p.activa ? 'Clic para desactivar' : 'Clic para activar'" @click.stop="cambiarEstado(p)">
                    <Check v-if="p.activa" :size="12" aria-hidden="true" /><X v-else :size="12" aria-hidden="true" />
                    {{ p.activa ? 'Activa' : 'Inactiva' }}
                  </button>
                </td>
                <td class="pr-4 !text-right">
                  <AppButton variant="ghost" size="sm" :icon="Settings2" :aria-label="`Configurar ${p.nombre}`"
                    @click.stop="abrirDetalle(p)">Configurar</AppButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="lp-side">
      <!-- Mantenimiento: bloquea a todo logueado que no sea proveedor -->
      <aside class="lp-mant" :class="{ 'lp-mant--on': systemStatus.mantenimiento }" aria-labelledby="lp-mant-titulo">
        <header class="lp-mant__head">
          <Wrench :size="17" aria-hidden="true" />
          <h2 id="lp-mant-titulo" class="lp-mant__titulo">Modo mantenimiento</h2>
          <span class="lp-mant__pill">{{ systemStatus.mantenimiento ? 'Activado' : 'Apagado' }}</span>
        </header>

        <template v-if="systemStatus.mantenimiento">
          <p class="lp-mant__txt">
            Bloquea a:
            <b v-if="systemStatus.alcance === 'todas'">todas las parroquias</b>
            <b v-else>{{ parroquias.filter(p => systemStatus.parroquiaIds.includes(p.id)).map(p => p.nombre).join(', ') || '—' }}</b>
          </p>
          <p v-if="systemStatus.mensaje" class="lp-mant__txt">Mensaje: «{{ systemStatus.mensaje }}»</p>
        </template>

        <template v-else>
          <p class="lp-mant__txt">Muestra una pantalla de mantenimiento a todos menos a ti, hasta que lo apagues.</p>
          <div class="lp-seg lp-seg--full" role="radiogroup" aria-label="Alcance del mantenimiento">
            <button type="button" class="lp-seg__opt" :class="{ 'lp-seg__opt--on': alcanceMantenimiento === 'todas' }"
              role="radio" :aria-checked="alcanceMantenimiento === 'todas'" @click="alcanceMantenimiento = 'todas'">
              Todas
            </button>
            <button type="button" class="lp-seg__opt" :class="{ 'lp-seg__opt--on': alcanceMantenimiento === 'parroquias' }"
              role="radio" :aria-checked="alcanceMantenimiento === 'parroquias'" @click="alcanceMantenimiento = 'parroquias'">
              Algunas
            </button>
          </div>
          <div v-if="alcanceMantenimiento === 'parroquias'" class="lp-mant__chips">
            <button v-for="p in parroquiasParaMantenimiento" :key="p.id" type="button" class="lp-chip"
              :class="{ 'lp-chip--on': parroquiasSeleccionadas.includes(p.id) }"
              :aria-pressed="parroquiasSeleccionadas.includes(p.id)"
              @click="toggleParroquiaSeleccionada(p.id)">
              <Check v-if="parroquiasSeleccionadas.includes(p.id)" :size="12" aria-hidden="true" />
              {{ p.nombre }}
            </button>
            <span v-if="parroquiasParaMantenimiento.length === 0" class="lp-mant__txt">No hay parroquias activas.</span>
          </div>
          <label class="lp-mant__label" for="lp-mant-msg">Mensaje <span>(opcional)</span></label>
          <input id="lp-mant-msg" v-model="mensajeMantenimiento" type="text" maxlength="200"
            class="lp-mant__input" placeholder="Ej: volvemos a las 3 p. m." />
        </template>

        <AppButton block :variant="systemStatus.mantenimiento ? 'primary' : 'danger'" :loading="systemStatus.saving"
          @click="toggleMantenimiento">
          {{ systemStatus.mantenimiento ? 'Apagar mantenimiento' : 'Activar mantenimiento' }}
        </AppButton>
      </aside>

      <!-- Historial de acciones del proveedor -->
      <section class="lp-hist" aria-labelledby="lp-hist-titulo">
        <header class="lp-hist__head">
          <History :size="17" aria-hidden="true" />
          <h2 id="lp-hist-titulo" class="lp-hist__titulo">Actividad reciente</h2>
          <button type="button" class="lp-link" @click="cargarAuditoria">Actualizar</button>
        </header>
        <p v-if="auditoriaError" class="lp-hist__vacio">No se pudo cargar el historial.</p>
        <p v-else-if="auditoriaVista.length === 0" class="lp-hist__vacio">
          Aquí verás lo que hagas: crear, editar o eliminar parroquias, mantenimiento y contraseñas.
        </p>
        <ol v-else class="lp-hist__lista">
          <li v-for="f in auditoriaVista" :key="f.id" class="lp-hist__item" :class="`lp-hist__item--${f.accion}`">
            <span class="lp-hist__punto" aria-hidden="true"></span>
            <div class="lp-hist__txt">
              <p class="lp-hist__linea">{{ f.accion }} <b v-if="f.objetivo">{{ f.objetivo }}</b> <span v-if="f.extra">{{ f.extra }}</span></p>
              <span class="lp-hist__meta">
                <time :datetime="f.created_at" :title="new Date(f.created_at).toLocaleString('es-ES')">{{ hace(f.created_at) }}</time>
                <template v-if="f.actor_nombre"> · {{ f.actor_nombre }}</template>
              </span>
            </div>
          </li>
        </ol>
      </section>
      </div>
    </div>

    <!-- Errores del frontend de todas las parroquias -->
    <details ref="erroresRef" class="lp-errores surface surface--pad" @toggle="verErrores = $event.target.open">
      <summary class="lp-errores__summary">
        <Bug :size="16" aria-hidden="true" /> Errores del sistema
        <span v-if="erroresRecientes.total > 0" class="lp-errores__badge">{{ erroresRecientes.total }} en 24 h</span>
        <span class="lp-errores__hint">Fallos de la app en todas las parroquias</span>
      </summary>
      <ErroresSistema v-if="verErrores" :parroquias="parroquias" class="lp-errores__panel" />
    </details>
  </AppPage>

  <!-- Modales (fuera del slot condicionado por :loading de AppPage) -->
  <div>
    <!-- Modal: alta de parroquia -->
    <div class="modal fade" ref="formModalRef" tabindex="-1" aria-hidden="true" aria-labelledby="lp-alta-titulo">
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <span class="modal-header__icon" aria-hidden="true"><Building2 :size="18" /></span>
            <div class="modal-header__text">
              <h5 id="lp-alta-titulo" class="modal-title">Nueva parroquia</h5>
              <p class="modal-subtitle">Crea la parroquia, su ruta sacramental y su primer administrador</p>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" :disabled="saving" aria-label="Cerrar"></button>
          </div>
          <form class="lp-form" @submit.prevent="crear">
            <div class="modal-body lp-cols">
              <section class="lp-col" aria-labelledby="lp-alta-parroquia">
                <h6 id="lp-alta-parroquia" class="lp-col__titulo"><Building2 :size="15" aria-hidden="true" /> La parroquia</h6>
                <div class="lp-grid2">
                  <label class="lp-campo lp-span2"><span>Nombre de la parroquia <span class="lp-req">*</span></span>
                    <input v-model="form.nombre" required maxlength="150" />
                    <small v-if="errores.nombre" class="lp-err">{{ errores.nombre[0] }}</small>
                  </label>
                  <label class="lp-campo">
                    <span class="lp-campo__fila">
                      Slug (URL)
                      <button type="button" class="lp-link"
                        @click="slugManual = !slugManual; !slugManual && (form.slug = slugify(form.nombre))">
                        {{ slugManual ? 'Autogenerar' : 'Personalizar' }}
                      </button>
                    </span>
                    <input v-model="form.slug" maxlength="80" :readonly="!slugManual"
                      class="font-monospace" :class="{ 'lp-readonly': !slugManual }" />
                    <small v-if="errores.slug" class="lp-err">{{ errores.slug[0] }}</small>
                  </label>
                  <label class="lp-campo">Zona horaria
                    <select v-model="form.zona_horaria">
                      <option v-for="z in ZONAS" :key="z" :value="z">{{ z }}</option>
                    </select>
                  </label>
                </div>
                <fieldset class="lp-campo lp-fieldset">
                  <legend>Sacramentos que gestionará</legend>
                  <div class="lp-sacs">
                    <label v-for="[clave, label] in SACRAMENTOS_META" :key="clave" class="lp-sac"
                      :class="{ 'lp-sac--on': form.sacramentos.includes(clave) }">
                      <input type="checkbox" :value="clave" v-model="form.sacramentos" />
                      <Check v-if="form.sacramentos.includes(clave)" :size="13" aria-hidden="true" /> {{ label }}
                    </label>
                  </div>
                  <small class="lp-ayuda">Se copian de la parroquia plantilla, con sus documentos.</small>
                </fieldset>
              </section>

              <section class="lp-col" aria-labelledby="lp-alta-admin">
                <h6 id="lp-alta-admin" class="lp-col__titulo"><KeyRound :size="15" aria-hidden="true" /> Primer administrador</h6>
                <div class="lp-grid2">
                  <label class="lp-campo lp-span2"><span>Nombre completo <span class="lp-req">*</span></span>
                    <input v-model="form.admin_nombre" required maxlength="100" autocomplete="off" />
                  </label>
                  <label class="lp-campo"><span>Correo <span class="lp-req">*</span></span>
                    <input v-model="form.admin_email" type="email" required autocomplete="off" />
                    <small v-if="errores.admin_email" class="lp-err">{{ errores.admin_email[0] }}</small>
                  </label>
                  <label class="lp-campo"><span>DNI <span class="lp-opc">(opcional)</span></span>
                    <input v-model="form.admin_dni" maxlength="20" inputmode="numeric" autocomplete="off" />
                    <small v-if="errores.admin_dni" class="lp-err">{{ errores.admin_dni[0] }}</small>
                  </label>
                </div>
                <p class="lp-nota"><Info :size="14" aria-hidden="true" /> Al crearla verás una contraseña temporal
                  para entregarle. Solo se muestra una vez, y tendrá que elegir una propia al entrar.</p>

                <div class="lp-campo">
                  <span>Logo <span class="lp-opc">(opcional)</span></span>
                  <div class="lp-logo-fila">
                    <div class="lp-logobox lp-logobox--lg">
                      <img v-if="nuevoLogoPreview" :src="nuevoLogoPreview" alt="Vista previa del logo" />
                      <ImageIcon v-else :size="20" class="text-slate-300" aria-hidden="true" />
                    </div>
                    <div class="lp-logo-fila__acc">
                      <input ref="nuevoLogoInput" type="file" accept="image/png,image/jpeg,image/webp"
                        class="lp-file" @change="onNuevoLogo" />
                      <div class="flex flex-wrap items-center gap-2">
                        <AppButton variant="secondary" size="sm" :icon="Upload" type="button"
                          @click="$refs.nuevoLogoInput.click()">Elegir imagen</AppButton>
                        <button v-if="nuevoLogo" type="button" class="lp-link" @click="quitarNuevoLogo">Quitar</button>
                      </div>
                      <small class="lp-ayuda">PNG, JPG o WebP. El admin podrá reemplazarlo.</small>
                    </div>
                  </div>
                </div>
              </section>
            </div>
            <div class="modal-footer">
              <AppButton variant="secondary" type="button" data-bs-dismiss="modal" :disabled="saving">Cancelar</AppButton>
              <AppButton type="submit" :loading="saving">{{ saving ? 'Creando…' : 'Crear parroquia' }}</AppButton>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Modal: detalle / edición -->
    <div class="modal fade" ref="detalleModalRef" tabindex="-1" aria-hidden="true" aria-labelledby="lp-det-titulo">
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
        <div class="modal-content">
          <div class="modal-header lp-modal-head">
            <span class="lp-par__avatar lp-par__avatar--lg" aria-hidden="true">{{ iniciales(edit.nombreGuardado || edit.nombre) }}</span>
            <div class="modal-header__text">
              <h5 id="lp-det-titulo" class="modal-title truncate">{{ edit.nombre }}</h5>
              <div class="lp-modal-head__slug">
                <span class="lp-modal-head__slugtxt"><Globe :size="11" class="inline flex-shrink-0" aria-hidden="true" /> {{ edit.slug }}</span>
                <span class="lp-modal-head__estado">
                  <span class="lp-dot" :class="edit.activa ? 'lp-dot--on' : 'lp-dot--off'" aria-hidden="true"></span>
                  {{ edit.activa ? 'Activa' : 'Inactiva' }}
                </span>
                <span class="lp-modal-head__estado"><Clock :size="11" aria-hidden="true" /> Creada {{ fmtFecha(edit.created_at) }}</span>
                <span v-if="edit.es_plantilla" class="lp-tag"><LayoutTemplate :size="12" aria-hidden="true" /> Plantilla</span>
              </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" :disabled="savingEdit" aria-label="Cerrar"></button>
          </div>
          <form class="lp-form" @submit.prevent="guardarDetalle">
            <div class="modal-body lp-det">
              <!-- Columna lateral: identidad y estado -->
              <aside class="lp-det__side">
                <div class="lp-stats">
                  <div><b>{{ edit.users_count }}</b><span>Usuarios</span></div>
                  <div><b>{{ edit.grupos_count }}</b><span>Grupos</span></div>
                  <div><b>{{ edit.confirmandos_count }}</b><span>Jóvenes</span></div>
                </div>

                <label class="lp-toggle-row" :class="{ 'lp-toggle-row--off': !edit.activa }">
                  <span>
                    <span class="lp-toggle-row__titulo">Parroquia activa</span>
                    <span class="lp-toggle-row__desc">
                      {{ edit.activa ? 'Sus usuarios entran con normalidad.' : 'Sus usuarios no podrán iniciar sesión.' }}
                    </span>
                  </span>
                  <span class="lp-switch">
                    <input type="checkbox" v-model="edit.activa" />
                    <span class="lp-switch__track"><span class="lp-switch__thumb"></span></span>
                  </span>
                </label>

                <section class="lp-bloque" aria-labelledby="lp-det-admins">
                  <h6 id="lp-det-admins" class="lp-bloque__titulo"><KeyRound :size="15" aria-hidden="true" /> Administradores</h6>
                  <p v-if="cargandoGestores" class="lp-ayuda">Cargando…</p>
                  <p v-else-if="gestoresError" class="lp-ayuda">{{ gestoresError }}</p>
                  <p v-else-if="gestores.length === 0" class="lp-ayuda">No tiene administradores ni coordinadores.</p>
                  <ul v-else class="lp-gestores">
                    <li v-for="u in gestores" :key="u.id" class="lp-gestor">
                      <div class="lp-gestor__txt">
                        <span class="lp-gestor__nombre">{{ u.name }}</span>
                        <span class="lp-gestor__meta">
                          {{ ETIQUETA_ROL[u.rol] }}<template v-if="!u.activo"> · desactivado</template>
                        </span>
                      </div>
                      <AppButton variant="ghost" size="sm" icon-only :icon="RotateCcw" type="button"
                        :loading="reseteandoId === u.id" :disabled="!u.activo || (reseteandoId !== null && reseteandoId !== u.id)"
                        :title="u.activo ? 'Restablecer contraseña' : 'Está desactivado'"
                        :aria-label="`Restablecer la contraseña de ${u.name}`" @click="restablecerClave(u)" />
                    </li>
                  </ul>
                  <div v-if="claveTemporal" class="lp-clave" role="status">
                    <span class="lp-clave__txt">Contraseña temporal de <b>{{ claveTemporal.name }}</b>:</span>
                    <span class="lp-clave__fila">
                      <code>{{ claveTemporal.temp_password }}</code>
                      <AppButton variant="ghost" size="sm" icon-only :icon="Copy" type="button"
                        aria-label="Copiar contraseña temporal" title="Copiar" @click="copiar(claveTemporal.temp_password)" />
                    </span>
                    <span class="lp-ayuda">Solo se muestra ahora. Al entrar tendrá que elegir una propia.</span>
                  </div>
                </section>

                <section class="lp-bloque" aria-labelledby="lp-det-logo">
                  <h6 id="lp-det-logo" class="lp-bloque__titulo"><ImageIcon :size="15" aria-hidden="true" /> Logo base</h6>
                  <div class="lp-logo-fila">
                    <div class="lp-logobox lp-logobox--lg">
                      <img v-if="editLogoPreview" :src="editLogoPreview" alt="Logo de la parroquia" />
                      <ImageIcon v-else :size="20" class="text-slate-300" aria-hidden="true" />
                    </div>
                    <div class="lp-logo-fila__acc">
                      <input ref="editLogoInput" type="file" accept="image/png,image/jpeg,image/webp"
                        class="lp-file" @change="onEditLogo" />
                      <div class="flex flex-wrap items-center gap-2">
                        <AppButton variant="secondary" size="sm" :icon="Upload" type="button" :disabled="editLogoSubiendo"
                          @click="$refs.editLogoInput.click()">{{ editLogoSubiendo ? 'Subiendo…' : (editBranding.logo_url_proveedor ? 'Cambiar' : 'Subir logo') }}</AppButton>
                        <button v-if="editBranding.logo_url_proveedor" type="button" class="lp-link"
                          :disabled="editLogoSubiendo" @click="quitarEditLogo">Quitar</button>
                      </div>
                    </div>
                  </div>
                  <small class="lp-ayuda">
                    <template v-if="editBranding.logo_url">El admin ya subió su propio logo; este solo se ve si lo quita.</template>
                    <template v-else>Se muestra hasta que el admin de la parroquia suba el suyo.</template>
                  </small>
                </section>

                <section class="lp-bloque" aria-labelledby="lp-det-plantilla">
                  <h6 id="lp-det-plantilla" class="lp-bloque__titulo"><LayoutTemplate :size="15" aria-hidden="true" /> Plantilla</h6>
                  <p v-if="edit.es_plantilla" class="lp-ayuda lp-ayuda--ok">
                    <Check :size="14" aria-hidden="true" /> Las parroquias nuevas copian su ruta sacramental.
                  </p>
                  <template v-else>
                    <p class="lp-ayuda">Las parroquias nuevas copian la ruta sacramental de la plantilla.</p>
                    <AppButton variant="secondary" size="sm" type="button" :loading="marcandoPlantilla"
                      @click="marcarComoPlantilla">Usar como plantilla</AppButton>
                  </template>
                </section>
              </aside>

              <!-- Columna principal: datos editables -->
              <div class="lp-det__main">
                <section class="lp-bloque" aria-labelledby="lp-det-datos">
                  <h6 id="lp-det-datos" class="lp-bloque__titulo"><Building2 :size="15" aria-hidden="true" /> Datos generales</h6>
                  <div class="lp-grid2">
                    <label class="lp-campo lp-span2">Nombre
                      <input v-model="edit.nombre" required maxlength="150" />
                      <small v-if="editErrores.nombre" class="lp-err">{{ editErrores.nombre[0] }}</small>
                    </label>
                    <label class="lp-campo">
                      <span class="lp-campo__fila">
                        Slug (URL)
                        <button type="button" class="lp-link"
                          @click="editSlugManual = !editSlugManual; !editSlugManual && (edit.slug = slugify(edit.nombre))">
                          {{ editSlugManual ? 'Autogenerar' : 'Personalizar' }}
                        </button>
                      </span>
                      <input v-model="edit.slug" maxlength="80" :readonly="!editSlugManual"
                        class="font-monospace" :class="{ 'lp-readonly': !editSlugManual }" />
                      <small v-if="editErrores.slug" class="lp-err">{{ editErrores.slug[0] }}</small>
                    </label>
                    <label class="lp-campo">Zona horaria
                      <select v-model="edit.zona_horaria">
                        <option v-for="z in ZONAS" :key="z" :value="z">{{ z }}</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section class="lp-bloque" aria-labelledby="lp-det-programa">
                  <h6 id="lp-det-programa" class="lp-bloque__titulo"><BookOpen :size="15" aria-hidden="true" /> Programa</h6>
                  <div class="lp-grid2">
                    <label class="lp-campo" :class="{ 'lp-span2': editPrograma.tipo !== 'otro' }">Tipo de programa
                      <select v-model="editPrograma.tipo">
                        <option v-for="[valor, etiqueta] in PROGRAMA_TIPOS" :key="valor" :value="valor">{{ etiqueta }}</option>
                      </select>
                    </label>
                    <label v-if="editPrograma.tipo === 'otro'" class="lp-campo">Nombre del programa
                      <input v-model="editPrograma.nombre_otro" maxlength="60" placeholder="Ej: Primera Reconciliación" />
                    </label>
                    <label class="lp-campo"><span>Persona (singular) <span class="lp-opc">(opcional)</span></span>
                      <input v-model="editPrograma.persona_singular" maxlength="40" :placeholder="editPersonaDefault[0]" />
                    </label>
                    <label class="lp-campo"><span>Persona (plural) <span class="lp-opc">(opcional)</span></span>
                      <input v-model="editPrograma.persona_plural" maxlength="40" :placeholder="editPersonaDefault[1]" />
                    </label>
                  </div>
                  <small class="lp-ayuda">
                    El tipo define la barra superior («Programa de …»). Vacío usa «{{ editPersonaDefault[0] }}» /
                    «{{ editPersonaDefault[1] }}» en el menú, el panel y los listados.
                  </small>
                </section>

                <section class="lp-bloque lp-peligro" aria-labelledby="lp-peligro-titulo">
                  <h6 id="lp-peligro-titulo" class="lp-bloque__titulo lp-peligro__head">
                    <Trash2 :size="15" aria-hidden="true" /> Eliminar parroquia
                  </h6>
                  <p v-if="edit.es_plantilla" class="lp-peligro__txt">
                    Es la plantilla de las parroquias nuevas. Marca otra como plantilla para poder eliminarla.
                  </p>
                  <p v-else-if="activaGuardada" class="lp-peligro__txt">
                    Para eliminarla, primero desactívala (interruptor «Parroquia activa») y guarda los cambios.
                  </p>
                  <template v-else>
                    <p class="lp-peligro__txt">
                      Se borrará para siempre: {{ edit.users_count ?? 0 }} usuario(s) y sus cuentas de acceso,
                      {{ edit.confirmandos_count ?? 0 }} joven(es) con sus apoderados y asistencias,
                      {{ edit.grupos_count ?? 0 }} grupo(s), reuniones, sacramentos y documentos.
                      <strong>No se puede deshacer.</strong>
                    </p>
                    <label class="lp-peligro__label" for="lp-peligro-input">
                      Escribe <strong>{{ edit.nombreGuardado }}</strong> para confirmar
                    </label>
                    <div class="lp-peligro__fila">
                      <input id="lp-peligro-input" v-model="confirmEliminar" type="text" autocomplete="off"
                        spellcheck="false" :disabled="eliminando" />
                      <AppButton variant="danger" type="button" :icon="Trash2" :loading="eliminando"
                        :disabled="!puedeEliminar" @click="eliminarDetalle">
                        {{ eliminando ? 'Eliminando…' : 'Eliminar' }}
                      </AppButton>
                    </div>
                  </template>
                </section>
              </div>
            </div>
            <div class="modal-footer">
              <AppButton variant="secondary" type="button" data-bs-dismiss="modal" :disabled="savingEdit">Cancelar</AppButton>
              <AppButton type="submit" :loading="savingEdit">{{ savingEdit ? 'Guardando…' : 'Guardar cambios' }}</AppButton>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Modal: credenciales del admin recién creado -->
    <div class="modal fade" ref="credsModalRef" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <span class="modal-header__icon" aria-hidden="true"><KeyRound :size="18" /></span>
            <div class="modal-header__text">
              <h5 class="modal-title">Credenciales del administrador</h5>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body" v-if="credenciales">
            <p class="text-sm text-slate-600 dark:text-slate-300">
              Parroquia <b>{{ credenciales.parroquia }}</b> creada. Entrega estas credenciales a su administrador:
            </p>
            <div class="mt-3 rounded-lg border bg-slate-50 dark:bg-slate-900 p-3 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-slate-500">Email</span>
                <span class="font-mono">{{ credenciales.email }}</span>
              </div>
              <div class="mt-2 flex items-center justify-between">
                <span class="text-slate-500">Contraseña temporal</span>
                <span class="flex items-center gap-2">
                  <code class="rounded bg-white dark:bg-slate-800 px-2 py-0.5">{{ credenciales.temp_password }}</code>
                  <button type="button" class="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100" @click="copiar(credenciales.temp_password)" aria-label="Copiar contraseña temporal" title="Copiar contraseña temporal">
                    <Copy :size="14" />
                  </button>
                </span>
              </div>
            </div>
            <p class="mt-2 text-xs text-amber-600">La contraseña no se vuelve a mostrar. Anótala ahora: al entrar, el
              administrador tendrá que elegir una propia.</p>
          </div>
          <div class="modal-footer">
            <AppButton type="button" data-bs-dismiss="modal">Entendido</AppButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lp-peligro__txt { margin: 0 0 0.6rem; font-size: var(--fs-sm); line-height: 1.5; color: var(--text-muted); }
.lp-peligro__txt strong { color: var(--text); }
.lp-peligro__label { display: block; font-size: var(--fs-sm); color: var(--text); margin-bottom: 0.35rem; }
.lp-peligro__fila { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.lp-peligro__fila input { flex: 1 1 12rem; min-width: 0; }
.lp-peligro__fila :deep(button) { min-height: 44px; }

.lp-errores { margin-bottom: 1rem; }
.lp-errores__panel { margin-top: 0.9rem; }

/* Segmented control: dos opciones mutuamente excluyentes, más claro que dos
   radios sueltos y más fácil de tocar en celular. */
.lp-seg {
  display: inline-flex;
  align-self: flex-start;
  padding: 0.2rem;
  border-radius: var(--radius-lg);
  background: rgba(148, 163, 184, 0.15);
  gap: 0.15rem;
}
.lp-seg__opt {
  border: 0;
  background: transparent;
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-md);
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.lp-seg__opt:hover { color: var(--text); }
.lp-seg__opt--on {
  background: var(--surface);
  color: #92400e;
  box-shadow: var(--shadow-sm);
}

/* Chips de parroquia: click para sumar/sacar del alcance. */
.lp-mant__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.lp-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--text-muted);
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-pill);
  font-size: var(--fs-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.lp-chip:hover { border-color: var(--line-strong); }
.lp-chip--on {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
  font-weight: 600;
}
.lp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.lp-dot--on { background: #10b981; }
.lp-dot--off { background: #94a3b8; }


.lp-row--off td { color: var(--text-muted); }
.lp-row--off td:first-child { opacity: 0.75; }

/* ===== Tarjetas (celular) ===== */
.lp-card--off { opacity: 0.7; }
.lp-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  font-size: var(--fs-sm);
  color: var(--text-muted);
  margin-bottom: 0.7rem;
}
.lp-card__stats b { color: var(--text); }


.lp-link {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--accent);
  background: none;
  border: 0;
  cursor: pointer;
}
.lp-link:disabled { opacity: 0.5; }

.lp-file {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.lp-logobox {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface-sunken);
}
.lp-logobox--lg { width: 56px; height: 56px; }
.lp-logobox img { width: 100%; height: 100%; object-fit: contain; }

.btn-sm {
  padding: 0.35rem 0.7rem;
  font-size: var(--fs-sm);
}

.lp-sacs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.lp-sac {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 0.4rem 0.75rem;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
}
.lp-sac input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.lp-sac--on {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
  background: color-mix(in srgb, var(--accent) 9%, var(--surface));
  color: color-mix(in srgb, var(--accent) 75%, var(--text));
}
.lp-readonly {
  background: var(--surface-sunken);
  color: var(--text-muted);
}

.lp-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}
.lp-stats > div {
  background: var(--surface-sunken);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.5rem;
  text-align: center;
}
.lp-stats b {
  display: block;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text);
}
.lp-stats span {
  font-size: var(--fs-xs);
  color: var(--text-muted);
}
@media (max-width: 560px) {
  .lp-stats { grid-template-columns: repeat(2, 1fr); }
}

/* Encabezado del modal de detalle: ícono en placa + nombre + slug/estado. */
.lp-modal-head__slug {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.5rem;
  font-size: var(--fs-xs);
  color: var(--text-muted);
}
.lp-modal-head__slugtxt {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, monospace;
}
.lp-modal-head__estado { display: inline-flex; align-items: center; gap: 0.3rem; flex-shrink: 0; }
@media (max-width: 480px) {
  .lp-modal-head__slugtxt { max-width: 55vw; }
}

/* Secciones del formulario de detalle: reemplaza los divisores + label
   suelto por bloques con cabecera propia, más fáciles de escanear. */

/* Las 3 secciones secundarias no necesitan ser full-width: en 2 columnas se
   lee igual de bien y el modal deja de ser un scroll larguísimo. Logo base
   ocupa las 2 columnas (tiene más contenido); Tipo de programa y Plantilla
   van una al lado de la otra. */

/* Fila "Parroquia activa": toggle switch en vez de un checkbox suelto y mal
   alineado junto a los demás campos. */
.lp-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.65rem;
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-lg);
  background: #f0fdf4;
  cursor: pointer;
}
.lp-toggle-row--off { background: #fffbeb; }
.lp-toggle-row__titulo { display: block; font-size: var(--fs-ui); font-weight: 600; color: var(--text); }
.lp-toggle-row__desc { display: block; font-size: var(--fs-xs); color: var(--text-muted); margin-top: 0.1rem; }
.lp-switch { position: relative; flex-shrink: 0; }
.lp-switch input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
.lp-switch__track {
  display: block;
  width: 38px;
  height: 22px;
  border-radius: var(--radius-pill);
  background: var(--line-strong);
  transition: background-color 0.15s ease;
}
.lp-switch__thumb {
  display: block;
  width: 18px;
  height: 18px;
  margin: 2px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  transition: transform 0.15s ease;
}
.lp-switch input:checked ~ .lp-switch__track { background: #16a34a; }
.lp-switch input:checked ~ .lp-switch__track .lp-switch__thumb { transform: translateX(16px); }
.lp-switch input:focus-visible ~ .lp-switch__track { outline: 2px solid var(--accent); outline-offset: 2px; }

/* ===== MODO OSCURO ===== */
:root[data-bs-theme="dark"] .lp-seg {
  background: rgba(148, 163, 184, 0.15);
}
:root[data-bs-theme="dark"] .lp-seg__opt { color: var(--text-muted); }
:root[data-bs-theme="dark"] .lp-seg__opt:hover { color: var(--text); }
:root[data-bs-theme="dark"] .lp-seg__opt--on {
  background: var(--line);
  color: #fbbf24;
}
:root[data-bs-theme="dark"] .lp-chip {
  border-color: var(--line-strong);
  background: var(--surface);
  color: var(--text-muted);
}
:root[data-bs-theme="dark"] .lp-chip:hover { border-color: var(--line-strong); }
:root[data-bs-theme="dark"] .lp-chip--on {
  background: #4a3412;
  border-color: #d97706;
  color: #fbbf24;
}
:root[data-bs-theme="dark"] .lp-card__slug,
:root[data-bs-theme="dark"] .lp-card__stats { color: var(--text-muted); }
:root[data-bs-theme="dark"] .lp-card__stats b { color: var(--text); }
:root[data-bs-theme="dark"] .lp-logobox {
  border-color: var(--line);
}
:root[data-bs-theme="dark"] .lp-sac {
  border-color: var(--line-strong);
  color: var(--text-muted);
}
:root[data-bs-theme="dark"] .lp-sac--on {
  background: color-mix(in srgb, var(--accent) 16%, var(--surface));
  color: color-mix(in srgb, var(--accent) 70%, var(--text));
}
:root[data-bs-theme="dark"] .lp-stats > div {
  border-color: var(--line);
}
:root[data-bs-theme="dark"] .lp-stats b { color: var(--text); }
:root[data-bs-theme="dark"] .lp-modal-head__slug { color: var(--text-muted); }
:root[data-bs-theme="dark"] .lp-toggle-row { background: #14432a; }
:root[data-bs-theme="dark"] .lp-toggle-row--off { background: #4a3412; }
:root[data-bs-theme="dark"] .lp-switch__track { background: var(--line-strong); }

/* ══ Consola del proveedor (rediseño) ══════════════════════════════════════ */
.lp-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* KPIs */
.lp-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.lp-kpi {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  min-width: 0;
}
.lp-kpi__ico {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--accent-soft);
  color: var(--accent);
  flex-shrink: 0;
}
.lp-kpi__body { display: flex; flex-direction: column; min-width: 0; }
.lp-kpi__label { font-size: var(--fs-xs); font-weight: 600; color: var(--text-muted); }
.lp-kpi__valor {
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1.15;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.lp-kpi__valor--txt { font-size: 1.15rem; line-height: 1.6; }
.lp-kpi__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  font-size: var(--fs-xs);
  color: var(--text-muted);
}
.lp-kpi__sep { margin-left: 0.4rem; }
.lp-kpi--alerta { border-color: #f59e0b; background: #fffbeb; }
.lp-kpi--alerta .lp-kpi__ico { background: #fef3c7; color: #b45309; }
.lp-kpi--alerta .lp-kpi__valor { color: #92400e; }

/* Distribución: listado + panel de mantenimiento */
.lp-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1rem;
  align-items: start;
  margin-bottom: 1rem;
}
.lp-main { padding: 0; overflow: hidden; }

.lp-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--line);
}
.lp-toolbar__titulo {
  margin: 0 auto 0 0;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text);
}
.lp-toolbar__n {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text-muted);
  background: var(--surface-sunken);
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.5rem;
  font-variant-numeric: tabular-nums;
}
.lp-search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  padding: 0 0.7rem;
  min-height: 40px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-muted);
  flex: 0 1 260px;
}
.lp-search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.lp-search input { border: 0 !important; box-shadow: none !important; padding: 0 !important; background: transparent; min-width: 0; flex: 1; }

.lp-seg--neutro .lp-seg__opt--on { color: var(--text); }
.lp-seg__opt { min-height: 34px; }
.lp-seg--full { display: grid; grid-template-columns: 1fr 1fr; align-self: stretch; }

/* Tabla */
.lp-tabla { border: 0; border-radius: 0; box-shadow: none; }
.lp-tabla th { font-size: var(--fs-xs); text-transform: none; }
.lp-fila { cursor: pointer; transition: background-color 0.15s ease; }
.lp-fila:hover td { background: var(--surface-sunken); }
.lp-num { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--text); }
.lp-fecha { color: var(--text-muted); white-space: nowrap; font-size: var(--fs-sm); }

.lp-par { display: flex; align-items: center; gap: 0.7rem; min-width: 0; }
.lp-par__avatar {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}
.lp-par__avatar--lg { width: 44px; height: 44px; font-size: var(--fs-sm); }
.lp-par__txt { display: flex; flex-direction: column; min-width: 0; text-align: left; }
.lp-par__nombre {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-weight: 600;
  color: var(--text);
}
.lp-par__slug { font-family: ui-monospace, monospace; font-size: var(--fs-xs); color: var(--text-muted); }

.lp-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.05rem 0.45rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.lp-estado {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 30px;
  padding: 0.2rem 0.65rem;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: var(--fs-xs);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.lp-estado:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.lp-estado--on { background: #d1fae5; color: #047857; }
.lp-estado--on:hover { background: #a7f3d0; }
.lp-estado--off { background: #e2e8f0; color: #475569; }
.lp-estado--off:hover { background: #cbd5e1; }

/* Tarjetas (celular) */
.lp-cards { display: flex; flex-direction: column; gap: 0.6rem; padding: 0.75rem; }
.lp-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.8rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}
.lp-card__abrir {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  border-radius: var(--radius-md);
}
.lp-card__abrir:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.lp-card__pie { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }

/* Mantenimiento (panel lateral) */
.lp-mant {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  color: var(--text);
  position: sticky;
  top: 0;
}
.lp-mant--on { border-color: #f59e0b; background: #fffbeb; }
.lp-mant__head { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); }
.lp-mant--on .lp-mant__head { color: #b45309; }
.lp-mant__titulo { margin: 0 auto 0 0; font-size: var(--fs-ui); font-weight: 700; color: var(--text); }
.lp-mant__pill {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--surface-sunken);
  color: var(--text-muted);
}
.lp-mant--on .lp-mant__pill { background: #fde68a; color: #92400e; }
.lp-mant__txt { margin: 0; font-size: var(--fs-sm); line-height: 1.5; color: var(--text-muted); }
.lp-mant__txt b { color: var(--text); }
.lp-mant__label { margin: 0; font-size: var(--fs-sm); font-weight: 600; color: var(--text); }
.lp-mant__label span { font-weight: 400; color: var(--text-muted); }
.lp-mant__input { width: 100%; margin-top: -0.4rem; }
.lp-mant :deep(.app-btn) { min-height: 44px; }

.lp-errores__summary { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.lp-errores__hint { font-weight: 400; font-size: var(--fs-xs); color: var(--text-muted); }

@media (max-width: 1199.98px) {
  .lp-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 991.98px) {
  .lp-layout { grid-template-columns: 1fr; }
  .lp-mant { position: static; }
}
@media (max-width: 575.98px) {
  .lp-kpis { gap: 0.5rem; }
  .lp-kpi { padding: 0.75rem; gap: 0.6rem; }
  .lp-kpi__ico { display: none; }
  .lp-kpi__valor { font-size: 1.35rem; }
  .lp-search { flex: 1 1 100%; }
}

/* ══ Modales ═══════════════════════════════════════════════════════════════ */
.lp-form { display: flex; flex-direction: column; min-height: 0; }

.lp-cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}
.lp-col { display: flex; flex-direction: column; gap: 0.9rem; min-width: 0; }
.lp-col + .lp-col { padding-left: 1.25rem; border-left: 1px solid var(--line); }
.lp-col__titulo, .lp-bloque__titulo {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--text);
}
.lp-col__titulo svg, .lp-bloque__titulo svg { color: var(--accent); flex-shrink: 0; }

.lp-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
.lp-span2 { grid-column: 1 / -1; }
.lp-campo { display: flex; flex-direction: column; gap: 0.3rem; margin: 0; font-size: var(--fs-sm); color: var(--text); min-width: 0; }
.lp-campo__fila { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.lp-fieldset { border: 0; padding: 0; }
.lp-fieldset legend { float: none; width: auto; margin: 0 0 0.3rem; padding: 0; font-size: var(--fs-sm); }
.lp-req { color: var(--danger); }
.lp-opc { color: var(--text-muted); }
.lp-err { color: var(--danger); font-size: var(--fs-xs); }
.lp-ayuda { display: flex; align-items: flex-start; gap: 0.35rem; margin: 0; font-size: var(--fs-xs); line-height: 1.45; color: var(--text-muted); }
.lp-ayuda--ok { color: #047857; font-weight: 600; }
.lp-nota {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-md);
  background: var(--accent-soft);
  color: var(--text);
  font-size: var(--fs-xs);
  line-height: 1.45;
}
.lp-nota svg { color: var(--accent); flex-shrink: 0; margin-top: 0.1rem; }
.lp-logo-fila { display: flex; align-items: center; gap: 0.75rem; }
.lp-logo-fila__acc { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }

/* Detalle: lateral (identidad/estado) + principal (formulario) */
.lp-det {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}
.lp-det__side, .lp-det__main { display: flex; flex-direction: column; gap: 0.9rem; min-width: 0; }
.lp-det .lp-stats { grid-template-columns: repeat(3, 1fr); }
.lp-det .lp-toggle-row { margin-top: 0; }
.lp-bloque {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}
.lp-det__side .lp-bloque { background: var(--surface-sunken); }
.lp-peligro { border-color: color-mix(in srgb, var(--danger) 35%, var(--line)); }
.lp-peligro__head svg { color: var(--danger); }
.lp-peligro__txt { margin: 0; }

@media (max-width: 991.98px) {
  .lp-det { grid-template-columns: 1fr; }
  .lp-det__side { order: 2; }
}
@media (max-width: 767.98px) {
  .lp-cols { grid-template-columns: 1fr; }
  .lp-col + .lp-col { padding-left: 0; border-left: 0; padding-top: 1rem; border-top: 1px solid var(--line); }
}
@media (max-width: 479.98px) {
  .lp-grid2 { grid-template-columns: 1fr; }
}

:root[data-bs-theme="dark"] .lp-kpi--alerta,
:root[data-bs-theme="dark"] .lp-mant--on { background: #3b2a0a; border-color: #b45309; }
:root[data-bs-theme="dark"] .lp-kpi--alerta .lp-kpi__valor { color: #fcd34d; }
:root[data-bs-theme="dark"] .lp-kpi--alerta .lp-kpi__ico,
:root[data-bs-theme="dark"] .lp-mant--on .lp-mant__pill { background: #78350f; color: #fde68a; }
:root[data-bs-theme="dark"] .lp-estado--on { background: #064e3b; color: #6ee7b7; }
:root[data-bs-theme="dark"] .lp-estado--on:hover { background: #065f46; }
:root[data-bs-theme="dark"] .lp-estado--off { background: #334155; color: #cbd5e1; }
:root[data-bs-theme="dark"] .lp-estado--off:hover { background: #475569; }
:root[data-bs-theme="dark"] .lp-ayuda--ok { color: #6ee7b7; }
:root[data-bs-theme="dark"] .lp-tag { color: color-mix(in srgb, var(--accent) 55%, #fff); }

/* ══ Aviso de errores, historial y administradores ═════════════════════════ */
.lp-aviso {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.7rem 1rem;
  margin-bottom: 1rem;
  border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--line));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--danger) 7%, var(--surface));
}
.lp-aviso__ico { color: var(--danger); flex-shrink: 0; }
.lp-aviso__txt { margin: 0 auto 0 0; display: flex; flex-wrap: wrap; gap: 0.2rem 0.6rem; font-size: var(--fs-sm); color: var(--text); min-width: 0; }
.lp-aviso__txt span { color: var(--text-muted); }
.lp-errores__badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.05rem 0.5rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}

.lp-side { display: flex; flex-direction: column; gap: 1rem; position: sticky; top: 0; min-width: 0; }
.lp-side .lp-mant { position: static; }
.lp-hist {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}
.lp-hist__head { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); }
.lp-hist__titulo { margin: 0 auto 0 0; font-size: var(--fs-ui); font-weight: 700; color: var(--text); }
.lp-hist__vacio { margin: 0; font-size: var(--fs-sm); line-height: 1.5; color: var(--text-muted); }
.lp-hist__lista { list-style: none; margin: 0; padding: 0; max-height: 360px; overflow-y: auto; }
.lp-hist__item { position: relative; display: flex; gap: 0.6rem; padding: 0.45rem 0; }
.lp-hist__item + .lp-hist__item { border-top: 1px solid var(--line); }
.lp-hist__punto {
  width: 8px;
  height: 8px;
  margin-top: 0.4rem;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}
.lp-hist__item--eliminar .lp-hist__punto,
.lp-hist__item--desactivar .lp-hist__punto,
.lp-hist__item--mantenimiento_on .lp-hist__punto { background: var(--danger); }
.lp-hist__item--activar .lp-hist__punto,
.lp-hist__item--crear .lp-hist__punto,
.lp-hist__item--mantenimiento_off .lp-hist__punto { background: #10b981; }
.lp-hist__txt { min-width: 0; }
.lp-hist__linea { margin: 0; font-size: var(--fs-sm); line-height: 1.4; color: var(--text-muted); overflow-wrap: anywhere; }
.lp-hist__linea b { color: var(--text); font-weight: 600; }
.lp-hist__meta { font-size: var(--fs-xs); color: var(--text-muted); }

.lp-gestores { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.lp-gestor { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.lp-gestor__txt { display: flex; flex-direction: column; min-width: 0; }
.lp-gestor__nombre { font-size: var(--fs-sm); font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lp-gestor__meta { font-size: var(--fs-xs); color: var(--text-muted); }
.lp-gestor :deep(.app-btn) { min-width: 40px; min-height: 40px; }
.lp-clave {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.6rem 0.7rem;
  border-radius: var(--radius-md);
  border: 1px dashed #f59e0b;
  background: #fffbeb;
}
.lp-clave__txt { font-size: var(--fs-xs); color: var(--text); }
.lp-clave__fila { display: flex; align-items: center; gap: 0.35rem; }
.lp-clave code {
  font-size: var(--fs-sm);
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  user-select: all;
}
/* Con menos de 1280 px la tabla no cabe al lado del panel: una columna, y
   mantenimiento + actividad debajo, lado a lado si entran. */
@media (max-width: 1279.98px) {
  .lp-layout { grid-template-columns: 1fr; }
  .lp-side {
    position: static;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    align-items: start;
  }
}
:root[data-bs-theme="dark"] .lp-clave { background: #3b2a0a; border-color: #b45309; }
</style>
