import { defineStore } from 'pinia'
import api from '@/lib/api'
import router from '@/router'
import { LS_TOKEN_KEY, LS_USER_KEY } from '../constants/auth'
import { updateUser } from '@/services/users'
import { useParroquiaStore } from './parroquia'
import { useUiStore } from './ui'
import { useDashboardStore } from './dashboard'
import { showAlerta, showErroresDeValidacion } from '@/funciones'
import { supabase } from '@/lib/supabase'

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
    /**
     * Fase 1 migración Supabase: la autenticación la hace Supabase Auth.
     * 1) `resolver-login` traduce el identificador tecleado (correo O DNI) al
     *    correo canónico de auth.users.
     * 2) signInWithPassword contra Supabase (supabase-js persiste la sesión y
     *    refresca el token solo).
     * 3) se hidratan roles/permisos/parroquia desde Laravel (/get-user), que
     *    sigue sirviendo los datos validando el token de Supabase.
     */
    async login(credentials) {
      this.loading = true
      this.error = null
      try {
        const identificador = credentials.login ?? credentials.email ?? credentials.dni ?? ''

        const { data: resuelto, error: errResolver } = await supabase.functions.invoke(
          'resolver-login',
          { body: { login: identificador } },
        )
        if (errResolver || !resuelto?.email) {
          throw new Error('No se pudo resolver el identificador')
        }

        const { data: sesion, error: errLogin } = await supabase.auth.signInWithPassword({
          email: resuelto.email,
          password: credentials.password,
        })
        if (errLogin || !sesion?.session) {
          this.error = 'Credenciales inválidas'
          showAlerta('Credenciales inválidas', 'error')
          this.logoutLocal()
          return false
        }

        this.token = sesion.session.access_token
        localStorage.setItem(LS_TOKEN_KEY, this.token)

        // Hidratar el usuario de la app (roles, permisos, parroquia, config).
        const { data } = await api.get('/get-user', { __retryable: true })
        this.user = data
        localStorage.setItem(LS_USER_KEY, JSON.stringify(data))

        useParroquiaStore().hydrateFromLogin({
          parroquia: data?.parroquia,
          configuracion: data?.configuracion,
        })

        if (data?.metricas) useDashboardStore().seedMetricas(data.metricas)

        return true
      } catch (e) {
        showAlerta('Credenciales inválidas', 'error')
        this.error = e?.response?.data?.message || e?.message || 'Credenciales inválidas'
        this.logoutLocal()
        return false
      } finally {
        this.loading = false
      }
    },

    /**
     * Sincroniza el token del store con la sesión de supabase-js (que lo refresca
     * en segundo plano) y cierra la sesión local si Supabase la invalida. Se
     * engancha una vez al arrancar la app (App.vue).
     */
    initAuthListener() {
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          this.logoutLocal()
          return
        }
        this.token = session.access_token
        localStorage.setItem(LS_TOKEN_KEY, session.access_token)
      })
    },


    /**
     * Refresca datos y permisos del usuario desde /get-user. Se llama al arrancar
     * la app: así los permisos nunca quedan desfasados respecto al backend (p. ej.
     * si cambió un rol) y no se dispara un /403 con datos viejos de localStorage.
     */
    async refrescarUsuario() {
      if (!this.token) return
      try {
        const { data } = await api.get('/get-user', { silent: true })
        this.user = { ...this.user, ...data }
        localStorage.setItem(LS_USER_KEY, JSON.stringify(this.user))
        useParroquiaStore().hydrateFromLogin({
          parroquia: data.parroquia,
          configuracion: data.configuracion,
        })
      } catch {
        // 401 → el interceptor de api ya cierra la sesión. Otros errores: se
        // conserva lo que había en localStorage.
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
      const ui = useUiStore()
      ui.showOverlay('Cerrando sesión…')
      await supabase.auth.signOut().catch(() => {})
      this.logoutLocal()
      await router.push({ name: 'login' })
      ui.hideOverlay()
    },

    logoutLocal() {
      this.token = null
      this.user = null
      localStorage.removeItem(LS_TOKEN_KEY)
      localStorage.removeItem(LS_USER_KEY)
      useParroquiaStore().clear()
    },
  },
})
