import { defineStore, getActivePinia } from 'pinia'

// Stores que NO se vacían al cerrar sesión: auth se limpia a mano, ui lleva el
// overlay/toasts del propio logout y systemStatus es estado global de
// mantenimiento (no datos del usuario) con su suscripción en vivo.
const STORES_QUE_SOBREVIVEN_AL_LOGOUT = new Set(['auth', 'ui', 'systemStatus'])
import router from '@/router'
import { LS_TOKEN_KEY, LS_USER_KEY } from '../constants/auth'
import { updateMyProfile } from '@/services/users'
import { useParroquiaStore } from './parroquia'
import { useUiStore } from './ui'
import { useDashboardStore } from './dashboard'
import { useSystemStatusStore } from './systemStatus'
import { showAlerta } from '@/funciones'
import { supabase } from '@/lib/supabase'
import { motivoFalloLogin, traducirError } from '@/lib/errores'

// Tras un reseteo de contraseña por el admin, hay que elegir una nueva.
const LS_DEBE_CAMBIAR_KEY = 'debe_cambiar_password'

function safeParse(json) {
  try { return JSON.parse(json) } catch { return null }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(LS_TOKEN_KEY),
    user: safeParse(localStorage.getItem(LS_USER_KEY)),
    loading: false,
    error: null,
    debeCambiarPassword: localStorage.getItem(LS_DEBE_CAMBIAR_KEY) === '1',
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

        // El login se hace en el servidor (Edge Function `login`): resuelve
        // DNI/correo → email sin exponerlo y limita los intentos fallidos.
        const { data: tokens, error: errFn } = await supabase.functions.invoke('login', {
          body: { login: identificador, password: credentials.password },
        })
        if (errFn || !tokens?.access_token) {
          let cuerpo = null
          try { cuerpo = await errFn?.context?.json?.() } catch { /* sin cuerpo JSON */ }
          const msg = motivoFalloLogin(errFn, undefined, cuerpo)
          this.error = msg
          showAlerta(msg, 'error')
          this.logoutLocal()
          return false
        }

        const { data: sesion, error: errSesion } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        })
        if (errSesion || !sesion?.session) throw errSesion || new Error('No se pudo iniciar la sesión')
        this.setDebeCambiarPassword(sesion.user?.user_metadata?.debe_cambiar_password === true)

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

        // Con await: si no, la primera navegación post-login puede correr con
        // el valor default (false) y dejar pasar a alguien bloqueado un
        // instante antes de que llegue el evento de Realtime.
        await useSystemStatusStore().fetchStatus()

        return true
      } catch (e) {
        const msg = motivoFalloLogin(e)
        showAlerta(msg, 'error')
        this.error = msg
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
        // SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED traen el user_metadata vigente.
        this.setDebeCambiarPassword(session.user?.user_metadata?.debe_cambiar_password === true)
      })
    },

    setDebeCambiarPassword(valor) {
      this.debeCambiarPassword = !!valor
      if (valor) localStorage.setItem(LS_DEBE_CAMBIAR_KEY, '1')
      else localStorage.removeItem(LS_DEBE_CAMBIAR_KEY)
    },

    /**
     * Cambia la contraseña del propio usuario directo en Supabase Auth.
     * (Antes pasaba por admin-usuarios → update, que exige ser privilegiado:
     * un catequista no podía cambiar su propia contraseña.)
     * También baja la marca de "debe cambiar la contraseña" del reseteo.
     */
    async cambiarPassword(nueva) {
      const { error } = await supabase.auth.updateUser({
        password: nueva,
        data: { debe_cambiar_password: false },
      })
      if (error) {
        if (error.code === 'same_password' || /different from the old/i.test(error.message || '')) {
          throw new Error('La nueva contraseña debe ser distinta de la actual.')
        }
        if (error.code === 'weak_password' || /weak|at least/i.test(error.message || '')) {
          throw new Error('La contraseña es muy débil. Usa al menos 8 caracteres combinando letras y números.')
        }
        throw new Error(traducirError(error))
      }
      this.setDebeCambiarPassword(false)
      return true
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

    /**
     * "Mi perfil": nombre y correo propios. Va por admin-usuarios → update_self,
     * que cualquier rol puede usar (antes usaba update, solo para admins, y un
     * catequista recibía "No autorizado"). Lanza Error con mensaje legible.
     */
    async updateProfile({ name, email }) {
      if (!this.user?.id) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')
      const response = await updateMyProfile({ name, email })
      const updatedUser = response?.user
      if (!updatedUser) throw new Error('No se pudo actualizar el perfil.')
      this.user = { ...this.user, ...updatedUser }
      localStorage.setItem(LS_USER_KEY, JSON.stringify(this.user))
      return true
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
      this.setDebeCambiarPassword(false)
      useParroquiaStore().clear()
      // Vaciar los datos en memoria del usuario que sale (dashboard, listas,
      // grupos…). Sin esto, quien entra después en el mismo dispositivo veía
      // datos cacheados de la sesión anterior: alertas de otro rol, listas
      // completas que su rol no debería ver, etc.
      getActivePinia()?._s.forEach((store, id) => {
        if (STORES_QUE_SOBREVIVEN_AL_LOGOUT.has(id)) return
        try { store.$reset() } catch { /* store sin $reset: se ignora */ }
      })
    },
  },
})
