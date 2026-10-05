<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useParroquiaStore } from '@/stores/parroquia'
import { confirmar } from '@/funciones'
import { useTheme } from '@/composables/useTheme'
import { Church, UserCircle, LogOut, Menu, Sun, Moon } from 'lucide-vue-next'
import AppButton from '@/components/AppButton.vue'

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
      <AppButton variant="ghost" icon-only class="lg:hidden -ml-1 shrink-0" aria-label="Abrir menú" @click="$emit('toggle-drawer')">
        <Menu :size="22" />
      </AppButton>

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
        <AppButton variant="ghost" icon-only :aria-label="esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'" :title="esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'" @click="alternarTema">
          <Sun v-if="esOscuro" :size="22" />
          <Moon v-else :size="22" />
        </AppButton>

        <AppButton variant="ghost" icon-only title="Mi perfil" aria-label="Mi perfil" @click="goToProfile">
          <UserCircle :size="22" />
        </AppButton>

        <AppButton variant="soft-danger" icon-only title="Cerrar sesión" aria-label="Cerrar sesión" @click="handleLogout">
          <LogOut :size="22" />
        </AppButton>
      </div>

    </div>
  </nav>
</template>
