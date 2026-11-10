<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useParroquiaStore } from '@/stores/parroquia'
import { confirmar } from '@/funciones'
import { useTheme } from '@/composables/useTheme'
import { Church, UserCircle, LogOut, Menu, Sun, Moon, ShieldCheck } from 'lucide-vue-next'
import AppButton from '@/components/AppButton.vue'
import { useMediaQuery } from '@/composables/useMediaQuery'

const authStore = useAuthStore()
// Mismo corte que DefaultLayout: el botón solo existe cuando la barra es cajón.
// (Una clase de Tailwind tipo `lg:hidden` no sirve aquí: AppButton declara su
// `display` en CSS propio, que gana a las utilidades de Tailwind v4 por capas.)
const esCajon = useMediaQuery('not all and (min-width: 1024px)')
const parroquiaStore = useParroquiaStore()
const router = useRouter()
const { esOscuro, alternarTema } = useTheme()

defineEmits(['toggle-drawer'])
// sinMenu: consola del proveedor (no hay barra lateral que abrir).
const props = defineProps({ sinMenu: { type: Boolean, default: false } })

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
      <AppButton v-if="esCajon && !props.sinMenu" variant="ghost" icon-only class="-ml-1 shrink-0" aria-label="Abrir menú" @click="$emit('toggle-drawer')">
        <Menu :size="22" />
      </AppButton>

      <template v-if="props.sinMenu">
        <router-link :to="{ name: 'parroquias' }" class="nav-consola" aria-label="Consola del proveedor: parroquias">
          <span class="nav-consola__ico" aria-hidden="true"><ShieldCheck :size="18" /></span>
          <span class="nav-consola__txt">
            <span class="nav-consola__titulo">SGPC</span>
            <span class="nav-consola__sub">Consola del proveedor</span>
          </span>
        </router-link>
      </template>
      <template v-else>
        <Church class="hidden h-5 w-5 shrink-0 text-primary sm:block" aria-hidden="true" />
        <p class="mb-0 truncate text-base font-semibold text-gray-700 dark:text-gray-200 sm:text-lg">
          <span class="hidden sm:inline">Sistema de Gestión del Programa de {{ parroquiaStore.programaNombre }}</span>
          <span class="sm:hidden">{{ tituloCorto }}</span>
        </p>
      </template>
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

<style scoped>
.nav-consola {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 44px;
  text-decoration: none;
  border-radius: var(--radius-md);
}
.nav-consola:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.nav-consola__ico {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #fff;
  flex-shrink: 0;
}
.nav-consola__txt { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.nav-consola__titulo { font-weight: 800; font-size: var(--fs-base); color: var(--text); letter-spacing: -0.01em; }
.nav-consola__sub { font-size: var(--fs-xs); color: var(--text-muted); white-space: nowrap; }
</style>
