<script setup>
import AppButton from '@/components/AppButton.vue'
import { ref, computed, onMounted, defineAsyncComponent } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import { showAlerta } from '@/funciones';
import { Save, ShieldCheck, User, KeyRound } from 'lucide-vue-next';
import AppPage from '@/components/AppPage.vue';
import PasswordField from '@/components/PasswordField.vue';
import { PASSKEYS_HABILITADOS } from '@/lib/passkeys';

// Sección de huella: se descarga solo si la función está habilitada.
const HuellaPerfil = defineAsyncComponent(() => import('./HuellaPerfil.vue'));

const authStore = useAuthStore();
const router = useRouter();
// Quien entra solo con DNI (sin correo) puede seguir sin él.
const emailObligatorio = computed(() => !!authStore.user?.email);

// --- Estado para el formulario de Datos Personales ---
const profileDraft = ref({ name: '', email: '', dni: '' });
const savingProfile = ref(false);

// --- Estado para el formulario de Contraseña ---
const passwordDraft = ref({ password: '', password_confirmation: '' });
const savingPassword = ref(false);

onMounted(() => {
    if (authStore.user) {
        profileDraft.value = {
            name: authStore.user.name || '',
            email: authStore.user.email || '',
            dni: authStore.user.dni || 'N/A',
        };
    }
});

async function submitProfile() {
    savingProfile.value = true;
    const payload = { name: profileDraft.value.name, email: profileDraft.value.email };

    try {
        await authStore.updateProfile(payload);
        showAlerta('Perfil actualizado con éxito', 'success');
    } catch (e) {
        showAlerta(e?.message || 'No se pudo actualizar el perfil', 'error');
    } finally {
        savingProfile.value = false;
    }
}

async function submitPassword() {
    if (passwordDraft.value.password.length < 8) {
        showAlerta('La contraseña debe tener al menos 8 caracteres', 'warning');
        return;
    }
    if (passwordDraft.value.password !== passwordDraft.value.password_confirmation) {
        showAlerta('Las nuevas contraseñas no coinciden', 'warning');
        return;
    }

    savingPassword.value = true;
    const eraObligatorio = authStore.debeCambiarPassword;

    try {
        await authStore.cambiarPassword(passwordDraft.value.password);
        showAlerta('Contraseña actualizada con éxito', 'success');
        passwordDraft.value = { password: '', password_confirmation: '' };
        if (eraObligatorio) router.push({ name: 'dashboard' });
    } catch (e) {
        showAlerta(e?.message || 'No se pudo actualizar la contraseña', 'error');
    } finally {
        savingPassword.value = false;
    }
}
</script>

<template>
    <AppPage title="Mi perfil" subtitle="Tus datos y contraseña">
        <div class="prof-grid">

            <section class="surface surface--pad">
                <header class="prof-head">
                    <span class="prof-head__icon"><User :size="18" /></span>
                    <h2 class="prof-head__title">Datos personales</h2>
                </header>

                <form class="prof-form" @submit.prevent="submitProfile">
                    <label class="prof-field">
                        <span>DNI</span>
                        <input v-model="profileDraft.dni" type="text" readonly disabled>
                        <small>El DNI no se puede modificar.</small>
                    </label>

                    <label class="prof-field">
                        <span>Nombre completo <em>*</em></span>
                        <input v-model="profileDraft.name" type="text" required :disabled="savingProfile">
                    </label>

                    <label class="prof-field">
                        <span>Email <em v-if="emailObligatorio">*</em></span>
                        <input v-model="profileDraft.email" type="email" :required="emailObligatorio" :disabled="savingProfile">
                        <small>Usado para identificar tu cuenta y para la recuperación de contraseña.</small>
                    </label>

                    <div class="prof-actions">
                        <AppButton :icon="Save" :loading="savingProfile" type="submit">{{ savingProfile ? 'Guardando…' : 'Guardar cambios' }}</AppButton>
                    </div>
                </form>
            </section>

            <section class="surface surface--pad">
                <header class="prof-head">
                    <span class="prof-head__icon"><KeyRound :size="18" /></span>
                    <h2 class="prof-head__title">Cambiar contraseña</h2>
                </header>

                <form class="prof-form" @submit.prevent="submitPassword">
                    <p v-if="authStore.debeCambiarPassword" class="prof-obligatorio" role="alert">
                        El administrador restableció tu contraseña. Elige una nueva para seguir usando el sistema.
                    </p>
                    <p v-else class="prof-note">
                        Si es tu primer ingreso, usa la contraseña temporal que te dio el administrador
                        al crear tu cuenta. Se recomienda cambiarla.
                    </p>

                    <label class="prof-field">
                        <span>Nueva contraseña <em>*</em></span>
                        <PasswordField v-model="passwordDraft.password" autocomplete="new-password" required
                            :minlength="8" :disabled="savingPassword" placeholder="Mínimo 8 caracteres" />
                    </label>

                    <label class="prof-field">
                        <span>Confirmar contraseña <em>*</em></span>
                        <PasswordField v-model="passwordDraft.password_confirmation" autocomplete="new-password" required
                            :minlength="8" :disabled="savingPassword" placeholder="Repite la contraseña" />
                    </label>

                    <div class="prof-actions">
                        <AppButton :icon="ShieldCheck" :loading="savingPassword" type="submit">{{ savingPassword ? 'Actualizando…' : 'Actualizar contraseña' }}</AppButton>
                    </div>
                </form>
            </section>


            <HuellaPerfil v-if="PASSKEYS_HABILITADOS && !authStore.debeCambiarPassword" />
        </div>
    </AppPage>
</template>

<style scoped>
.prof-obligatorio {
    padding: 0.75rem 0.9rem;
    border-radius: var(--radius-md);
    border: 1px solid #f59e0b;
    background: color-mix(in srgb, #f59e0b 14%, transparent);
    color: var(--text);
    font-size: var(--fs-sm);
    font-weight: 600;
}

.prof-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
    gap: 1.25rem;
    align-items: start;
}

.prof-head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding-bottom: 0.9rem;
    margin-bottom: 1.1rem;
    border-bottom: 1px solid var(--line);
}
.prof-head__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    background: var(--accent-soft);
    color: var(--accent);
}
.prof-head__title {
    font-size: var(--fs-base);
    font-weight: 700;
    color: var(--text);
}

.prof-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.prof-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}
.prof-field > span {
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-muted);
}
.prof-field em {
    color: #dc2626;
    font-style: normal;
}
.prof-field small {
    font-size: var(--fs-xs);
    color: var(--text-muted);
}

.prof-note {
    font-size: var(--fs-sm);
    color: var(--text-muted);
    background: var(--surface-sunken);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 0.7rem 0.85rem;
}

.prof-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 0.25rem;
}
</style>
