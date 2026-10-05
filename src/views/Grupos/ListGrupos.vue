<script setup>
import AppEmpty from '@/components/AppEmpty.vue'
import AppButton from '@/components/AppButton.vue'
import { storeToRefs } from 'pinia';
import { onMounted, ref, watch } from 'vue'; // Agregamos watch
import { UserPlus, Pencil, Trash, Plus, Users, Calendar, Download, Layers } from 'lucide-vue-next';
import { useGruposStore } from '../../stores/grupos';
import { useParroquiaStore } from '@/stores/parroquia';
import GrupoModal from '../../components/Modals/grupoModal.vue';
import { showAlerta } from '@/funciones'; // Importamos showAlerta
import { exportarConfirmandosExcel } from '@/services/confirmandos';
import AppPage from '@/components/AppPage.vue';

const gruposStore = useGruposStore();
const parroquiaStore = useParroquiaStore();
const { items: grupos, loading, error } = storeToRefs(gruposStore);
const { fetchAll, remove: removeGrupo } = gruposStore;

// Referencia al modal
const modalRef = ref(null);
const isExporting = ref(false);
const borrandoId = ref(null);

async function remove(id, nombre) {
    if (borrandoId.value) return;
    borrandoId.value = id;
    try {
        await removeGrupo(id, nombre);
    } finally {
        borrandoId.value = null;
    }
}

// Monitorear errores del store y mostrarlos con alerta
watch(error, (newError) => {
    if (newError) {
        showAlerta(newError, 'error');
    }
});

const abrirCrear = () => {
    // Calculamos el año actual para pasarlo al modal (si tu modal soporta defaults)
    // O bien, el modal debe inicializarse internamente con este valor.
    const anioActual = new Date().getFullYear().toString();

    // Abrimos el modal. Si tu modal acepta un segundo parámetro para defaults, úsalo.
    // Si no, asegúrate de aplicar el cambio en el componente GrupoModal (ver abajo).
    modalRef.value.open(null, { periodo: anioActual });
};

const abrirEditar = (grupoId) => {
    modalRef.value.open(grupoId);
};

const recargarTabla = () => {
    fetchAll({ force: true });
};

const exportarDatos = async () => {
    if (isExporting.value) return;

    isExporting.value = true;
    try {
        await exportarConfirmandosExcel();
        showAlerta('Archivo exportado correctamente', 'success');
    } catch (err) {
        console.error("Error al exportar:", err);
        showAlerta(err?.message || 'Ocurrió un error al descargar el archivo', 'error');
    } finally {
        isExporting.value = false;
    }
};

onMounted(() => {
    fetchAll();
});
</script>

<template>
    <AppPage title="Grupos" subtitle="Grupos de catequesis" :loading="loading">
        <template #actions>
            <AppButton variant="secondary" :icon="Download" :loading="isExporting" @click="exportarDatos">{{ isExporting ? 'Exportando…' : 'Exportar' }}</AppButton>
            <AppButton :icon="Plus" @click="abrirCrear">Nuevo grupo</AppButton>
        </template>

        <div class="surface table-wrap cards-sm">
                <table class="table align-middle mb-0">
                    <thead class="bg-light-gray">
                        <tr>
                            <th class="ps-4 py-2 text-secondary fw-bold">Grupo / Periodo</th>
                            <th class="py-2 text-secondary fw-bold">Catequistas</th>
                            <th class="py-2 text-secondary fw-bold text-center">Confirmandos</th>
                            <th class="text-end pe-4 py-2 text-secondary fw-bold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="!grupos || grupos.length === 0">
                            <td colspan="4">
                                <AppEmpty :icon="Layers" message="Aún no hay grupos registrados.">
                                    <AppButton :icon="Plus" @click="abrirCrear">Nuevo grupo</AppButton>
                                </AppEmpty>
                            </td>
                        </tr>

                        <tr v-for="g in grupos" :key="g.id" class="hover-row">
                            <td class="ps-4 py-2">
                                <div class="d-flex align-items-center">
                                    <div class="color-dot me-3 shadow-sm"
                                        :style="{ backgroundColor: g.color || '#cbd5e1' }">
                                    </div>
                                    <div>
                                        <div class="fw-bold text-dark fs-6 lh-sm">{{ g.nombre }}</div>
                                        <div class="text-muted mt-1 small d-flex align-items-center">
                                            <Calendar :size="12" class="me-1" /> {{ g.periodo }}<template v-if="parroquiaStore.usaProcedencia && g.procedencia"> - {{ g.procedencia }}</template>
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <td class="py-2">
                                <div class="d-flex flex-wrap gap-1">
                                    <template v-if="g.catequistas && g.catequistas.length > 0">
                                        <span v-for="cat in g.catequistas" :key="cat.id" class="badge-catequista">
                                            {{ cat.name }}
                                        </span>
                                    </template>
                                    <span v-else class="text-muted fst-italic small px-1">Sin asignar</span>
                                </div>
                            </td>

                            <td class="py-2 text-center">
                                <span class="badge rounded-pill bg-light text-dark border px-3">
                                    <Users :size="12" class="me-1 text-secondary" />
                                    {{ g.confirmandos ? g.confirmandos.length : 0 }}
                                </span>
                            </td>

                            <td class="text-end pe-4 py-2">
                                <div class="d-inline-flex gap-2">
                                    <AppButton :to="{ path: 'grupos/' + g.id + '/asignacion' }" variant="soft" tone="success" icon-only
                                        title="Asignar Personas" aria-label="Asignar personas">
                                        <UserPlus :size="18" />
                                    </AppButton>

                                    <AppButton variant="soft" icon-only title="Editar" @click="abrirEditar(g.id)" aria-label="Editar"><Pencil :size="18" /></AppButton>

                                    <AppButton
                                      variant="soft"
                                      tone="danger"
                                      icon-only
                                      title="Eliminar"
                                      :aria-label="`Eliminar grupo ${g.nombre}`"
                                      :disabled="borrandoId === g.id"
                                      @click="remove(g.id, g.nombre)"><Trash :size="18" /></AppButton>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
        </div>
    </AppPage>

    <!-- Fuera de <AppPage> para que el estado de carga no lo desmonte -->
    <GrupoModal ref="modalRef" @saved="recargarTabla" />
</template>

<style scoped>
/* (Mismos estilos que tenías anteriormente) */
.page-title {
    font-size: var(--fs-xl);
    font-weight: 700;
    color: #111827;
    margin-bottom: 0;
    letter-spacing: -0.5px;
}

.page-subtitle {
    font-size: var(--fs-ui);
    color: #6b7280;
}

.color-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid var(--surface);
    box-shadow: 0 0 0 1px var(--line);
}

.bg-light-gray {
    background-color: var(--surface-sunken);
    border-bottom: 1px solid var(--line);
}

.bg-light-gray th {
    font-size: var(--fs-xs);
    letter-spacing: 0.5px;
}

.hover-row:hover td {
    background-color: var(--surface-sunken);
}

.hover-row td {
    border-bottom: 1px solid var(--line);
    color: #374151;
    font-size: var(--fs-base);
}

.badge-catequista {
    background-color: var(--surface-sunken);
    color: #4b5563;
    border: 1px solid var(--line);
    padding: 0.25em 0.65em;
    font-size: var(--fs-xs);
    font-weight: 600;
    border-radius: var(--radius-sm);
}
</style>