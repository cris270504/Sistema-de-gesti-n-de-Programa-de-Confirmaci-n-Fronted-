<script setup>
import { storeToRefs } from 'pinia';
import { onMounted, ref, watch } from 'vue'; // Agregamos watch
import { RouterLink } from 'vue-router';
import { UserPlus, Pencil, Trash, Plus, Users, Calendar } from 'lucide-vue-next';
import { useGruposStore } from '../../stores/grupos';
import GrupoModal from '../../components/Modals/grupoModal.vue';
import { showAlerta } from '@/funciones'; // Importamos showAlerta

const gruposStore = useGruposStore();
const { items: grupos, loading, error } = storeToRefs(gruposStore);
const { fetchAll, remove } = gruposStore;

// Referencia al modal
const modalRef = ref(null);

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
    fetchAll();
};

onMounted(() => {
    fetchAll();
});
</script>

<template>
    <div class="main-container">
        
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="page-title">Grupos Pastorales</h2>
                <p class="page-subtitle">Gestión de catequesis</p>
            </div>
            
            <button @click="abrirCrear" class="btn btn-primary shadow-sm px-3 py-2 d-flex align-items-center">
                <Plus :size="18" class="me-2" stroke-width="2.5" /> 
                <span class="fw-bold fs-7 text-uppercase">Nuevo Grupo</span>
            </button>
        </div>

        <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-secondary" role="status"></div>
        </div>

        <div v-else class="card border-0 shadow-sm rounded-3 overflow-hidden">
            <div class="table-responsive">
                <table class="table align-middle mb-0">
                    <thead class="bg-light-gray">
                        <tr>
                            <th class="ps-4 py-2 text-secondary text-uppercase fw-bold">Grupo / Periodo</th>
                            <th class="py-2 text-secondary text-uppercase fw-bold">Catequistas</th>
                            <th class="py-2 text-secondary text-uppercase fw-bold text-center">Confirmandos</th>
                            <th class="text-end pe-4 py-2 text-secondary text-uppercase fw-bold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="!grupos || grupos.length === 0">
                            <td colspan="4" class="text-center py-5 text-muted fs-5">No hay grupos registrados.</td>
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
                                            <Calendar :size="12" class="me-1" /> {{ g.periodo }}
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <td class="py-2">
                                <div class="d-flex flex-wrap gap-1">
                                    <template v-if="g.catequistas && g.catequistas.length > 0">
                                        <span v-for="cat in g.catequistas" :key="cat.id" 
                                              class="badge-catequista">
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
                                    <RouterLink :to="{ path: 'grupos/' + g.id + '/asignacion' }" 
                                                class="btn btn-action btn-soft-success" 
                                                title="Asignar Personas">
                                        <UserPlus :size="18" />
                                    </RouterLink>

                                    <button class="btn btn-action btn-soft-primary" title="Editar" @click="abrirEditar(g.id)">
                                        <Pencil :size="18" />
                                    </button>
                                    
                                    <button class="btn btn-action btn-soft-danger" title="Eliminar" @click="remove(g.id, g.nombre)">
                                        <Trash :size="18" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <GrupoModal ref="modalRef" @saved="recargarTabla" />

    </div>
</template>

<style scoped>
/* (Mismos estilos que tenías anteriormente) */
.page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 0;
    letter-spacing: -0.5px;
}
.page-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
}
.color-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px #e5e7eb;
}
.bg-light-gray { background-color: #f8fafc; border-bottom: 1px solid #e5e7eb; }
.bg-light-gray th { font-size: 0.75rem; letter-spacing: 0.5px; }
.hover-row:hover td { background-color: #f9fafb; }
.hover-row td { border-bottom: 1px solid #f3f4f6; color: #374151; font-size: 0.95rem; }
.badge-catequista {
    background-color: #f3f4f6;
    color: #4b5563;
    border: 1px solid #e5e7eb;
    padding: 0.25em 0.65em;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 6px;
}
.btn-action { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: none; transition: all 0.2s; }
.btn-soft-success { background-color: #f0fdf4; color: #16a34a; }
.btn-soft-success:hover { background-color: #16a34a; color: white; transform: translateY(-2px); }
.btn-soft-primary { background-color: #eff6ff; color: #2563eb; border: 1px solid #dbeafe; }
.btn-soft-primary:hover { background-color: #2563eb; color: white; transform: translateY(-2px); }
.btn-soft-danger { background-color: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
.btn-soft-danger:hover { background-color: #ef4444; color: white; transform: translateY(-2px); }
.btn-primary {
  background-color: #2563eb;
  border-color: #2563eb;
  font-size: 0.9rem;
}
.btn-primary:hover {
  background-color: #1d4ed8;
}
</style>