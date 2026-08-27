<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useParroquiaStore } from '@/stores/parroquia'
import { Church, UserCircle, LogOut, Menu } from 'lucide-vue-next'

const authStore = useAuthStore()
const parroquiaStore = useParroquiaStore()
const router = useRouter()

defineEmits(['toggle-drawer'])

const tituloCorto = computed(() => parroquiaStore.branding?.nombre_publico || 'SGPC')

const handleLogout = () => {
  authStore.logout()
}

const goToProfile = () => {
  router.push('/profile');
}
</script>

<template>
  <nav
    class="sticky top-0 z-10 flex min-h-[64px] w-full items-center justify-between gap-3 border-b border-gray-100 bg-white px-3 py-2 shadow-sm sm:px-6">

    <div class="flex items-center gap-2 min-w-0">
      <button type="button" @click="$emit('toggle-drawer')"
        class="lg:hidden -ml-1 shrink-0 rounded-md p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        aria-label="Abrir menú">
        <Menu class="h-6 w-6" aria-hidden="true" />
      </button>

      <Church class="hidden h-5 w-5 shrink-0 text-primary sm:block" aria-hidden="true" />
      <p class="mb-0 truncate text-base font-semibold text-gray-700 sm:text-lg">
        <span class="hidden sm:inline">Sistema de Gestión del Programa de Confirmación</span>
        <span class="sm:hidden">{{ tituloCorto }}</span>
      </p>
    </div>

    <div class="flex shrink-0 items-center gap-3">

      <span v-if="authStore.user" class="hidden sm:block text-sm text-gray-600">
        Bienvenido, <span class="font-medium text-gray-800">{{ authStore.user.name }}</span>
      </span>

      <div v-if="authStore.isAuthenticated" class="relative flex items-center gap-1 border-l border-gray-100 pl-2 sm:pl-3">
        <button @click="goToProfile"
          class="p-2 rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          title="Mi Perfil">
          <UserCircle class="h-6 w-6" aria-hidden="true" />
        </button>

        <button @click="handleLogout"
          class="p-2 rounded-full text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          title="Cerrar Sesión">
          <LogOut class="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

    </div>
  </nav>
</template>
