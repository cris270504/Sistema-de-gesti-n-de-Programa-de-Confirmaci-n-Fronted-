<template>
    <div class="layout">
        <template v-if="showChrome">
            <!-- Backdrop del cajón (solo móvil/tablet) -->
            <Transition name="fade">
                <div v-if="drawerOpen" class="drawer-backdrop" @click="drawerOpen = false" />
            </Transition>

            <!-- Barra lateral: en escritorio es fija; bajo lg es un cajón deslizante -->
            <div class="sidebar-host" :class="{ 'sidebar-host--open': drawerOpen }">
                <Sidebar :drawer-mode="isMobileNav" @close="drawerOpen = false" />
            </div>
        </template>

        <div class="content-wrapper">
            <Navbar v-if="showChrome" @toggle-drawer="drawerOpen = !drawerOpen" />

            <main class="main-content" :class="{ 'main-content--with-bottomnav': showBottomNav }">
                <router-view />
            </main>

            <footer v-if="showChrome" class="app-footer"
                :class="{ 'app-footer--with-bottomnav': showBottomNav }">
                <AppCredit />
            </footer>

            <BottomNav v-if="showBottomNav" />
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from '../components/Sidebar.vue'
import Navbar from '../components/Navbar.vue'
import BottomNav from '../components/BottomNav.vue'
import AppCredit from '../components/AppCredit.vue'
import { useParroquiaStore } from '@/stores/parroquia'
import { useAuthStore } from '@/stores/auth'
import { useMediaQuery } from '@/composables/useMediaQuery'

const route = useRoute()
const parroquiaStore = useParroquiaStore()
const authStore = useAuthStore()

// Color primario de la parroquia como variable CSS global (--parroquia-color).
watch(
  () => parroquiaStore.branding.color_primario,
  (color) => { if (color) document.documentElement.style.setProperty('--parroquia-color', color) },
  { immediate: true }
)

const isMobileNav = useMediaQuery('(max-width: 1023px)')
const isPhone = useMediaQuery('(max-width: 767px)')

const drawerOpen = ref(false)

const showChrome = computed(() => route.meta.requiresLayout !== false)
const tieneGrupo = computed(() => (authStore.user?.grupo_ids?.length || 0) > 0)
const showBottomNav = computed(() => showChrome.value && isPhone.value && tieneGrupo.value)

// El cajón se cierra al navegar y al pasar a escritorio.
watch(() => route.fullPath, () => { drawerOpen.value = false })
watch(isMobileNav, (mobil) => { if (!mobil) drawerOpen.value = false })

// Bloquea el scroll del fondo mientras el cajón está abierto.
watch(drawerOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})
onUnmounted(() => { document.body.style.overflow = '' })
</script>

<style scoped>
.layout {
    display: flex;
    min-height: 100vh;
    min-height: 100dvh;
}

.content-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    /* evita que tablas anchas desborden la pantalla en móvil */
}

.main-content {
    flex: 1;
    padding: 0.75rem;
    background-color: #f9fafb;
    /* Móvil: la página hace scroll normal; el scroll propio es solo de escritorio. */
    overflow-y: visible;
}

.main-content--with-bottomnav {
    padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 0.5rem);
}

.app-footer {
    flex-shrink: 0;
    border-top: 1px solid #eef2f6;
    background: #fff;
    padding: 6px 12px;
}

.app-footer--with-bottomnav {
    margin-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
}

/* ===== Móvil / tablet: barra lateral como cajón ===== */
@media (max-width: 1023px) {
    .sidebar-host {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        z-index: 60;
        width: min(288px, 84vw);
        transform: translateX(-100%);
        transition: transform 0.25s ease;
        box-shadow: 0 10px 40px rgba(15, 23, 42, 0.18);
    }

    .sidebar-host--open {
        transform: translateX(0);
    }
}

.drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 55;
    background: rgba(15, 23, 42, 0.45);
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* ===== Escritorio: app-shell con sidebar fija y contenido con scroll propio ===== */
@media (min-width: 1024px) {
    .layout {
        height: 100vh;
        height: 100dvh;
        overflow: hidden;
    }

    .sidebar-host {
        flex-shrink: 0;
        height: 100%;
    }

    .content-wrapper {
        overflow: hidden;
    }

    .main-content {
        padding: 1rem;
        overflow-y: auto;
    }
}
</style>
