import { defineStore } from 'pinia'
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
    _ultimoChequeo: 0,
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
     * Autenticación 100% Supabase:
     * 1) `resolver-login` traduce el identificador tecleado (correo O DNI) al
     *    correo canónico de auth.users.
     * 2) signInWithPassword contra Supabase (supabase-js persiste la sesión y
     *    refresca el token solo).
     * 3) se hidrata roles/permisos/parroquia/config con la RPC `fn_get_user`.
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
        // Parroquia desactivada → la Edge Function responde 403 { error: 'parroquia_inactiva' }.
        let errCode = resuelto?.error
        if (errResolver && !errCode) {
          try { errCode = (await errResolver.context?.json?.())?.error } catch { /* sin cuerpo */ }
        }
        if (errCode === 'parroquia_inactiva') {
          this.logoutLocal()
          this.error = 'Tu parroquia está desactivada.'
          showAlerta('Tu parroquia está desactivada. Contacta con el proveedor del sistema.', 'error')
          return false
        }
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
        const { data, error: errUser } = await supabase.rpc('fn_get_user')
        if (errUser || !data) {
          // Parroquia desactivada u otro rechazo del backend: cerramos la sesión
          // de Supabase que sí se creó y mostramos el motivo real.
          const msg = errUser?.message || 'No se pudo cargar el perfil'
          await supabase.auth.signOut().catch(() => {})
          this.logoutLocal()
          showAlerta(/desactivad|inactiv/i.test(msg) ? msg : 'No se pudo iniciar sesión', 'error')
          this.error = msg
          return false
        }
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
     * Refresca datos y permisos del usuario con `fn_get_user`. Se llama al
     * arrancar la app: así los permisos nunca quedan desfasados (p. ej. si cambió
     * un rol) — la RPC los relee en vivo, no del claim del JWT.
     */
    async refrescarUsuario({ force = false } = {}) {
      if (!this.token) return
      const ahora = Date.now()
      // Throttle: en navegación/focus se llama seguido; al arrancar la app va force.
      if (!force && ahora - (this._ultimoChequeo || 0) < 30_000) return
      this._ultimoChequeo = ahora

      const { data, error } = await supabase.rpc('fn_get_user')
      if (error || !data) {
        // Parroquia desactivada (u otro rechazo explícito): cerrar sesión ahora,
        // con aviso. Errores transitorios (red): se conserva localStorage.
        if (/desactivad|inactiv|no encontrado o inactivo/i.test(error?.message || '')) {
          showAlerta(
            /desactivad|inactiv/i.test(error.message)
              ? 'Tu parroquia fue desactivada. Contacta con el proveedor del sistema.'
              : error.message,
            'error',
          )
          await this.logout()
        }
        return
      }
      this.user = { ...this.user, ...data }
      localStorage.setItem(LS_USER_KEY, JSON.stringify(this.user))
      useParroquiaStore().hydrateFromLogin({
        parroquia: data.parroquia,
        configuracion: data.configuracion,
      })
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
