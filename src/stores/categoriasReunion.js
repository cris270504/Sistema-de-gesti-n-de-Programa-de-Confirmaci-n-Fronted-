import { defineStore } from 'pinia'
import { getCategorias, hayJornadas } from '@/services/jornadas'

const FRESH_MS = 60_000

// Categorías de reunión de la parroquia (Reunión / Jornada / Retiro…) y la
// bandera que decide si el módulo "Jornadas" aparece en el menú.
export const useCategoriasReunionStore = defineStore('categoriasReunion', {
  state: () => ({
    items: [],
    lastFetch: 0,
    _inflight: null,
    hayJornadas: false,
    _inflightHay: null,
  }),
  getters: {
    activas: (s) => s.items.filter((c) => c.activa),
    byId: (s) => (id) => s.items.find((c) => c.id === Number(id)),
    permiteCronograma: (s) => (id) => !!s.items.find((c) => c.id === Number(id))?.permite_cronograma,
    // La de menor orden sin cronograma: la que el trigger asigna por defecto.
    porDefecto: (s) => [...s.items].filter((c) => c.activa)
      .sort((a, b) => Number(a.permite_cronograma) - Number(b.permite_cronograma) || a.orden - b.orden)[0] ?? null,
  },
  actions: {
    async fetchAll({ force = false } = {}) {
      if (this._inflight) return this._inflight
      if (!force && this.items.length && Date.now() - this.lastFetch < FRESH_MS) return
      this._inflight = getCategorias()
        .then((data) => { this.items = data; this.lastFetch = Date.now() })
        .catch((e) => console.error('No se pudieron cargar las categorías', e))
        .finally(() => { this._inflight = null })
      return this._inflight
    },
    async refrescarHayJornadas() {
      if (this._inflightHay) return this._inflightHay
      this._inflightHay = hayJornadas()
        .then((v) => { this.hayJornadas = v })
        .catch(() => { /* sin permiso o sin red: el módulo queda oculto */ })
        .finally(() => { this._inflightHay = null })
      return this._inflightHay
    },
  },
})
