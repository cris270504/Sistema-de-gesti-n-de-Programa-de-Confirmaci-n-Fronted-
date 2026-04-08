import { defineStore } from 'pinia'
import { confirmarEliminacion, showAlerta, showErroresDeValidacion } from '@/funciones'
import { createGrupo, deleteGrupoById, getGrupoById, getGruposList, syncCatequists, updateGrupo, syncConfirmandos, getApoderadosByGrupo, generarGruposEquitativos } from '../services/grupos';

export const useGruposStore = defineStore('grupos', {
    state: () => ({
        items: [],
        loading: false,
        error: null,
    }),

    getters: {
        byId: (state) => (id) => state.items.find(c => c.id === Number(id)),
        count: (state) => state.items.length,
    },

    actions: {
        async fetchAll() {
            this.loading = true
            this.error = null
            try {
                this.items = await getGruposList()
            } catch (e) {
                this.error = e?.response?.data?.message || e?.message || 'Error al listar grupos'
                showAlerta(this.error, 'error')
            } finally {
                this.loading = false
            }
        },
        async fetchById(id) {
            this.loading = true
            this.error = null
            try {
                const grupoId = Number(id);
                const grupo = await getGrupoById(grupoId)
                const idx = this.items.findIndex(c => c.id === grupoId)

                if (idx === -1) {
                    this.items.unshift(grupo)
                } else {
                    this.items[idx] = grupo
                }
                return grupo;
            } catch (e) {
                this.error = e?.response?.data?.message || e?.message || `Error al obtener grupo ${id}`
                showAlerta(this.error, 'error');
                throw e;
            } finally {
                this.loading = false
            }
        },

        async add(grupoPayload) {
            try {
                const response = await createGrupo(grupoPayload);
                const created = response?.grupo;
                if (!created) {
                    throw new Error('La API no devolvió un grupo válido.');
                }

                this.items.unshift(created)

                const name = created?.nombre

                showAlerta(
                    `Grupo ${name} creado correctamente.`,
                    'success'
                );
                return created
            } catch (e) {
                showErroresDeValidacion(e?.response?.data?.errors || e)
                throw e
            }
        },

        async save(id, grupo) {
            try {
                const response = await updateGrupo(id, grupo);
                const updated = response?.grupo;

                if (!updated) {
                    throw new Error('La API no devolvió un grupo actualizado.');
                }

                const idx = this.items.findIndex(c => c.id === id)
                if (idx !== -1) this.items[idx] = updated

                if (!updated) {
                    throw new Error('La API no devolvió un confirmando actualizado.');
                }

                showAlerta('Grupo actualizado correctamente', 'success')
                return updated
            } catch (e) {
                showErroresDeValidacion(e?.response?.data?.errors || e)
                if (!e?.response?.data?.errors) {
                    showAlerta(e?.response?.data?.message || e?.message || 'Error al actualizar grupo', 'error');
                }
                throw e
            }
        },

        async remove(id, nombre) {
            let nombreParaConfirmar = nombre;
            if (!nombreParaConfirmar) {
                const grupoEnStore = this.byId(id);
                if (grupoEnStore) {
                    nombreParaConfirmar = grupoEnStore.nombre;
                }
            }
            const ok = await confirmarEliminacion(nombre || `Grupo ${nombreParaConfirmar}`)
            if (!ok) {
                showAlerta('Operación cancelada', 'info')
                return false
            }

            try {
                await deleteGrupoById(id)

                this.items = this.items.filter(c => c.id !== id)

                showAlerta('Grupo eliminado correctamente', 'success')
                return true
            } catch (e) {
                this.error = e?.response?.data?.message || e?.message || 'No se pudo eliminar el grupo'
                showAlerta(this.error, 'error')
                return false
            }
        },

        async assignCatequists(grupoId, catequistaIds) {
            if (!grupoId) throw new Error("ID de grupo no válido");

            try {
                const response = await syncCatequists(grupoId, catequistaIds);
                const updatedGroup = response?.grupo;
                if (updatedGroup) {
                    const idx = this.items.findIndex(g => g.id === grupoId);
                    if (idx !== -1) {
                        this.items[idx] = { ...this.items[idx], ...updatedGroup };
                    }
                }

                return response;
            } catch (e) {
                showErroresDeValidacion(e?.response?.data?.errors || e);
                throw e;
            }
        },

        async assignConfirmandos(grupoId, confirmandoIds) {
            if (!grupoId) throw new Error("ID de grupo no válido");
            try {
                const response = await syncConfirmandos(grupoId, confirmandoIds);

                const updatedGroup = response?.grupo;
                if (updatedGroup) {
                    const idx = this.items.findIndex(g => g.id === Number(grupoId));
                    if (idx !== -1) {
                        this.items[idx] = updatedGroup;
                    }
                }
                return response;
            } catch (e) {
                showErroresDeValidacion(e?.response?.data?.errors || e);
                if (!e?.response?.data?.errors) {
                    showAlerta(e?.response?.data?.message || e?.message || 'No se pudo asignar confirmandos', 'error');
                }
                throw e;
            }
        },
        
        updateCatechistDetails(updatedUser) {
            if (!updatedUser || !updatedUser.id) return;

            this.items.forEach(grupo => {
                if (grupo.catequistas && grupo.catequistas.length > 0) {
                    const catequista = grupo.catequistas.find(c => c.id === updatedUser.id);

                    if (catequista) {
                        catequista.name = updatedUser.name;
                        catequista.email = updatedUser.email;
                    }
                }
            });
        },

        async fetchApoderadosByGrupo(grupoId) {
            this.loading = true;
            try {
                const data = await getApoderadosByGrupo(grupoId);
                return data;
            } catch (e) {
                console.error(e);
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async generateGroups(payload) {
            this.loading = true;
            try {
                // Llamamos al servicio
                const response = await generarGruposEquitativos(payload);
                
                // Como se crearon grupos nuevos en el backend, nuestra lista 'items' 
                // está desactualizada. Lo mejor es recargarla.
                await this.fetchAll();

                return response; // Devolvemos la respuesta para mostrar el mensaje en la vista
            } catch (e) {
                // Manejo de errores estándar
                showErroresDeValidacion(e?.response?.data?.errors || e);
                if (!e?.response?.data?.errors) {
                    showAlerta(e?.response?.data?.message || e?.message || 'Error al generar grupos', 'error');
                }
                throw e;
            } finally {
                this.loading = false;
            }
        },
    }
})