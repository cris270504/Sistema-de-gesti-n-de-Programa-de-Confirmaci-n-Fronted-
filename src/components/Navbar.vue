<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { UserCircleIcon, ArrowLeftOnRectangleIcon } from '@heroicons/vue/24/outline'

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
  <nav class="sticky top-0 z-10 flex h-16 w-full items-center justify-between bg-white px-4 shadow-md shadow-blue-gray-900/5">

    <div class="flex items-center">
       <span class="ml-4 text-lg font-semibold text-gray-700 hidden md:block">SISTEMA DE GESTIÓN DEL PROGRAMA DE CATEQUESIS DE CONFIRMACIÓN</span>
    </div>

    <div class="flex items-center gap-4">

      <span v-if="authStore.user" class="hidden sm:block text-sm text-gray-600">
        Bienvenido, <span class="font-medium">{{ authStore.user.name }}</span>
      </span>

      <div v-if="authStore.isAuthenticated" class="relative">
         <button @click="goToProfile" class="p-2 rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" title="Mi Perfil">
           <UserCircleIcon class="h-6 w-6" />
         </button>

         <button @click="handleLogout" class="ml-2 p-2 rounded-full text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500" title="Cerrar Sesión">
           <ArrowLeftOnRectangleIcon class="h-6 w-6" />
         </button>
      </div>

    </div>
  </nav>
</template>

<style scoped>
/* Ajustes específicos si son necesarios */
.shadow-blue-gray-900\/5 { box-shadow: 0 4px 6px -1px rgba(26, 32, 44, 0.05), 0 2px 4px -1px rgba(26, 32, 44, 0.05); } /* Sombra similar al sidebar */
</style>