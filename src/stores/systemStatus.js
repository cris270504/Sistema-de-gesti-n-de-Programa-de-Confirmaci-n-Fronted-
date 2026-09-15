import { defineStore } from 'pinia'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { getSystemStatus, setMantenimiento, subscribeSystemStatus } from '@/services/systemStatus'

export const useSystemStatusStore = defineStore('systemStatus', {
    state: () => ({
        mantenimiento: false,
        mensaje: null,
        alcance: 'todas',
        parroquiaIds: [],
        loaded: false,
        saving: false,
        _unsubscribe: null,
    }),

    getters: {
        // El proveedor nunca queda bloqueado: es quien tiene que poder entrar a
        // desactivarlo. Para los demás, si el alcance es 'parroquias', solo
        // bloquea a quienes pertenecen a una de esas parroquias.
        bloqueaAlUsuarioActual: (state) => {
            if (!state.mantenimiento) return false
            const auth = useAuthStore()
            if (auth.user?.roles?.includes('proveedor')) return false
            if (state.alcance === 'todas') return true
            const miParroquiaId = auth.user?.parroquia?.id ?? null
            return miParroquiaId != null && state.parroquiaIds.includes(miParroquiaId)
        },
    },

    actions: {
        _aplicar(data) {
            this.mantenimiento = !!data.mantenimiento
            this.mensaje = data.mensaje ?? null
            this.alcance = data.alcance ?? 'todas'
            this.parroquiaIds = data.parroquia_ids ?? []
        },

        async fetchStatus() {
            try {
                this._aplicar(await getSystemStatus())
                this.loaded = true
            } catch {
                // Si falla la lectura (ej. sin sesión todavía), no bloqueamos por
                // defecto: mejor dejar pasar que trabar a todo el mundo por un
                // error transitorio de red.
            }
        },

        // Se llama una vez al arrancar la app (App.vue), igual que
        // auth.initAuthListener().
        iniciarEscuchaEnVivo() {
            if (this._unsubscribe) return
            this._unsubscribe = subscribeSystemStatus((row) => {
                this._aplicar(row)

                if (this.bloqueaAlUsuarioActual) {
                    if (router.currentRoute.value.name !== 'mantenimiento') {
                        router.push({ name: 'mantenimiento' })
                    }
                } else if (router.currentRoute.value.name === 'mantenimiento') {
                    router.push({ name: 'dashboard' })
                }
            })
        },

        // scope: { alcance: 'todas' | 'parroquias', parroquia_ids?: number[] }
        async activar(mensaje, scope) {
            this.saving = true
            try {
                this._aplicar(await setMantenimiento(true, mensaje, scope))
            } finally {
                this.saving = false
            }
        },

        async desactivar() {
            this.saving = true
            try {
                this._aplicar(await setMantenimiento(false, null))
            } finally {
                this.saving = false
            }
        },
    },
})
