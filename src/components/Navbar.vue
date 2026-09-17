<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useParroquiaStore } from '@/stores/parroquia'
import { confirmar } from '@/funciones'
import { useTheme } from '@/composables/useTheme'
import { Church, UserCircle, LogOut, Menu, Sun, Moon } from 'lucide-vue-next'

const authStore = useAuthStore()
const parroquiaStore = useParroquiaStore()
const router = useRouter()
const { esOscuro, alternarTema } = useTheme()

defineEmits(['toggle-drawer'])

const tituloCorto = computed(() => parroquiaStore.branding?.nombre_publico || 'SGPC')

const handleLogout = async () => {
  const ok = await confirmar({
    titulo: '¿Cerrar sesión?',
    texto: 'Tendrás que volver a iniciar sesión para continuar.',
    icono: 'question',
    confirmarTexto: 'Sí, cerrar sesión',
  })
  if (!ok) return
  authStore.logout()
}

const goToProfile = () => {
  router.push('/profile');
}
</script>

<template>
  <nav
    class="sticky top-0 z-10 flex min-h-[64px] w-full items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-700 !bg-white dark:!bg-slate-800 px-3 py-2 shadow-sm sm:px-6">

    <div class="flex items-center gap-2 min-w-0">
      <button type="button" @click="$emit('toggle-drawer')"
        class="lg:hidden -ml-1 shrink-0 rounded-md p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        aria-label="Abrir menú">
        <Menu class="h-6 w-6" aria-hidden="true" />
      </button>

      <Church class="hidden h-5 w-5 shrink-0 text-primary sm:block" aria-hidden="true" />
      <p class="mb-0 truncate text-base font-semibold text-gray-700 dark:text-gray-200 sm:text-lg">
        <span class="hidden sm:inline">Sistema de Gestión del Programa de {{ parroquiaStore.programaNombre }}</span>
        <span class="sm:hidden">{{ tituloCorto }}</span>
      </p>
    </div>

    <div class="flex shrink-0 items-center gap-3">

      <span v-if="authStore.user" class="hidden sm:block text-sm text-gray-600 dark:text-gray-400">
        Bienvenido, <span class="font-medium text-gray-800 dark:text-gray-100">{{ authStore.user.name }}</span>
      </span>

      <div v-if="authStore.isAuthenticated" class="relative flex items-center gap-1 border-l border-gray-100 dark:border-slate-700 pl-2 sm:pl-3">
        <button @click="alternarTema"
          class="p-2 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          :aria-label="esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
          :title="esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'">
          <Sun v-if="esOscuro" class="h-6 w-6" aria-hidden="true" />
          <Moon v-else class="h-6 w-6" aria-hidden="true" />
        </button>

        <button @click="goToProfile"
          class="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          title="Mi Perfil">
          <UserCircle class="h-6 w-6" aria-hidden="true" />
        </button>

        <button @click="handleLogout"
          class="p-2 rounded-full text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          title="Cerrar Sesión">
          <LogOut class="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

    </div>
  </nav>
</template>
