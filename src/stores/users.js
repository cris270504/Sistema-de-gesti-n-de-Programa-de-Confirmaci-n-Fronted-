import { defineStore } from 'pinia'
import { getUsersList, createUser, updateUser, deleteUserById, getUserById, setUserEstado } from '@/services/users'
import { confirmar, confirmarEliminacion, showAlerta, showErroresDeValidacion } from '@/funciones'
import { useGruposStore } from './grupos';

export const useUsersStore = defineStore('users', {
  state: () => ({
    items: [],
    loading: false,
    error: null,
  }),

  getters: {
    byId: (state) => (id) => state.items.find(u => u.id === Number(id)),
    count: (state) => state.items.length,
  },

  actions: {
    async fetchAll() {
      this.loading = true;
      this.error = null;
      try {
        this.items = await getUsersList();
      } catch (e) {
        this.error = e?.message || 'Error al listar usuarios';
      } finally {
        this.loading = false;
      }
    },

    async fetchById(id) {
      const existingUser = this.byId(id);
      if (existingUser) return existingUser;

      this.loading = true
      this.error = null
      try {
        const userId = Number(id);
        const user = await getUserById(userId)
        const idx = this.items.findIndex(u => u.id === userId)

        if (idx === -1) {
          this.items.unshift(user)
        } else {
          this.items[idx] = user
        }
        return user;
      } catch (e) {
        this.error = e?.response?.data?.message || e?.message || `Error al obtener usuario ${id}`
        showAlerta(this.error, 'error');
        throw e;
      } finally {
        this.loading = false
      }
    },

    async add(userPayload) {
      try {
        const response = await createUser(userPayload);
        const created = response?.user;
        if (!created) {
          throw new Error('La API no devolvió un usuario válido.');
        }

        this.items.unshift(created)

        const name = created?.name
        const dni = created?.dni
        const password = response?.temp_password

        showAlerta(
          `Usuario ${name} creado correctamente.\n\n DNI: ${dni}\n Contraseña temporal: ${password}`,
          'success'
        );
        return created
      } catch (e) {
        showErroresDeValidacion(e?.response?.data?.errors || e)
        throw e
      }
    },

    async save(id, user) {
      try {
        const response = await updateUser(id, user);
        const updated = response?.user;

        if (!updated) {
          throw new Error('La API no devolvió un usuario actualizado.');
        }

        const idx = this.items.findIndex(u => u.id === id)
        if (idx !== -1) this.items[idx] = updated

        const gruposStore = useGruposStore();
        gruposStore.updateCatechistDetails(updated);

        showAlerta('Usuario actualizado correctamente', 'success')
        return updated
      } catch (e) {
        showErroresDeValidacion(e?.response?.data?.errors || e)
        if (!e?.response?.data?.errors) {
          showAlerta(e?.response?.data?.message || e?.message || 'Error al actualizar usuario', 'error');
        }
        throw e
      }
    },

    async setEstado(user) {
      const activar = !user.activo
      const ok = await confirmar({
        titulo: activar ? `¿Activar a ${user.name}?` : `¿Desactivar a ${user.name}?`,
        texto: activar
          ? 'Volverá a poder iniciar sesión.'
          : 'No podrá iniciar sesión, pero se conserva su historial. Puedes reactivarlo cuando quieras.',
        icono: activar ? 'question' : 'warning',
        confirmarTexto: activar ? 'Sí, activar' : 'Sí, desactivar',
      })
      if (!ok) return false

      try {
        await setUserEstado(user.id, activar)
        const idx = this.items.findIndex(u => u.id === user.id)
        if (idx !== -1) this.items[idx] = { ...this.items[idx], activo: activar }
        showAlerta(activar ? 'Usuario activado' : 'Usuario desactivado', 'success')
        return true
      } catch (e) {
        showAlerta(e?.response?.data?.message || 'No se pudo cambiar el estado', 'error')
        return false
      }
    },

    async remove(id, nombre) {
      const userId = Number(id);
      const ok = await confirmarEliminacion(nombre || `usuario con ID ${userId}`)
      if (!ok) {
        showAlerta('Operación cancelada', 'info')
        return false
      }
      try {
        await deleteUserById(userId)
        this.items = this.items.filter(u => u.id !== userId)
        showAlerta('Usuario eliminado correctamente', 'success')
        return true
      } catch (e) {
        // Se muestra en el diálogo, no como banner persistente en la vista.
        showAlerta(e?.response?.data?.message || e?.message || 'No se pudo eliminar el usuario', 'error')
        return false
      }
    },
  },
})