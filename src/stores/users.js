import { defineStore } from 'pinia'
import { getUsersList, createUser, updateUser, deleteUserById, getUserById } from '@/services/users'
import { confirmarEliminacion, showAlerta, showErroresDeValidacion } from '@/funciones'
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
        const password = '123456789'

        showAlerta(
          `Usuario ${name} creado correctamente.\n\n DNI: ${dni}\n Contraseña: ${password}`,
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
        this.error = e?.response?.data?.message || e?.message || 'No se pudo eliminar el usuario'
        showAlerta(this.error, 'error')
        return false
      }
    },
    async updateProfile(payload) {
      if (!this.user || !this.user.id) {
        showAlerta('No estás autenticado', 'error');
        return false;
      }
      const userId = this.user.id;
      try {
        const response = await updateUser(userId, payload);
        const updatedUser = response?.user;
        if (!updatedUser) {
          throw new Error('La API no devolvió un usuario actualizado.');
        }

        this.user = { ...this.user, ...updatedUser };
        localStorage.setItem(LS_USER_KEY, JSON.stringify(this.user));
        showAlerta('Perfil actualizado', 'success');
        return true;

      } catch (e) {
        console.error("Error al actualizar perfil:", e);
        showErroresDeValidacion(e?.response?.data?.errors || e);
        if (!e?.response?.data?.errors) {
          showAlerta(e?.response?.data?.message || e?.message || 'No se pudo actualizar', 'error');
        }
        throw e;
      }
    },
  },
})