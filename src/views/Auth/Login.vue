<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Fingerprint } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { rutaRedirectSegura } from '@/router';
import { showAlerta } from '@/funciones';
import {
    dispositivoCompatible, debeOfrecerHuella, descartarOferta, registrarPasskey, mensajePasskey,
} from '@/lib/passkeys';
import PasswordField from '@/components/PasswordField.vue';
import AppCredit from '@/components/AppCredit.vue';
import AppButton from '@/components/AppButton.vue';

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const ui = useUiStore()

const draft = ref({ login: '', password: '' })
const saving = ref(false)

// Huella / rostro (passkeys): solo si está habilitado (VITE_PASSKEYS) y el
// dispositivo tiene un autenticador propio.
const huellaDisponible = ref(false)
const entrandoHuella = ref(false)
const ofreciendoHuella = ref(false)
const activandoHuella = ref(false)
const tituloOferta = ref(null)
const pistaHuella = ref(false)

onMounted(async () => {
    huellaDisponible.value = await dispositivoCompatible()
})

// El sistema aún no envía correos: la recuperación de contraseña se gestiona
// con el administrador de la parroquia.
const avisoContrasena = () => showAlerta(
    'Pide al administrador de tu parroquia que restablezca tu contraseña.',
    'info',
)

async function irAlPanel() {
    // Overlay mientras se resuelve la navegación y carga el panel.
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

const submit = async () => {
    saving.value = true
    const ok = await auth.login(draft.value)
    if (!ok) {
        saving.value = false
        return
    }
    // Primera vez en este dispositivo con huella disponible: ofrecerla antes de
    // entrar (una sola vez; "Ahora no" se recuerda). Con contraseña temporal no:
    // primero tiene que elegir una nueva.
    if (!auth.debeCambiarPassword && await debeOfrecerHuella(auth.user?.id)) {
        saving.value = false
        ofreciendoHuella.value = true
        await nextTick()
        tituloOferta.value?.focus()
        return
    }
    await irAlPanel()
}

async function entrarConHuella() {
    entrandoHuella.value = true
    pistaHuella.value = false
    const ok = await auth.loginConHuella()
    if (!ok) {
        entrandoHuella.value = false
        // Sin mensaje de error = la persona cerró el diálogo del sistema. Lo más
        // común: "No hay llaves de acceso" porque aún no activó la huella aquí.
        if (!auth.error) pistaHuella.value = true
        return
    }
    await irAlPanel()
}

async function activarHuella() {
    activandoHuella.value = true
    try {
        await registrarPasskey()
        showAlerta('Listo: la próxima vez podrás entrar con tu huella.', 'success')
        await irAlPanel()
    } catch (e) {
        activandoHuella.value = false
        const msg = mensajePasskey(e)
        if (msg) showAlerta(msg, 'error')
    }
}

async function ahoraNo() {
    descartarOferta(auth.user?.id)
    await irAlPanel()
}
</script>

<template>
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900 px-4 py-12">
        <div class="w-full max-w-md !bg-white dark:!bg-slate-800 rounded-lg shadow-md p-6 md:p-8">
            <!-- Oferta: activar la huella tras entrar con contraseña -->
            <section v-if="ofreciendoHuella" class="huella-oferta" aria-labelledby="huella-oferta-titulo">
                <span class="huella-oferta__icono" aria-hidden="true"><Fingerprint :size="34" /></span>
                <h2 id="huella-oferta-titulo" ref="tituloOferta" tabindex="-1"
                    class="text-xl font-bold text-gray-900 dark:text-gray-50">
                    ¿Entrar con huella la próxima vez?
                </h2>
                <p class="text-sm text-gray-600 dark:text-gray-300">
                    Sin escribir tu DNI ni tu contraseña. Puedes usar la huella, el rostro o el PIN
                    de este dispositivo. Tu contraseña sigue funcionando.
                </p>
                <div class="huella-oferta__acciones">
                    <AppButton block :icon="Fingerprint" :loading="activandoHuella" @click="activarHuella">
                        {{ activandoHuella ? 'Esperando al dispositivo…' : 'Activar huella' }}
                    </AppButton>
                    <AppButton variant="ghost" block :disabled="activandoHuella" @click="ahoraNo">
                        Ahora no
                    </AppButton>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                    Puedes activarla o quitarla cuando quieras en «Mi perfil».
                </p>
            </section>

            <template v-else>
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
                        <input id="login" v-model="draft.login" type="text" autocomplete="username webauthn" required
                            :disabled="saving || entrandoHuella" class="disabled:opacity-50"
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
                            :disabled="saving || entrandoHuella" placeholder="••••••••" input-class="disabled:opacity-50" />
                    </div>

                    <div>
                        <AppButton type="submit" block :loading="saving" :disabled="entrandoHuella">
                            {{ saving ? 'Verificando...' : 'Ingresar' }}
                        </AppButton>
                    </div>
                </form>

                <!-- Alternativa sin contraseña: solo en dispositivos compatibles -->
                <div v-if="huellaDisponible" class="huella-alt">
                    <div class="huella-alt__separador" aria-hidden="true"><span>o</span></div>
                    <AppButton variant="secondary" block :icon="Fingerprint" :loading="entrandoHuella"
                        :disabled="saving" @click="entrarConHuella">
                        {{ entrandoHuella ? 'Esperando al dispositivo…' : 'Entrar con huella' }}
                    </AppButton>
                    <p v-if="pistaHuella" class="huella-alt__pista" role="status">
                        ¿Aún no activaste la huella en este dispositivo? Entra con tu DNI y contraseña
                        y te ofreceremos activarla (también desde «Mi perfil»).
                    </p>
                    <p v-else class="huella-alt__ayuda">Usa la huella, el rostro o el PIN registrados en este dispositivo.</p>
                </div>
            </template>
        </div>

        <div class="mt-10 max-w-md">
            <AppCredit />
        </div>
    </div>
</template>

<style scoped>
/* Objetivo táctil mínimo de 44px (se usa sobre todo en el celular). */
form :deep(button[type="submit"]),
.huella-alt :deep(button),
.huella-oferta__acciones :deep(button) {
    min-height: 44px;
}

.huella-alt {
    margin-top: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}
.huella-alt__separador {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-muted);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
}
.huella-alt__separador::before,
.huella-alt__separador::after {
    content: '';
    flex: 1;
    border-top: 1px solid var(--line);
}
.huella-alt__ayuda {
    margin: 0;
    text-align: center;
    font-size: var(--fs-xs);
    color: var(--text-muted);
}

.huella-alt__pista {
    margin: 0;
    padding: 0.65rem 0.8rem;
    border-radius: var(--radius-md);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    background: var(--accent-soft);
    color: var(--text);
    font-size: var(--fs-sm);
    line-height: 1.45;
    text-align: center;
}

.huella-oferta {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.9rem;
    padding-block: 0.5rem;
}
.huella-oferta__icono {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
}
.huella-oferta h2:focus { outline: none; }
.huella-oferta h2:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
.huella-oferta__acciones {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.25rem;
}
@media (prefers-reduced-motion: no-preference) {
    .huella-oferta { animation: huella-entra 0.22s var(--ease, ease-out); }
}
@keyframes huella-entra {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
}
</style>
