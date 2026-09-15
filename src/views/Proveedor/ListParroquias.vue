<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { Modal } from 'bootstrap'
import {
  Plus, Check, X, Copy, Building2, KeyRound, Eye, Search, Clock, Upload, Image as ImageIcon, Wrench,
  BookOpen, LayoutTemplate, Globe,
} from 'lucide-vue-next'
import { showAlerta, confirmar, slugify } from '@/funciones'
import {
  listParroquias, crearParroquia, actualizarParroquia, getBrandingParroquia, setPlantillaParroquia,
  actualizarProgramaParroquia,
} from '@/services/proveedor'
import { subirLogo, quitarLogo } from '@/services/branding'
import AppPage from '@/components/AppPage.vue'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { useSystemStatusStore } from '@/stores/systemStatus'
import { PROGRAMA_TIPOS, PERSONA_LABELS_DEFAULT } from '@/stores/parroquia'

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

const parroquiasFiltradas = computed(() => {
  const t = q.value.trim().toLowerCase()
  const base = t
    ? parroquias.value.filter(p =>
        p.nombre.toLowerCase().includes(t) || (p.slug || '').toLowerCase().includes(t))
    : parroquias.value.slice()
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
}

onMounted(cargar)
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
  })
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
  } catch (e) {
    editErrores.value = e?.response?.data?.errors || {}
    if (!Object.keys(editErrores.value).length) showAlerta(e?.message || 'No se pudo guardar', 'error')
  } finally {
    savingEdit.value = false
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
  } catch {
    showAlerta('No se pudo cambiar el estado', 'error')
  }
}

function copiar(txt) {
  navigator.clipboard?.writeText(txt)
  showAlerta('Copiado', 'success')
}
</script>

