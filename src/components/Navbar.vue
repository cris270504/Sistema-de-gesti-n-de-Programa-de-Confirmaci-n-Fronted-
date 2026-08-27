<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Church, UserCircle, LogOut } from 'lucide-vue-next'

const authStore = useAuthStore()
const router = useRouter()

const emit = defineEmits(['toggle-sidebar'])

const handleLogout = () => {
  authStore.logout()
}

const goToProfile = () => {
  router.push('/profile');
}
</script>

<template>
  <nav class="sticky top-0 z-10 flex min-h-[64px] w-full items-center justify-between gap-4 border-b border-gray-100 bg-white px-4 py-2 shadow-sm sm:px-6">

    <div class="flex items-center gap-2 min-w-0">
      <Church class="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <p class="mb-0 truncate text-base font-semibold text-gray-700 sm:text-lg">
        Sistema de Gestión del Programa de Confirmación
      </p>
    </div>

    <div class="flex shrink-0 items-center gap-4">

      <span v-if="authStore.user" class="hidden sm:block text-sm text-gray-600">
        Bienvenido, <span class="font-medium text-gray-800">{{ authStore.user.name }}</span>
      </span>

      <div v-if="authStore.isAuthenticated" class="relative flex items-center gap-1 border-l border-gray-100 pl-3">
         <button @click="goToProfile" class="p-2 rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" title="Mi Perfil">
           <UserCircle class="h-6 w-6" aria-hidden="true" />
         </button>

         <button @click="handleLogout" class="p-2 rounded-full text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500" title="Cerrar Sesión">
           <LogOut class="h-6 w-6" aria-hidden="true" />
         </button>
      </div>

    </div>
  </nav>
</template>