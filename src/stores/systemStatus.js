import { defineStore } from 'pinia'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { getSystemStatus, setMantenimiento, subscribeSystemStatus } from '@/services/systemStatus'

export const useSystemStatusStore = defineStore('systemStatus', {
    state: () => ({
        mantenimiento: false,
        mensaje: null,
        loaded: false,
        saving: false,
        _unsubscribe: null,
    }),

    getters: {
        // El proveedor nunca queda bloqueado: es quien tiene que poder entrar a
        // desactivarlo.
        bloqueaAlUsuarioActual: (state) => {
            const auth = useAuthStore()
            const esProveedor = auth.user?.roles?.includes('proveedor')
            return state.mantenimiento && !esProveedor
        },
    },

    actions: {
        async fetchStatus() {
            try {
                const data = await getSystemStatus()
                this.mantenimiento = !!data.mantenimiento
                this.mensaje = data.mensaje ?? null
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
                this.mantenimiento = !!row.mantenimiento
                this.mensaje = row.mensaje ?? null

                if (this.bloqueaAlUsuarioActual) {
                    if (router.currentRoute.value.name !== 'mantenimiento') {
                        router.push({ name: 'mantenimiento' })
                    }
                } else if (router.currentRoute.value.name === 'mantenimiento') {
                    router.push({ name: 'dashboard' })
                }
            })
        },

        async activar(mensaje) {
            this.saving = true
            try {
                const data = await setMantenimiento(true, mensaje)
                this.mantenimiento = !!data.mantenimiento
                this.mensaje = data.mensaje ?? null
            } finally {
                this.saving = false
            }
        },

        async desactivar() {
            this.saving = true
            try {
                const data = await setMantenimiento(false, null)
                this.mantenimiento = !!data.mantenimiento
                this.mensaje = data.mensaje ?? null
            } finally {
                this.saving = false
            }
        },
    },
})