<template>
  <AppPage title="Parroquias" subtitle="Panel del proveedor de la plataforma" :loading="loading">
    <template #actions>
      <button class="btn-primary" @click="abrirAlta">
        <Plus :size="16" class="mr-1.5" /> <span class="text-sm">Nueva parroquia</span>
      </button>
    </template>

    <div class="lp-bar">
      <div class="lp-count">
        <span class="lp-dot lp-dot--on"></span> {{ resumen.activas }} activas
        <span class="lp-sep">·</span>
        <span class="lp-dot lp-dot--off"></span> {{ resumen.inactivas }} inactivas
      </div>
      <div class="lp-search">
        <Search :size="15" />
        <input v-model="q" type="search" placeholder="Buscar por nombre o slug…" />
      </div>
    </div>

    <!-- Modo mantenimiento: bloquea a todo logueado que no sea proveedor -->
    <div class="lp-mant" :class="{ 'lp-mant--on': systemStatus.mantenimiento }">
      <div class="lp-mant__row">
        <div class="lp-mant__info">
          <Wrench :size="18" class="flex-shrink-0" />
          <div class="lp-mant__titulo">
            Modo mantenimiento: {{ systemStatus.mantenimiento ? 'ACTIVADO' : 'desactivado' }}
          </div>
        </div>
        <div class="lp-mant__acciones">
          <input v-if="!systemStatus.mantenimiento" v-model="mensajeMantenimiento" type="text"
            class="lp-mant__input" placeholder="Mensaje opcional (ej: volvemos a las 3pm)" />
          <button class="btn" :class="systemStatus.mantenimiento ? 'btn-success' : 'btn-warning'"
            :disabled="systemStatus.saving" @click="toggleMantenimiento">
            {{ systemStatus.mantenimiento ? 'Desactivar' : 'Activar' }}
          </button>
        </div>
      </div>

      <!-- Activo: mostrar a quién afecta (solo lectura, hay que desactivar para cambiarlo) -->
      <div v-if="systemStatus.mantenimiento" class="lp-mant__alcance-activo">
        Alcance:
        <b v-if="systemStatus.alcance === 'todas'">todas las parroquias</b>
        <b v-else>
          {{ parroquias.filter(p => systemStatus.parroquiaIds.includes(p.id)).map(p => p.nombre).join(', ') || '—' }}
        </b>
      </div>

      <!-- Por activar: elegir a quién afecta -->
      <div v-else class="lp-mant__alcance-picker">
        <div class="lp-seg" role="radiogroup" aria-label="Alcance del mantenimiento">
          <button type="button" class="lp-seg__opt" :class="{ 'lp-seg__opt--on': alcanceMantenimiento === 'todas' }"
            role="radio" :aria-checked="alcanceMantenimiento === 'todas'" @click="alcanceMantenimiento = 'todas'">
            Todas las parroquias
          </button>
          <button type="button" class="lp-seg__opt" :class="{ 'lp-seg__opt--on': alcanceMantenimiento === 'parroquias' }"
            role="radio" :aria-checked="alcanceMantenimiento === 'parroquias'" @click="alcanceMantenimiento = 'parroquias'">
            Parroquias específicas
          </button>
        </div>
        <div v-if="alcanceMantenimiento === 'parroquias'" class="lp-mant__chips">
          <button v-for="p in parroquiasParaMantenimiento" :key="p.id" type="button" class="lp-chip"
            :class="{ 'lp-chip--on': parroquiasSeleccionadas.includes(p.id) }"
            :aria-pressed="parroquiasSeleccionadas.includes(p.id)"
            @click="toggleParroquiaSeleccionada(p.id)">
            <Check v-if="parroquiasSeleccionadas.includes(p.id)" :size="12" />
            {{ p.nombre }}
          </button>
          <span v-if="parroquiasParaMantenimiento.length === 0" class="text-muted small">
            No hay parroquias activas.
          </span>
        </div>
      </div>
    </div>

    <!-- Tarjetas en celular -->
    <div v-if="esMovil" class="lp-cards">
      <p v-if="parroquiasFiltradas.length === 0" class="empty-state">
        {{ q ? 'Ninguna parroquia coincide con la búsqueda.' : 'Aún no hay parroquias.' }}
      </p>
      <article v-for="p in parroquiasFiltradas" :key="p.id" class="lp-card" :class="{ 'lp-card--off': !p.activa }">
        <div class="lp-card__head">
          <span class="lp-card__nombre">
            <Building2 :size="15" class="text-slate-400" /> {{ p.nombre }}
          </span>
          <button class="btn-action btn-soft-secondary" title="Ver detalle / configurar" @click="abrirDetalle(p)">
            <Eye :size="16" />
          </button>
        </div>
        <div class="lp-card__slug">{{ p.slug }}</div>
        <div class="lp-card__stats">
          <span><b>{{ p.users_count }}</b> usuarios</span>
          <span><b>{{ p.grupos_count }}</b> grupos</span>
          <span><b>{{ p.confirmandos_count }}</b> confirmandos</span>
        </div>
        <button
          class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
          :class="p.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'"
          @click="cambiarEstado(p)">
          <Check v-if="p.activa" :size="12" /><X v-else :size="12" />
          {{ p.activa ? 'Activa' : 'Inactiva' }}
        </button>
      </article>
    </div>

    <div v-else class="surface table-wrap">
      <table class="mb-0">
        <thead>
          <tr>
            <th class="pl-4">Parroquia</th>
            <th>Slug</th>
            <th class="!text-center">Usuarios</th>
            <th class="!text-center">Grupos</th>
            <th class="!text-center">Confirmandos</th>
            <th class="!text-center">Estado</th>
            <th class="!text-right pr-4">Detalle</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="parroquiasFiltradas.length === 0">
            <td colspan="7" class="empty-state">
              {{ q ? 'Ninguna parroquia coincide con la búsqueda.' : 'Aún no hay parroquias.' }}
            </td>
          </tr>
          <tr v-for="p in parroquiasFiltradas" :key="p.id" :class="{ 'lp-row--off': !p.activa }">
            <td class="pl-4 font-medium text-slate-800">
              <span class="inline-flex items-center gap-2">
                <Building2 :size="15" class="text-slate-400" /> {{ p.nombre }}
              </span>
            </td>
            <td class="text-slate-500 font-monospace">{{ p.slug }}</td>
            <td class="!text-center">{{ p.users_count }}</td>
            <td class="!text-center">{{ p.grupos_count }}</td>
            <td class="!text-center">{{ p.confirmandos_count }}</td>
            <td class="!text-center">
              <button
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                :class="p.activa ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'"
                :title="p.activa ? 'Clic para desactivar' : 'Clic para activar'"
                @click="cambiarEstado(p)">
                <Check v-if="p.activa" :size="12" /><X v-else :size="12" />
                {{ p.activa ? 'Activa' : 'Inactiva' }}
              </button>
            </td>
            <td class="!text-right pr-4">
              <button class="btn-action btn-soft-secondary ml-auto" title="Ver detalle / configurar"
                @click="abrirDetalle(p)">
                <Eye :size="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppPage>

  <!-- Modales (fuera del slot condicionado por :loading de AppPage) -->
  <div>
    <!-- Modal: alta de parroquia -->
    <div class="modal fade" ref="formModalRef" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><Building2 :size="18" class="me-2 d-inline-block align-text-bottom" />Nueva parroquia</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" :disabled="saving"></button>
          </div>
          <form @submit.prevent="crear">
            <div class="modal-body">
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="text-sm">Nombre de la parroquia <span class="text-rose-500">*</span>
                  <input v-model="form.nombre" required maxlength="150" class="mt-1" />
                  <small v-if="errores.nombre" class="text-rose-500">{{ errores.nombre[0] }}</small>
                </label>
                <label class="text-sm">
                  <span class="flex items-center justify-between">
                    Slug (URL)
                    <button type="button" class="lp-link"
                      @click="slugManual = !slugManual; !slugManual && (form.slug = slugify(form.nombre))">
                      {{ slugManual ? 'Autogenerar' : 'Personalizar' }}
                    </button>
                  </span>
                  <input v-model="form.slug" maxlength="80" :readonly="!slugManual"
                    class="mt-1 font-monospace" :class="{ 'lp-readonly': !slugManual }" />
                  <small class="text-slate-400">Se usa internamente: <code>{{ slugPreview || '—' }}</code></small>
                  <small v-if="errores.slug" class="text-rose-500 block">{{ errores.slug[0] }}</small>
                </label>
                <label class="text-sm sm:col-span-2 sm:w-1/2">Zona horaria
                  <select v-model="form.zona_horaria" class="mt-1">
                    <option v-for="z in ZONAS" :key="z" :value="z">{{ z }}</option>
                  </select>
                </label>
                <div class="text-sm sm:col-span-2">
                  <span class="block mb-1">Sacramentos que gestionará</span>
                  <div class="lp-sacs">
                    <label v-for="[clave, label] in SACRAMENTOS_META" :key="clave" class="lp-sac"
                      :class="{ 'lp-sac--on': form.sacramentos.includes(clave) }">
                      <input type="checkbox" :value="clave" v-model="form.sacramentos" />
                      <Check v-if="form.sacramentos.includes(clave)" :size="13" /> {{ label }}
                    </label>
                  </div>
                  <small class="text-slate-400">Se copian de la parroquia plantilla, con sus documentos.</small>
                </div>

                <div class="text-sm sm:col-span-2">
                  <span class="block mb-1">Logo <span class="text-slate-400">(opcional)</span></span>
                  <div class="flex items-center gap-3">
                    <div class="lp-logobox">
                      <img v-if="nuevoLogoPreview" :src="nuevoLogoPreview" alt="" />
                      <ImageIcon v-else :size="18" class="text-slate-300" />
                    </div>
                    <input ref="nuevoLogoInput" type="file" accept="image/png,image/jpeg,image/webp"
                      class="lp-file" @change="onNuevoLogo" />
                    <button type="button" class="btn-outline btn-sm" @click="$refs.nuevoLogoInput.click()">
                      <Upload :size="14" class="inline" /> Elegir imagen
                    </button>
                    <button v-if="nuevoLogo" type="button" class="lp-link" @click="quitarNuevoLogo">Quitar</button>
                  </div>
                  <small class="text-slate-400">PNG, JPG o WebP. Se optimiza al subir. El admin podrá reemplazarlo.</small>
                </div>
              </div>

              <p class="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Primer administrador</p>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="text-sm">Nombre <span class="text-rose-500">*</span>
                  <input v-model="form.admin_nombre" required maxlength="100" class="mt-1" />
                </label>
                <label class="text-sm">Email <span class="text-rose-500">*</span>
                  <input v-model="form.admin_email" type="email" required class="mt-1" />
                  <small v-if="errores.admin_email" class="text-rose-500">{{ errores.admin_email[0] }}</small>
                </label>
                <label class="text-sm sm:col-span-2 sm:w-1/2">DNI <span class="text-slate-400">(opcional)</span>
                  <input v-model="form.admin_dni" maxlength="20" class="mt-1" />
                  <small v-if="errores.admin_dni" class="text-rose-500">{{ errores.admin_dni[0] }}</small>
                </label>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-outline" data-bs-dismiss="modal" :disabled="saving">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="saving">
                {{ saving ? 'Creando…' : 'Crear parroquia' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Modal: detalle / edición -->
    <div class="modal fade" ref="detalleModalRef" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header lp-modal-head">
            <div class="lp-modal-head__icon"><Building2 :size="20" /></div>
            <div class="min-w-0 flex-grow-1">
              <h5 class="modal-title mb-0 truncate">{{ edit.nombre }}</h5>
              <div class="lp-modal-head__slug">
                <span class="lp-modal-head__slugtxt"><Globe :size="11" class="inline flex-shrink-0" /> {{ edit.slug }}</span>
                <span class="lp-modal-head__estado">
                  <span class="lp-dot" :class="edit.activa ? 'lp-dot--on' : 'lp-dot--off'"></span>
                  {{ edit.activa ? 'Activa' : 'Inactiva' }}
                </span>
              </div>
            </div>
            <button type="button" class="btn-close flex-shrink-0" data-bs-dismiss="modal" :disabled="savingEdit"></button>
          </div>
          <form @submit.prevent="guardarDetalle">
            <div class="modal-body">
              <div class="lp-stats">
                <div><b>{{ edit.users_count }}</b><span>Usuarios</span></div>
                <div><b>{{ edit.grupos_count }}</b><span>Grupos</span></div>
                <div><b>{{ edit.confirmandos_count }}</b><span>Confirmandos</span></div>
                <div><b class="text-sm"><Clock :size="13" class="inline" /> {{ fmtFecha(edit.created_at) }}</b><span>Creada</span></div>
              </div>

              <section class="lp-section">
                <header class="lp-section__head">
                  <Building2 :size="15" class="lp-section__ico" /> Datos generales
                </header>
                <div class="grid gap-3 sm:grid-cols-3">
                  <label class="text-sm">Nombre
                    <input v-model="edit.nombre" required maxlength="150" class="mt-1" />
                    <small v-if="editErrores.nombre" class="text-rose-500">{{ editErrores.nombre[0] }}</small>
                  </label>
                  <label class="text-sm">
                    <span class="flex items-center justify-between">
                      Slug (URL)
                      <button type="button" class="lp-link"
                        @click="editSlugManual = !editSlugManual; !editSlugManual && (edit.slug = slugify(edit.nombre))">
                        {{ editSlugManual ? 'Autogenerar' : 'Personalizar' }}
                      </button>
                    </span>
                    <input v-model="edit.slug" maxlength="80" :readonly="!editSlugManual"
                      class="mt-1 font-monospace" :class="{ 'lp-readonly': !editSlugManual }" />
                    <small v-if="editErrores.slug" class="text-rose-500">{{ editErrores.slug[0] }}</small>
                  </label>
                  <label class="text-sm">Zona horaria
                    <select v-model="edit.zona_horaria" class="mt-1">
                      <option v-for="z in ZONAS" :key="z" :value="z">{{ z }}</option>
                    </select>
                  </label>
                </div>

                <label class="lp-toggle-row" :class="{ 'lp-toggle-row--off': !edit.activa }">
                  <span>
                    <span class="lp-toggle-row__titulo">Parroquia activa</span>
                    <span class="lp-toggle-row__desc">
                      {{ edit.activa ? 'Sus usuarios pueden iniciar sesión con normalidad.' : 'Sus usuarios no podrán iniciar sesión.' }}
                    </span>
                  </span>
                  <span class="lp-switch">
                    <input type="checkbox" v-model="edit.activa" />
                    <span class="lp-switch__track"><span class="lp-switch__thumb"></span></span>
                  </span>
                </label>
              </section>

              <div class="lp-sections-grid">
                <section class="lp-section lp-section--span2">
                  <header class="lp-section__head">
                    <ImageIcon :size="15" class="lp-section__ico" /> Logo base
                  </header>
                  <div class="flex items-center gap-3">
                    <div class="lp-logobox lp-logobox--lg">
                      <img v-if="editLogoPreview" :src="editLogoPreview" alt="" />
                      <ImageIcon v-else :size="20" class="text-slate-300" />
                    </div>
                    <div class="min-w-0">
                      <input ref="editLogoInput" type="file" accept="image/png,image/jpeg,image/webp"
                        class="lp-file" @change="onEditLogo" />
                      <div class="flex flex-wrap items-center gap-2">
                        <button type="button" class="btn-outline btn-sm" :disabled="editLogoSubiendo"
                          @click="$refs.editLogoInput.click()">
                          <Upload :size="14" class="inline" />
                          {{ editLogoSubiendo ? 'Subiendo…' : (editBranding.logo_url_proveedor ? 'Cambiar' : 'Subir logo') }}
                        </button>
                        <button v-if="editBranding.logo_url_proveedor" type="button" class="lp-link"
                          :disabled="editLogoSubiendo" @click="quitarEditLogo">Quitar</button>
                      </div>
                      <small class="text-slate-400 block mt-1">
                        <template v-if="editBranding.logo_url">El admin ya subió su propio logo; este solo se ve si lo quita.</template>
                        <template v-else>Se muestra hasta que el admin de la parroquia suba el suyo.</template>
                      </small>
                    </div>
                  </div>
                </section>

                <section class="lp-section">
                  <header class="lp-section__head">
                    <BookOpen :size="15" class="lp-section__ico" /> Tipo de programa
                  </header>
                  <label class="text-sm">Programa
                    <select v-model="editPrograma.tipo" class="mt-1">
                      <option v-for="[valor, etiqueta] in PROGRAMA_TIPOS" :key="valor" :value="valor">{{ etiqueta }}</option>
                    </select>
                  </label>
                  <label v-if="editPrograma.tipo === 'otro'" class="text-sm block mt-2">Nombre del programa
                    <input v-model="editPrograma.nombre_otro" maxlength="60" class="mt-1" placeholder="Ej: Primera Reconciliación" />
                  </label>
                  <small class="text-slate-400 block mt-2">Define el navbar: "Programa de …".</small>

                  <div class="grid gap-3 sm:grid-cols-2 mt-3 pt-3 border-t">
                    <label class="text-sm">Persona (singular) <span class="text-slate-400">(opcional)</span>
                      <input v-model="editPrograma.persona_singular" maxlength="40" class="mt-1" :placeholder="editPersonaDefault[0]" />
                    </label>
                    <label class="text-sm">Persona (plural) <span class="text-slate-400">(opcional)</span>
                      <input v-model="editPrograma.persona_plural" maxlength="40" class="mt-1" :placeholder="editPersonaDefault[1]" />
                    </label>
                  </div>
                  <small class="text-slate-400 block mt-1">
                    Vacío usa "{{ editPersonaDefault[0] }}" / "{{ editPersonaDefault[1] }}". Así se llama a
                    la persona en el menú, el dashboard y los listados de esta parroquia.
                  </small>
                </section>

                <section class="lp-section">
                  <header class="lp-section__head">
                    <LayoutTemplate :size="15" class="lp-section__ico" /> Plantilla
                  </header>
                  <div v-if="edit.es_plantilla" class="inline-flex items-center gap-2 text-sm text-emerald-700">
                    <Check :size="15" /> Es la parroquia plantilla: las nuevas copian su ruta sacramental.
                  </div>
                  <button v-else type="button" class="btn-outline btn-sm" :disabled="marcandoPlantilla"
                    @click="marcarComoPlantilla">
                    {{ marcandoPlantilla ? 'Guardando…' : 'Usar como plantilla' }}
                  </button>
                </section>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-outline" data-bs-dismiss="modal" :disabled="savingEdit">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="savingEdit">
                {{ savingEdit ? 'Guardando…' : 'Guardar cambios' }}
              </button>
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
            <h5 class="modal-title"><KeyRound :size="18" class="me-2 d-inline-block align-text-bottom" />Credenciales del administrador</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" v-if="credenciales">
            <p class="text-sm text-slate-600">
              Parroquia <b>{{ credenciales.parroquia }}</b> creada. Entrega estas credenciales a su administrador:
            </p>
            <div class="mt-3 rounded-lg border bg-slate-50 p-3 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-slate-500">Email</span>
                <span class="font-mono">{{ credenciales.email }}</span>
              </div>
              <div class="mt-2 flex items-center justify-between">
                <span class="text-slate-500">Contraseña temporal</span>
                <span class="flex items-center gap-2">
                  <code class="rounded bg-white px-2 py-0.5">{{ credenciales.temp_password }}</code>
                  <button type="button" class="text-slate-500 hover:text-slate-800" @click="copiar(credenciales.temp_password)">
                    <Copy :size="14" />
                  </button>
                </span>
              </div>
            </div>
            <p class="mt-2 text-xs text-amber-600">La contraseña no se vuelve a mostrar. Anótala ahora.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-primary" data-bs-dismiss="modal">Entendido</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lp-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.lp-mant {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  margin-bottom: 1rem;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
}
.lp-mant--on {
  border-color: #fde68a;
  background: #fffbeb;
  color: #92400e;
}
.lp-mant__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.lp-mant__info { display: flex; align-items: center; gap: 0.6rem; }
.lp-mant__titulo { font-weight: 700; font-size: 0.85rem; }
.lp-mant__acciones { display: flex; align-items: center; gap: 0.5rem; flex: 1 1 auto; justify-content: flex-end; }
.lp-mant__input {
  font-size: 0.82rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #cbd5e1;
  flex: 1 1 auto;
  min-width: 280px;
  max-width: 420px;
}
.lp-mant__alcance-activo { font-size: 0.8rem; }
.lp-mant__alcance-picker {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px dashed #e2e8f0;
}

/* Segmented control: dos opciones mutuamente excluyentes, más claro que dos
   radios sueltos y más fácil de tocar en celular. */
.lp-seg {
  display: inline-flex;
  align-self: flex-start;
  padding: 0.2rem;
  border-radius: 0.65rem;
  background: rgba(148, 163, 184, 0.15);
  gap: 0.15rem;
}
.lp-seg__opt {
  border: 0;
  background: transparent;
  padding: 0.4rem 0.85rem;
  border-radius: 0.5rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.lp-seg__opt:hover { color: #334155; }
.lp-seg__opt--on {
  background: #fff;
  color: #92400e;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
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
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.lp-chip:hover { border-color: #cbd5e1; }
.lp-chip--on {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
  font-weight: 600;
}
@media (max-width: 767px) {
  .lp-mant__row { flex-direction: column; align-items: stretch; }
  .lp-mant__acciones { flex-direction: column; align-items: stretch; }
  .lp-mant__input { min-width: 0; max-width: none; }
}
.lp-count {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
}
.lp-sep { color: #cbd5e1; margin: 0 0.15rem; }
.lp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.lp-dot--on { background: #10b981; }
.lp-dot--off { background: #94a3b8; }

.lp-search {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.lp-search svg {
  position: absolute;
  left: 0.6rem;
  color: #94a3b8;
  pointer-events: none;
}
.lp-search input {
  width: 260px;
  max-width: 60vw;
  padding-left: 2rem;
}

.lp-row--off td { color: #94a3b8; }
.lp-row--off td:first-child { opacity: 0.75; }

/* ===== Tarjetas (celular) ===== */
.lp-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.lp-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 0.85rem;
}
.lp-card--off { opacity: 0.7; }
.lp-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}
.lp-card__nombre {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  color: #1e293b;
}
.lp-card__slug {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  color: #64748b;
  margin: 0.25rem 0 0.6rem;
}
.lp-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 0.7rem;
}
.lp-card__stats b { color: #1e293b; }

@media (max-width: 767px) {
  .lp-bar { flex-direction: column; align-items: stretch; }
  .lp-search { width: 100%; }
  .lp-search input { width: 100%; max-width: none; }
}

.lp-link {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--parroquia-color, #2563eb);
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
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}
.lp-logobox--lg { width: 56px; height: 56px; }
.lp-logobox img { width: 100%; height: 100%; object-fit: contain; }

.btn-sm {
  padding: 0.35rem 0.7rem;
  font-size: 0.8rem;
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
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  padding: 0.4rem 0.75rem;
  font-size: 0.83rem;
  font-weight: 500;
  color: #64748b;
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
  border-color: color-mix(in srgb, var(--parroquia-color, #2563eb) 45%, #e2e8f0);
  background: color-mix(in srgb, var(--parroquia-color, #2563eb) 9%, #fff);
  color: color-mix(in srgb, var(--parroquia-color, #2563eb) 75%, #1e293b);
}
.lp-readonly {
  background: #f8fafc;
  color: #64748b;
}

.lp-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}
.lp-stats > div {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.6rem 0.5rem;
  text-align: center;
}
.lp-stats b {
  display: block;
  font-size: 1.05rem;
  font-weight: 700;
  color: #1e293b;
}
.lp-stats span {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #94a3b8;
}
@media (max-width: 560px) {
  .lp-stats { grid-template-columns: repeat(2, 1fr); }
}

/* Encabezado del modal de detalle: ícono en placa + nombre + slug/estado. */
.lp-modal-head { display: flex; align-items: center; gap: 0.75rem; }
.lp-modal-head__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  background: color-mix(in srgb, var(--parroquia-color, #6366f1) 12%, white);
  color: var(--parroquia-color, #6366f1);
}
.lp-modal-head__slug {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.5rem;
  font-size: 0.76rem;
  color: #94a3b8;
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
  .lp-modal-head__icon { width: 34px; height: 34px; }
  .lp-modal-head__slugtxt { max-width: 55vw; }
}

/* Secciones del formulario de detalle: reemplaza los divisores + label
   suelto por bloques con cabecera propia, más fáciles de escanear. */
.lp-section {
  padding: 0.85rem 1rem;
  margin-top: 0.75rem;
  border: 1px solid #eef1f5;
  border-radius: 12px;
  background: #fbfcfe;
}
.lp-section__head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.65rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #475569;
}
.lp-section__ico { color: var(--parroquia-color, #6366f1); flex-shrink: 0; }

/* Las 3 secciones secundarias no necesitan ser full-width: en 2 columnas se
   lee igual de bien y el modal deja de ser un scroll larguísimo. Logo base
   ocupa las 2 columnas (tiene más contenido); Tipo de programa y Plantilla
   van una al lado de la otra. */
.lp-sections-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  margin-top: 0.75rem;
}
.lp-sections-grid .lp-section { margin-top: 0; }
@media (min-width: 576px) {
  .lp-sections-grid { grid-template-columns: 1fr 1fr; }
  .lp-section--span2 { grid-column: 1 / -1; }
}

/* Fila "Parroquia activa": toggle switch en vez de un checkbox suelto y mal
   alineado junto a los demás campos. */
.lp-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.65rem;
  padding: 0.55rem 0.8rem;
  border-radius: 10px;
  background: #f0fdf4;
  cursor: pointer;
}
.lp-toggle-row--off { background: #fffbeb; }
.lp-toggle-row__titulo { display: block; font-size: 0.85rem; font-weight: 600; color: #1e293b; }
.lp-toggle-row__desc { display: block; font-size: 0.75rem; color: #64748b; margin-top: 0.1rem; }
.lp-switch { position: relative; flex-shrink: 0; }
.lp-switch input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
.lp-switch__track {
  display: block;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: #cbd5e1;
  transition: background-color 0.15s ease;
}
.lp-switch__thumb {
  display: block;
  width: 18px;
  height: 18px;
  margin: 2px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25);
  transition: transform 0.15s ease;
}
.lp-switch input:checked ~ .lp-switch__track { background: #16a34a; }
.lp-switch input:checked ~ .lp-switch__track .lp-switch__thumb { transform: translateX(16px); }
.lp-switch input:focus-visible ~ .lp-switch__track { outline: 2px solid #6366f1; outline-offset: 2px; }
</style>
