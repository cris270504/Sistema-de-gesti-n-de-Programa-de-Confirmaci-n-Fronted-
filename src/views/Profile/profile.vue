<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth'; // Asegúrate que la ruta al store sea correcta
import { showAlerta, showErroresDeValidacion } from '@/funciones'; // Importa tus funciones de alerta

const authStore = useAuthStore();

// --- Estado para el formulario de Datos Personales ---
const profileDraft = ref({
    name: '',
    email: '',
    dni: ''
});
const savingProfile = ref(false);

// --- Estado para el formulario de Contraseña ---
const passwordDraft = ref({
    password: '',
    password_confirmation: ''
});
const savingPassword = ref(false);

// Carga los datos del usuario logueado en el formulario al montar el componente
onMounted(() => {
    if (authStore.user) {
        profileDraft.value = {
            name: authStore.user.name || '',
            email: authStore.user.email || '',
            dni: authStore.user.dni || 'N/A' // Muestra el DNI
        };
    }
});

/**
 * Envía la actualización de los datos personales (Nombre, Email)
 */
async function submitProfile() {
    savingProfile.value = true;

    // Prepara el payload solo con lo que se puede cambiar
    const payload = {
        name: profileDraft.value.name,
        email: profileDraft.value.email
    };

    try {
        // Llama a la acción del store (asume que existe y maneja la API)
        // El store debe ser lo suficientemente inteligente para llamar a:
        // api.put(`/users/${authStore.user.id}`, payload)
        const ok = await authStore.updateProfile(payload);

        if (ok) {
            showAlerta('Perfil actualizado con éxito', 'success');
        } else {
            // Si la acción del store devuelve 'false' pero no lanza error
            showAlerta('No se pudo actualizar el perfil', 'error');
        }
    } catch (e) {
        console.error("Error al actualizar perfil:", e);
        // Muestra errores de validación si el store los lanza
        showErroresDeValidacion(e?.response?.data?.errors || e);
    } finally {
        savingProfile.value = false;
    }
}

/**
 * Envía la actualización de la contraseña
 */
async function submitPassword() {
    // Validación de contraseña
    if (passwordDraft.value.password.length < 8) {
        showAlerta('La contraseña debe tener al menos 8 caracteres', 'warning');
        return;
    }
    if (passwordDraft.value.password !== passwordDraft.value.password_confirmation) {
        showAlerta('Las nuevas contraseñas no coinciden', 'warning');
        return;
    }

    savingPassword.value = true;

    // El payload solo contiene la contraseña
    const payload = {
        password: passwordDraft.value.password,
        password_confirmation: passwordDraft.value.password_confirmation
    };

    try {
        // Reutiliza la misma acción del store para enviar el payload de contraseña
        const ok = await authStore.updateProfile(payload);

        if (ok) {
            showAlerta('Contraseña actualizada con éxito', 'success');
            // Limpia los campos de contraseña después de éxito
            passwordDraft.value = { password: '', password_confirmation: '' };
        } else {
            showAlerta('No se pudo actualizar la contraseña', 'error');
        }
    } catch (e) {
        console.error("Error al actualizar contraseña:", e);
        showErroresDeValidacion(e?.response?.data?.errors || e);
    } finally {
        savingPassword.value = false;
    }
}
</script>

<template>
    <div class="container-fluid p-4">
        <h2 class="title mb-4">Mi Perfil</h2>

        <div class="row g-4">

            <div class="col-lg-6">
                <div class="card h-100 shadow-sm">
                    <div class="card-header bg-dark text-white">
                        <h5 class="mb-0">Datos Personales</h5>
                    </div>
                    <div class="card-body">
                        <form @submit.prevent="submitProfile">

                            <div class="mb-3">
                                <label for="profileDni" class="form-label">DNI</label>
                                <input id="profileDni" v-model="profileDraft.dni" type="text" class="form-control"
                                    readonly disabled>
                                <div class="form-text">El DNI no se puede modificar.</div>
                            </div>

                            <div class="mb-3">
                                <label for="profileName" class="form-label">Nombre Completo <span
                                        class="text-danger">*</span></label>
                                <input id="profileName" v-model="profileDraft.name" type="text" class="form-control"
                                    required :disabled="savingProfile">
                            </div>

                            <div class="mb-3">
                                <label for="profileEmail" class="form-label">Email <span
                                        class="text-danger">*</span></label>
                                <input id="profileEmail" v-model="profileDraft.email" type="email" class="form-control"
                                    required :disabled="savingProfile">
                                <div class="form-text">Usado para notificaciones y recuperación de contraseña.</div>
                            </div>

                            <div class="d-flex justify-content-end">
                                <button type="submit" class="btn btn-primary" :disabled="savingProfile">
                                    <span v-if="savingProfile" class="spinner-border spinner-border-sm me-1"
                                        role="status" aria-hidden="true"></span>
                                    <i v-else class="bi bi-save me-1"></i>
                                    {{ savingProfile ? 'Guardando...' : 'Guardar Cambios' }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <div class="col-lg-6">
                <div class="card h-100 shadow-sm">
                    <div class="card-header bg-dark text-white">
                        <h5 class="mb-0">Cambiar Contraseña</h5>
                    </div>
                    <div class="card-body">
                        <form @submit.prevent="submitPassword">
                            <div class="form-text mb-3">
                                Si es tu primer ingreso, la contraseña por defecto es '123456789'. Se recomienda
                                cambiarla.
                            </div>

                            <div class="mb-3">
                                <label for="newPassword" class="form-label">Nueva Contraseña <span
                                        class="text-danger">*</span></label>
                                <input id="newPassword" v-model="passwordDraft.password" type="password"
                                    class="form-control" required minlength="8" :disabled="savingPassword"
                                    placeholder="Mínimo 8 caracteres">
                            </div>

                            <div class="mb-3">
                                <label for="confirmPassword" class="form-label">Confirmar Contraseña <span
                                        class="text-danger">*</span></label>
                                <input id="confirmPassword" v-model="passwordDraft.password_confirmation"
                                    type="password" class="form-control" required minlength="8"
                                    :disabled="savingPassword" placeholder="Repite la contraseña">
                            </div>

                            <div class="d-flex justify-content-end">
                                <button type="submit" class="btn btn-success" :disabled="savingPassword">
                                    <span v-if="savingPassword" class="spinner-border spinner-border-sm me-1"
                                        role="status" aria-hidden="true"></span>
                                    <i v-else class="bi bi-shield-lock me-1"></i>
                                    {{ savingPassword ? 'Actualizando...' : 'Actualizar Contraseña' }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
.form-text {
    font-size: 0.875em;
    color: #6c757d;
}

.text-danger {
    color: #dc3545;
}
</style>