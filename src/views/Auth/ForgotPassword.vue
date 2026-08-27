<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore()

const email = ref('')
const saving = ref(false)
const enviado = ref(false)

const submit = async () => {
    saving.value = true
    const ok = await auth.forgotPassword(email.value)
    saving.value = false
    if (ok) enviado.value = true
}
</script>

<template>
    <div class="flex items-center justify-center min-h-screen bg-gray-100 px-4 py-12">
        <div class="w-full max-w-md bg-white rounded-lg shadow-md p-6 md:p-8">
            <div class="text-center mb-8">
                <img src="@/assets/logo.png" alt="Logo App" class="mx-auto h-49 w-auto mb-4" />
                <h2 class="text-2xl font-bold text-gray-900">
                    Recuperar contraseña
                </h2>
                <p class="mt-2 text-sm text-gray-600">
                    Ingresa el correo con el que te registraron y te enviaremos un enlace para
                    crear una nueva contraseña.
                </p>
            </div>

            <form v-if="!enviado" class="space-y-6" @submit.prevent="submit">
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                        Correo electrónico
                    </label>
                    <input id="email" v-model="email" type="email" required :disabled="saving"
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50"
                        placeholder="tucorreo@ejemplo.com">
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
                        {{ saving ? 'Enviando...' : 'Enviar enlace' }}
                    </button>
                </div>
            </form>

            <div v-else class="text-center text-sm text-gray-600">
                Si el correo existe en el sistema, te llegará un enlace para restablecer tu
                contraseña en unos minutos. Revisa también tu carpeta de spam.
            </div>

            <p class="mt-6 text-center text-sm text-gray-600">
                <RouterLink :to="{ name: 'login' }" class="font-medium text-indigo-600 hover:text-indigo-700">
                    Volver a iniciar sesión
                </RouterLink>
            </p>
        </div>
    </div>
</template>
