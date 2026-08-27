<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { showAlerta, showErroresDeValidacion } from '@/funciones';
import { Save, ShieldCheck, User, KeyRound } from 'lucide-vue-next';
import AppPage from '@/components/AppPage.vue';
import PasswordField from '@/components/PasswordField.vue';

const authStore = useAuthStore();

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
        const ok = await authStore.updateProfile(payload);
        if (ok) showAlerta('Perfil actualizado con éxito', 'success');
        else showAlerta('No se pudo actualizar el perfil', 'error');
    } catch (e) {
        console.error('Error al actualizar perfil:', e);
        showErroresDeValidacion(e?.response?.data?.errors || e);
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
    const payload = {
        password: passwordDraft.value.password,
        password_confirmation: passwordDraft.value.password_confirmation,
    };

    try {
        const ok = await authStore.updateProfile(payload);
        if (ok) {
            showAlerta('Contraseña actualizada con éxito', 'success');
            passwordDraft.value = { password: '', password_confirmation: '' };
        } else {
            showAlerta('No se pudo actualizar la contraseña', 'error');
        }
    } catch (e) {
        console.error('Error al actualizar contraseña:', e);
        showErroresDeValidacion(e?.response?.data?.errors || e);
    } finally {
        savingPassword.value = false;
    }
}
</script>

<template>
    <AppPage title="Mi perfil" subtitle="Tus datos y contraseña" :wide="false">
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
                        <span>Email <em>*</em></span>
                        <input v-model="profileDraft.email" type="email" required :disabled="savingProfile">
                        <small>Usado para identificar tu cuenta y para la recuperación de contraseña.</small>
                    </label>

                    <div class="prof-actions">
                        <button type="submit" class="btn-primary" :disabled="savingProfile">
                            <span v-if="savingProfile" class="spinner-border spinner-border-sm mr-1.5"></span>
                            <Save v-else :size="16" class="mr-1.5" />
                            <span class="text-sm">{{ savingProfile ? 'Guardando…' : 'Guardar cambios' }}</span>
                        </button>
                    </div>
                </form>
            </section>

            <section class="surface surface--pad">
                <header class="prof-head">
                    <span class="prof-head__icon"><KeyRound :size="18" /></span>
                    <h2 class="prof-head__title">Cambiar contraseña</h2>
                </header>

                <form class="prof-form" @submit.prevent="submitPassword">
                    <p class="prof-note">
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
                        <button type="submit" class="btn-success" :disabled="savingPassword">
                            <span v-if="savingPassword" class="spinner-border spinner-border-sm mr-1.5"></span>
                            <ShieldCheck v-else :size="16" class="mr-1.5" />
                            <span class="text-sm">{{ savingPassword ? 'Actualizando…' : 'Actualizar contraseña' }}</span>
                        </button>
                    </div>
                </form>
            </section>

        </div>
    </AppPage>
</template>

<style scoped>
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
    border-bottom: 1px solid #e2e8f0;
}
.prof-head__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: #eff6ff;
    color: var(--parroquia-color, #2563eb);
}
.prof-head__title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #1e293b;
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
    font-size: 0.8rem;
    font-weight: 600;
    color: #64748b;
}
.prof-field em {
    color: #dc2626;
    font-style: normal;
}
.prof-field small {
    font-size: 0.78rem;
    color: #94a3b8;
}

.prof-note {
    font-size: 0.82rem;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.7rem 0.85rem;
}

.prof-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 0.25rem;
}
</style>
