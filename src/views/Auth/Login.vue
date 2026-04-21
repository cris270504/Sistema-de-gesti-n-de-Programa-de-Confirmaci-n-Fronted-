<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const draft = ref({ dni: '', password: '' })
const saving = ref(false)

const submit = async () => {
    saving.value = true

    const ok = await auth.login(draft.value)

    if (!ok) {
        saving.value = false // Detiene la carga solo si falla
        return
    }

    // Login exitoso
    const redirect = typeof route.query.redirect === 'string'
        ? route.query.redirect
        : '/'; // Redirige a la raíz (ruta protegida) por defecto

    await router.push(redirect)
    // No es necesario limpiar saving o draft aquí, el componente se desmontará
}
</script>

<template>
    <div class="flex items-center justify-center min-h-screen bg-gray-100 px-4 py-12">
        <div class="w-full max-w-md bg-white rounded-lg shadow-md p-6 md:p-8">
            <div class="text-center mb-8">
                <img src="@/assets/logo.png" alt="Logo App" class="mx-auto h-49 w-auto mb-4" />
                <h2 class="text-2xl font-bold text-gray-900">
                    Iniciar Sesión
                </h2>
                <p class="mt-2 text-sm text-gray-600">
                    Ingresa tus credenciales para acceder
                </p>

            </div>

            <form class="space-y-6" @submit.prevent="submit">
                <div>
                    <label for="dni" class="block text-sm font-medium text-gray-700 mb-1">
                        DNI
                    </label>
                    <input id="dni" v-model="draft.dni" type="dni" required :disabled="saving"
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50"
                        placeholder="Ingresa tu DNI">
                </div>

                <div>
                    <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
                        Contraseña
                    </label>
                    <input id="password" v-model="draft.password" type="password" required :disabled="saving"
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50"
                        placeholder="••••••••">
                </div>

                <div>
                    <button type="submit" :disabled="saving"
                        class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out">
                        <svg v-if="saving" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4">
                            </circle>
                            <path class="opacity-75" fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                            </path>
                        </svg>
                        {{ saving ? 'Verificando...' : 'Ingresar' }}
                    </button>
                </div>

            </form>
        </div>
    </div>
</template>