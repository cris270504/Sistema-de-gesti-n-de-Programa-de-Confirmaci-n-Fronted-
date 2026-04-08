import { defineStore } from 'pinia'
import api from '@/lib/api'
import router from '@/router'
import { LS_TOKEN_KEY, LS_USER_KEY } from '../constants/auth'
import { updateUser } from '@/services/users'
import { showAlerta, showErroresDeValidacion } from '@/funciones'

function safeParse(json) {
  try { return JSON.parse(json) } catch { return null }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(LS_TOKEN_KEY),
    user: safeParse(localStorage.getItem(LS_USER_KEY)),
    loading: false,
    error: null,
  }),

  getters: {
    isAuthenticated: (s) => !!s.token && !!s.user,
    roles: (s) => s.user?.roles ?? [],
    permissions: (s) => s.user?.permissions ?? [],

    hasRole: (s) => (role) => s.user?.roles?.includes(role) ?? false,
    can: (s) => (perm) => s.user?.permissions?.includes(perm) ?? false,
    canAny: (s) => (perms = []) => (s.user?.permissions ?? []).some(p => perms.includes(p)),
    canAll: (s) => (perms = []) => perms.every(p => (s.user?.permissions ?? []).includes(p)),
    isCoordinador: (state) => state.user?.roles?.includes('coordinador') ?? false,
  },

  actions: {
    async login(credentials) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.post('/login', credentials)

        this.token = data.token
        this.user = data.user

        localStorage.setItem(LS_TOKEN_KEY, data.token)
        localStorage.setItem(LS_USER_KEY, JSON.stringify(data.user))

        return true
      } catch (e) {
        showAlerta('Credenciales inválidas', 'error')
        this.error = e?.response?.data?.message || 'Credenciales inválidas'
        this.logoutLocal()
        return false
      } finally {
        this.loading = false
      }
    },


    async register(credentials) {
      this.loading = true
      this.error = null
      try {
        const body = {
          name: credentials.name,
          email: credentials.email,
          password: credentials.password,
          password_confirmation: credentials.password_confirmation ?? credentials.passwordConfirmed
        }

        const { data, status } = await api.post('/register', body)

        if (data?.token) {
          this.token = data.token
          localStorage.setItem(LS_TOKEN_KEY, data.token)

          this.user = data.user ?? (await api.get('/get-user')).data
          localStorage.setItem(LS_USER_KEY, JSON.stringify(this.user))

          showAlerta('Registro exitoso', 'success')
          return { ok: true, loggedIn: true }
        }

        this.error = data?.message || 'No se pudo registrar'
        showAlerta(this.error, 'error')
        return { ok: false, loggedIn: false }

      } catch (e) {
        console.log('REGISTER ERROR:', e?.response?.data);
        this.error = e?.response?.data?.message || 'No se pudo registrar'
        const errors = e?.response?.data?.errors || null
        if (!errors) showAlerta(this.error, 'error')
        return { ok: false, loggedIn: false, errors }
      } finally {
        this.loading = false
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

    async logout() {
      try { await api.post('/logout') } catch (_) { }
      this.logoutLocal()
      router.push({ name: 'login' })
    },

    logoutLocal() {
      this.token = null
      this.user = null
      localStorage.removeItem(LS_TOKEN_KEY)
      localStorage.removeItem(LS_USER_KEY)
    },
  },
})
