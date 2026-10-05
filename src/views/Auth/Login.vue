<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { rutaRedirectSegura } from '@/router';
import { showAlerta } from '@/funciones';
import PasswordField from '@/components/PasswordField.vue';
import AppCredit from '@/components/AppCredit.vue';
import AppButton from '@/components/AppButton.vue';

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
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900 px-4 py-12">
        <div class="w-full max-w-md !bg-white dark:!bg-slate-800 rounded-lg shadow-md p-6 md:p-8">
            <div class="text-center mb-8">
                <img src="@/assets/logo.png" alt="Logo App" class="mx-auto h-49 w-auto mb-4" />
                <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-50">
                    Iniciar Sesión
                </h2>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Ingresa tus credenciales para acceder
                </p>
            </div>

            <form class="space-y-6" @submit.prevent="submit">
                <div>
                    <label for="login" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Correo o DNI
                    </label>
                    <input id="login" v-model="draft.login" type="text" autocomplete="username" required
                        :disabled="saving" class="disabled:opacity-50"
                        placeholder="correo@ejemplo.com o tu DNI">
                </div>

                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Contraseña
                        </label>
                        <button type="button" @click="avisoContrasena"
                            class="text-sm font-medium text-[var(--accent)] hover:opacity-80">
                            ¿Olvidaste tu contraseña?
                        </button>
                    </div>
                    <PasswordField id="password" v-model="draft.password" autocomplete="current-password" required
                        :disabled="saving" placeholder="••••••••" input-class="disabled:opacity-50" />
                </div>

                <div>
                    <AppButton type="submit" block :loading="saving">{{ saving ? 'Verificando...' : 'Ingresar' }}</AppButton>
                </div>
            </form>
        </div>

        <div class="mt-10 max-w-md">
            <AppCredit />
        </div>
    </div>
</template>
