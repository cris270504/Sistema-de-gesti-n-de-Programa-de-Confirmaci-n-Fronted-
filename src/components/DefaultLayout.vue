<template>
    <div class="layout">
        <!-- Sidebar navigation -->
        <Sidebar v-if="$route.meta.requiresLayout !== false" />

        <div class="content-wrapper">
            <!-- Top navigation bar -->
            <Navbar v-if="$route.meta.requiresLayout !== false" />

            <!-- Main content area -->
            <main class="main-content">
                <router-view />
            </main>
        </div>
    </div>
</template>

<script setup>
    import { watchEffect } from 'vue'
    import Sidebar from '../components/Sidebar.vue'
    import Navbar from '../components/Navbar.vue'
    import { useParroquiaStore } from '@/stores/parroquia'

    const parroquiaStore = useParroquiaStore()

    // Color primario de la parroquia como variable CSS global (--parroquia-color).
    watchEffect(() => {
      const color = parroquiaStore.branding.color_primario
      if (color) document.documentElement.style.setProperty('--parroquia-color', color)
    })
</script>

<style scoped>
    .layout {
        display: flex;
        height: 100vh;
        overflow: hidden;
    }

    /* Sidebar area */
    .content-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    /* Main scrollable content */
    .main-content {
        flex: 1;
        padding: 1rem;
        overflow-y: auto;
        background-color: #f9fafb;
    }
</style>