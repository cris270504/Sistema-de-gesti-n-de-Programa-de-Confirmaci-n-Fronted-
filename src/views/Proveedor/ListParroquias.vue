<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { Modal } from 'bootstrap'
import { Plus, Check, X, Copy, Building2, KeyRound } from 'lucide-vue-next'
import { showAlerta, confirmar } from '@/funciones'
import { listParroquias, crearParroquia, actualizarParroquia } from '@/services/proveedor'
import AppPage from '@/components/AppPage.vue'

const parroquias = ref([])
const loading = ref(true)
const saving = ref(false)

const formModalRef = ref(null)
const credsModalRef = ref(null)
let formModal = null
let credsModal = null

const credenciales = ref(null) // { parroquia, email, temp_password }
const errores = ref({})
const form = reactive({ nombre: '', slug: '', admin_nombre: '', admin_email: '', admin_dni: '' })

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
})

function abrirAlta() {
  errores.value = {}
  Object.assign(form, { nombre: '', slug: '', admin_nombre: '', admin_email: '', admin_dni: '' })
  nextTick(() => {
    formModal ??= new Modal(formModalRef.value, { backdrop: 'static' })
    formModal.show()
  })
}

async function crear() {
  saving.value = true
  errores.value = {}
  try {
    const payload = { nombre: form.nombre, admin_nombre: form.admin_nombre, admin_email: form.admin_email }
    if (form.slug.trim()) payload.slug = form.slug.trim()
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
          </tr>
        </thead>
        <tbody>
          <tr v-if="parroquias.length === 0">
            <td colspan="6" class="empty-state">Aún no hay parroquias.</td>
          </tr>
          <tr v-for="p in parroquias" :key="p.id" :class="{ 'opacity-50': !p.activa }">
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
                :class="p.activa ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'"
                @click="cambiarEstado(p)">
                <Check v-if="p.activa" :size="12" /><X v-else :size="12" />
                {{ p.activa ? 'Activa' : 'Inactiva' }}
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
                  <input v-model="form.nombre" required maxlength="150"
                    class="mt-1 w-full rounded-md border-slate-300 text-sm" />
                  <small v-if="errores.nombre" class="text-rose-500">{{ errores.nombre[0] }}</small>
                </label>
                <label class="text-sm">Slug <span class="text-slate-400">(opcional)</span>
                  <input v-model="form.slug" maxlength="80" placeholder="se genera solo"
                    class="mt-1 w-full rounded-md border-slate-300 text-sm" />
                  <small v-if="errores.slug" class="text-rose-500">{{ errores.slug[0] }}</small>
                </label>
              </div>

              <p class="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Primer administrador</p>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="text-sm">Nombre <span class="text-rose-500">*</span>
                  <input v-model="form.admin_nombre" required maxlength="100"
                    class="mt-1 w-full rounded-md border-slate-300 text-sm" />
                </label>
                <label class="text-sm">Email <span class="text-rose-500">*</span>
                  <input v-model="form.admin_email" type="email" required
                    class="mt-1 w-full rounded-md border-slate-300 text-sm" />
                  <small v-if="errores.admin_email" class="text-rose-500">{{ errores.admin_email[0] }}</small>
                </label>
                <label class="text-sm sm:col-span-2 sm:w-1/2">DNI <span class="text-slate-400">(opcional)</span>
                  <input v-model="form.admin_dni" maxlength="20"
                    class="mt-1 w-full rounded-md border-slate-300 text-sm" />
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
