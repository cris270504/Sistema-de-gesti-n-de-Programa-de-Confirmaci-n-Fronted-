<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Plus, Check, X, Copy } from 'lucide-vue-next'
import { showAlerta } from '@/funciones'
import { listParroquias, crearParroquia, actualizarParroquia } from '@/services/proveedor'

const parroquias = ref([])
const loading = ref(true)
const showForm = ref(false)
const saving = ref(false)
const nuevoAdmin = ref(null) // { email, temp_password }

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

async function toggleActiva(p) {
  const activa = !p.activa
  try {
    await actualizarParroquia(p.id, { activa })
    p.activa = activa
  } catch {
    showAlerta('No se pudo cambiar el estado', 'error')
  }
}

async function crear() {
  saving.value = true
  try {
    const payload = { nombre: form.nombre, admin_nombre: form.admin_nombre, admin_email: form.admin_email }
    if (form.slug.trim()) payload.slug = form.slug.trim()
    if (form.admin_dni.trim()) payload.admin_dni = form.admin_dni.trim()

    const res = await crearParroquia(payload)
    nuevoAdmin.value = { parroquia: res.parroquia.nombre, ...res.admin }
    showForm.value = false
    Object.assign(form, { nombre: '', slug: '', admin_nombre: '', admin_email: '', admin_dni: '' })
    await cargar()
  } catch (e) {
    const errs = e?.response?.data?.errors
    showAlerta(errs ? Object.values(errs).flat().join('\n') : 'No se pudo crear la parroquia', 'error')
  } finally {
    saving.value = false
  }
}

function copiar(txt) {
  navigator.clipboard?.writeText(txt)
  showAlerta('Copiado', 'success')
}
</script>

<template>
  <div class="!p-4 md:p-6">
    <div class="flex items-center justify-between mb-5">
      <div>
        <h2 class="text-xl font-semibold text-slate-800 !mb-1">Parroquias</h2>
        <p class="text-sm text-slate-500 mb-0">Panel del proveedor de la plataforma.</p>
      </div>
      <button class="btn-primary inline-flex items-center gap-2" @click="showForm = !showForm">
        <Plus :size="16" /> Nueva parroquia
      </button>
    </div>

    <!-- Contraseña temporal del admin recién creado -->
    <div v-if="nuevoAdmin" class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
      <p class="font-semibold text-emerald-800">Parroquia «{{ nuevoAdmin.parroquia }}» creada.</p>
      <p class="text-emerald-700">Admin: <b>{{ nuevoAdmin.email }}</b></p>
      <p class="text-emerald-700 flex items-center gap-2">
        Contraseña temporal: <code class="rounded bg-white px-1.5 py-0.5">{{ nuevoAdmin.temp_password }}</code>
        <button class="text-emerald-700 hover:text-emerald-900" @click="copiar(nuevoAdmin.temp_password)"><Copy :size="14" /></button>
      </p>
      <p class="mt-1 text-xs text-emerald-600">Anótala ahora, no se vuelve a mostrar.</p>
      <button class="mt-1 text-xs text-emerald-700 underline" @click="nuevoAdmin = null">Ocultar</button>
    </div>

    <!-- Formulario de alta -->
    <form v-if="showForm" class="mb-5 rounded-xl border bg-white p-5 grid gap-3 sm:grid-cols-2" @submit.prevent="crear">
      <label class="text-sm">Nombre de la parroquia
        <input v-model="form.nombre" required maxlength="150" class="mt-1 w-full rounded-md border-slate-300 text-sm" />
      </label>
      <label class="text-sm">Slug <span class="text-slate-400">(opcional)</span>
        <input v-model="form.slug" maxlength="80" placeholder="se genera solo" class="mt-1 w-full rounded-md border-slate-300 text-sm" />
      </label>
      <label class="text-sm">Nombre del administrador
        <input v-model="form.admin_nombre" required maxlength="100" class="mt-1 w-full rounded-md border-slate-300 text-sm" />
      </label>
      <label class="text-sm">Email del administrador
        <input v-model="form.admin_email" type="email" required class="mt-1 w-full rounded-md border-slate-300 text-sm" />
      </label>
      <label class="text-sm">DNI del administrador <span class="text-slate-400">(opcional)</span>
        <input v-model="form.admin_dni" maxlength="20" class="mt-1 w-full rounded-md border-slate-300 text-sm" />
      </label>
      <div class="sm:col-span-2 flex justify-end gap-2">
        <button type="button" class="rounded-md border px-3 py-1.5 text-sm" @click="showForm = false">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Creando…' : 'Crear parroquia' }}</button>
      </div>
    </form>

    <div v-if="loading" class="py-16 text-center text-slate-400">Cargando…</div>
    <div v-else class="overflow-x-auto rounded-xl border bg-white">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left">Parroquia</th>
            <th class="px-4 py-2 text-left">Slug</th>
            <th class="px-4 py-2 text-center">Usuarios</th>
            <th class="px-4 py-2 text-center">Grupos</th>
            <th class="px-4 py-2 text-center">Confirmandos</th>
            <th class="px-4 py-2 text-center">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in parroquias" :key="p.id" class="border-t">
            <td class="px-4 py-2 font-medium text-slate-800">{{ p.nombre }}</td>
            <td class="px-4 py-2 text-slate-500">{{ p.slug }}</td>
            <td class="px-4 py-2 text-center">{{ p.users_count }}</td>
            <td class="px-4 py-2 text-center">{{ p.grupos_count }}</td>
            <td class="px-4 py-2 text-center">{{ p.confirmandos_count }}</td>
            <td class="px-4 py-2 text-center">
              <button
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                :class="p.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'"
                @click="toggleActiva(p)">
                <Check v-if="p.activa" :size="12" /><X v-else :size="12" />
                {{ p.activa ? 'Activa' : 'Inactiva' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
