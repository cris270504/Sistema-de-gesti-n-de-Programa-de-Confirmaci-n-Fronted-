import { defineStore } from 'pinia'
import { confirmarEliminacion, showAlerta, showErroresDeValidacion } from '@/funciones'
import { createGrupo, deleteGrupoById, getGrupoById, getGruposList, syncCatequists, updateGrupo, syncConfirmandos, getApoderadosByGrupo, generarGruposEquitativos } from '../services/grupos';

const FRESH_MS = 30_000

export const useGruposStore = defineStore('grupos', {
    state: () => ({
        items: [],
        loading: false,
        error: null,
        lastFetch: 0,
        _inflight: null,
    }),

    getters: {
        byId: (state) => (id) => state.items.find(c => c.id === Number(id)),
        count: (state) => state.items.length,
    },

    actions: {
        async fetchAll({ force = false } = {}) {
            if (this._inflight) return this._inflight
            if (!force && this.items.length > 0 && Date.now() - this.lastFetch < FRESH_MS) return

            if (this.items.length === 0) this.loading = true
            this.error = null

            this._inflight = getGruposList()
                .then((data) => {
                    this.items = data
                    this.lastFetch = Date.now()
                })
                .catch((e) => {
                    this.error = e?.response?.data?.message || e?.message || 'Error al listar grupos'
                    showAlerta(this.error, 'error')
                })
                .finally(() => {
                    this.loading = false
                    this._inflight = null
                })

            return this._inflight
        },
        async fetchById(id) {
            // Si ya lo tenemos (viene completo del listado), lo devolvemos sin tocar
            // `loading`: el modal de edición vive dentro de <AppPage :loading>, y
            // encender el loading global lo desmontaría a mitad de la animación de
            // Bootstrap (TypeError en _showElement). Igual que en los demás stores.
            const existente = this.byId(id);
            if (existente) return existente;

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
            const grupoEnStore = this.byId(id);
            const nombreParaConfirmar = nombre || grupoEnStore?.nombre || `Grupo ${id}`;

            // Un grupo con confirmandos no se puede eliminar (los dejaría sin grupo y
            // a los catequistas sin asignación). Hay que reasignarlos primero.
            const nConf = grupoEnStore?.confirmandos?.length ?? 0;
            if (nConf > 0) {
                showAlerta(
                    `«${nombreParaConfirmar}» tiene ${nConf} confirmando(s) asignado(s). ` +
                    `Quítalos o pásalos a otro grupo antes de eliminarlo.`,
                    'warning',
                );
                return false;
            }

            const ok = await confirmarEliminacion(nombreParaConfirmar)
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

            // Extraemos los IDs de los grupos a los que AHORA pertenece
            // Si por alguna razón viene undefined, asumimos un array vacío
            const nuevosGruposIds = updatedUser.grupos
                ? updatedUser.grupos.map(g => g.id)
                : [];

            this.items.forEach(grupo => {
                if (!grupo.catequistas) {
                    grupo.catequistas = [];
                }

                const catequistaIndex = grupo.catequistas.findIndex(c => c.id === updatedUser.id);
                const perteneceAEsteGrupo = nuevosGruposIds.includes(grupo.id);

                if (perteneceAEsteGrupo) {
                    if (catequistaIndex !== -1) {
                        grupo.catequistas[catequistaIndex].name = updatedUser.name;
                        grupo.catequistas[catequistaIndex].email = updatedUser.email;
                        grupo.catequistas[catequistaIndex].celular = updatedUser.celular;
                    } else {
                        grupo.catequistas.push({
                            id: updatedUser.id,
                            name: updatedUser.name,
                            email: updatedUser.email,
                            celular: updatedUser.celular
                        });
                    }
                } else {
                    if (catequistaIndex !== -1) {
                        grupo.catequistas.splice(catequistaIndex, 1);
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

                // El backend ya devuelve la lista de grupos actualizada: la aplicamos
                // en memoria en vez de re-descargarla.
                if (Array.isArray(response?.grupos)) {
                    this.items = response.grupos;
                    this.lastFetch = Date.now();
                } else {
                    await this.fetchAll({ force: true });
                }

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