<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Modal } from 'bootstrap'
import { Plus, Check, X, Copy, Building2, KeyRound, Eye, Search, Clock } from 'lucide-vue-next'
import { showAlerta, confirmar, slugify } from '@/funciones'
import { listParroquias, crearParroquia, actualizarParroquia } from '@/services/proveedor'
import AppPage from '@/components/AppPage.vue'

const ZONAS = ['America/Lima', 'America/Bogota', 'America/Guayaquil', 'America/La_Paz',
  'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Mexico_City', 'America/Caracas']

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
const form = reactive({ nombre: '', slug: '', zona_horaria: 'America/Lima', admin_nombre: '', admin_email: '', admin_dni: '' })
const slugManual = ref(false)
const slugPreview = computed(() => (slugManual.value ? form.slug : slugify(form.nombre)))
watch(() => form.nombre, () => { if (!slugManual.value) form.slug = slugify(form.nombre) })

// --- Detalle / edición ---
const edit = reactive({ id: null, nombre: '', slug: '', zona_horaria: '', activa: true, created_at: null, users_count: 0, grupos_count: 0, confirmandos_count: 0 })
const editSlugManual = ref(false)
const editErrores = ref({})
const savingEdit = ref(false)

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
  Object.assign(form, { nombre: '', slug: '', zona_horaria: 'America/Lima', admin_nombre: '', admin_email: '', admin_dni: '' })
  nextTick(() => {
    formModal ??= new Modal(formModalRef.value, { backdrop: 'static' })
    formModal.show()
  })
}

async function crear() {
  saving.value = true
  errores.value = {}
  try {
    const payload = {
      nombre: form.nombre,
      zona_horaria: form.zona_horaria,
      admin_nombre: form.admin_nombre,
      admin_email: form.admin_email,
    }
    const slug = (slugManual.value ? form.slug : slugPreview.value).trim()
    if (slug) payload.slug = slug
    if (form.admin_dni.trim()) payload.admin_dni = form.admin_dni.trim()

    const res = await crearParroquia(payload)
    formModal?.hide()
    credenciales.value = { parroquia: res.parroquia.nombre, ...res.admin }
    await nextTick()
    credsModal ??= new Modal(credsModalRef.value, { backdrop: 'static' })
    credsModal.show()
    await cargar()
  } catch (e) {
    errores.value = e?.response?.data?.errors || {}
    if (!Object.keys(errores.value).length) showAlerta('No se pudo crear la parroquia', 'error')
  } finally {
    saving.value = false
  }
}

function abrirDetalle(p) {
  editErrores.value = {}
  editSlugManual.value = false
  Object.assign(edit, {
    id: p.id, nombre: p.nombre, slug: p.slug, zona_horaria: p.zona_horaria || 'America/Lima',
    activa: p.activa, created_at: p.created_at,
    users_count: p.users_count, grupos_count: p.grupos_count, confirmandos_count: p.confirmandos_count,
  })
  nextTick(() => {
    detalleModal ??= new Modal(detalleModalRef.value, { backdrop: 'static' })
    detalleModal.show()
  })
}

async function guardarDetalle() {
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
    const i = parroquias.value.findIndex(p => p.id === edit.id)
    if (i !== -1) parroquias.value[i] = { ...parroquias.value[i], ...parroquia }
    detalleModal?.hide()
    showAlerta('Parroquia actualizada', 'success')
  } catch (e) {
    editErrores.value = e?.response?.data?.errors || {}
    if (!Object.keys(editErrores.value).length) showAlerta('No se pudo guardar', 'error')
  } finally {
    savingEdit.value = false
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

    <div class="surface table-wrap">
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
          <div class="modal-header">
            <h5 class="modal-title"><Building2 :size="18" class="me-2 d-inline-block align-text-bottom" />{{ edit.nombre }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" :disabled="savingEdit"></button>
          </div>
          <form @submit.prevent="guardarDetalle">
            <div class="modal-body">
              <div class="lp-stats">
                <div><b>{{ edit.users_count }}</b><span>Usuarios</span></div>
                <div><b>{{ edit.grupos_count }}</b><span>Grupos</span></div>
                <div><b>{{ edit.confirmandos_count }}</b><span>Confirmandos</span></div>
                <div><b class="text-sm"><Clock :size="13" class="inline" /> {{ fmtFecha(edit.created_at) }}</b><span>Creada</span></div>
              </div>

              <div class="grid gap-3 sm:grid-cols-2 mt-4">
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
                <label class="text-sm flex items-center gap-2 mt-6">
                  <input type="checkbox" v-model="edit.activa" class="!w-auto" />
                  <span>Parroquia activa</span>
                </label>
              </div>
              <p v-if="!edit.activa" class="mt-3 text-xs text-amber-600">
                Con la parroquia inactiva, sus usuarios no podrán iniciar sesión.
              </p>
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

.lp-link {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--parroquia-color, #2563eb);
  background: none;
  border: 0;
  cursor: pointer;
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
</style>
