<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { rutaRedirectSegura } from '@/router';
import { showAlerta } from '@/funciones';
import PasswordField from '@/components/PasswordField.vue';
import AppCredit from '@/components/AppCredit.vue';

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const ui = useUiStore()

const draft = ref({ login: '', password: '' })
const saving = ref(false)

// El sistema aún no envía correos: la recuperación de contraseña se gestiona
// contactando al dueño/administrador del sistema.
const avisoContrasena = () => showAlerta(
    'Contáctate con el dueño del sistema para restablecer tu contraseña.',
    'info',
)

const submit = async () => {
    saving.value = true

    const ok = await auth.login(draft.value)

    if (!ok) {
        saving.value = false // Detiene la carga solo si falla
        return
    }

    // Login exitoso: mantenemos un overlay mientras se resuelve la navegación y
    // carga el panel (el backend en Render puede tardar en despertar).
    ui.showOverlay('Preparando tu panel…')

    // El proveedor de la plataforma siempre entra al panel de parroquias,
    // ignorando cualquier ?redirect (no opera el dashboard de una parroquia).
    const esProveedor = auth.user?.roles?.includes('proveedor')
    const destino = esProveedor
        ? { name: 'parroquias' }
        : (rutaRedirectSegura(route.query.redirect) || '/')

    await router.push(destino)
    // El componente se desmonta; el overlay lo apaga el afterEach del router.
}
</script>

<template>
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4 py-12">
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
                    <label for="login" class="block text-sm font-medium text-gray-700 mb-1">
                        Correo o DNI
                    </label>
                    <input id="login" v-model="draft.login" type="text" autocomplete="username" required
                        :disabled="saving" class="disabled:opacity-50"
                        placeholder="correo@ejemplo.com o tu DNI">
                </div>

                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label for="password" class="block text-sm font-medium text-gray-700">
                            Contraseña
                        </label>
                        <button type="button" @click="avisoContrasena"
                            class="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                            ¿Olvidaste tu contraseña?
                        </button>
                    </div>
                    <PasswordField id="password" v-model="draft.password" autocomplete="current-password" required
                        :disabled="saving" placeholder="••••••••" input-class="disabled:opacity-50" />
                </div>

                <div>
                    <button type="submit" :disabled="saving"
                        class="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out">
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

        <div class="mt-10 max-w-md">
            <AppCredit />
        </div>
    </div>
</template>
